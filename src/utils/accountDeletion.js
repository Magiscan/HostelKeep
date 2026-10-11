/**
 * src/utils/accountDeletion.js
 *
 * Required by App Store Review Guideline 5.1.1(v) and the equivalent Google
 * Play policy: any app that lets users create an account must let them delete
 * it FROM INSIDE THE APP. A "contact your manager" note is explicitly not
 * enough and is a documented rejection cause.
 *
 * On the Spark plan there is no Admin SDK, but the client SDK can delete the
 * CURRENTLY SIGNED-IN auth user, which is exactly what the stores require.
 *
 * TWO ORDERING RULES, both load-bearing:
 *
 *   1. Every security rule begins by reading users/{uid}, so the caller's own
 *      profile document must be deleted LAST. Delete it early and every
 *      subsequent write is denied.
 *
 *   2. Every hostel subcollection rule ends in `&& isMemberOf(hostelCode)`,
 *      which means the hostel being wiped must be the ACTIVE one. Deleting a
 *      background hostel without switching to it first fails halfway through
 *      and leaves orphaned rooms behind. `deleteHostel` below switches first.
 *
 * WHAT SURVIVES, and why:
 *   • Cleaner and staff Firebase Auth accounts. The client SDK can only delete
 *     the signed-in user. They are inert — every rule starts by reading
 *     users/{uid}, and that document is gone — but the rows stay visible in the
 *     Authentication console. Clear them out by hand now and then.
 *   • hostelCodes/{code}. Never deleted, so a retired code is never reissued to
 *     a different property.
 */

import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  deleteUser, reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth';
import { db, auth } from '../firebase';

const CHUNK = 400; // Firestore caps a batch at 500 writes

/** Deletes every document in a collection, in batches. */
async function deleteCollection(path) {
  const snap = await getDocs(collection(db, ...path));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

/**
 * Firebase requires a recent sign-in before deleting an account. Rather than
 * surfacing a cryptic `auth/requires-recent-login`, ask for the password and
 * re-authenticate first.
 */
export async function reauthenticate(password) {
  const current = auth.currentUser;
  if (!current) throw new Error('You are not signed in.');
  const credential = EmailAuthProvider.credential(current.email, password);
  await reauthenticateWithCredential(current, credential);
}

/* ── Cleaner ────────────────────────────────────────────────────────────── */

export async function deleteOwnCleanerAccount({ uid, hostelCode, username }) {
  // 1. Release assigned rooms so the manager doesn't see dangling references.
  const assigned = await getDocs(query(
    collection(db, 'hostels', hostelCode, 'rooms'),
    where('assignedTo', '==', uid),
  ));
  if (!assigned.empty) {
    const batch = writeBatch(db);
    assigned.forEach((d) => batch.update(d.ref, { assignedTo: null }));
    await batch.commit();
  }

  // 2. Remove any extra-room requests they raised (these can hold photos).
  const requests = await getDocs(query(
    collection(db, 'hostels', hostelCode, 'extraRequests'),
    where('cleanerId', '==', uid),
  ));
  if (!requests.empty) {
    const batch = writeBatch(db);
    requests.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // 3. Login lookup, then the profile itself.
  await deleteDoc(doc(db, 'loginLookup', `${hostelCode}_${username}`));
  await deleteDoc(doc(db, 'users', uid));

  // 4. The auth account last — after this the session is gone.
  await deleteUser(auth.currentUser);
}

/* ── Staff ──────────────────────────────────────────────────────────────── */

/**
 * A staff member deleting their own account. They own no hostel data, so this
 * is just their own profile. Staff sign in with a real email and have no
 * loginLookup row.
 */
export async function deleteOwnStaffAccount({ uid }) {
  await deleteDoc(doc(db, 'users', uid));
  await deleteUser(auth.currentUser);
}

/* ── Hostel ─────────────────────────────────────────────────────────────── */

/**
 * Wipes one hostel's data and every account belonging to it. Does NOT touch
 * the caller's own profile or auth account.
 *
 * The hostel MUST already be the caller's active hostel — see ordering rule 2
 * at the top of this file. `deleteHostel` handles that; call this directly at
 * your own risk.
 */
async function wipeHostel(hostelCode, onProgress = () => {}) {
  onProgress('Removing rooms and cleaning data…');
  await deleteCollection(['hostels', hostelCode, 'roomStatus']);
  await deleteCollection(['hostels', hostelCode, 'extraRequests']);
  await deleteCollection(['hostels', hostelCode, 'rooms']);
  await deleteCollection(['hostels', hostelCode, 'floors']);
  await deleteCollection(['hostels', hostelCode, 'notifications']);
  await deleteCollection(['hostels', hostelCode, 'dailyLogs']);
  await deleteCollection(['hostels', hostelCode, 'config']);

  // Maintenance tasks hold sub-subcollections (photos, comments) that
  // Firestore will NOT remove when the parent task document is deleted. A
  // naive deleteCollection(['…','maintenance']) would wipe the task rows and
  // leave orphaned photo/comment documents behind, invisible from the app but
  // still counting against storage and still readable by any rule that walks
  // the path. Walk each task first, then the collection.
  onProgress('Removing maintenance…');
  const tasks = await getDocs(collection(db, 'hostels', hostelCode, 'maintenance'));
  for (const task of tasks.docs) {
    await deleteCollection(['hostels', hostelCode, 'maintenance', task.id, 'photos']);
    await deleteCollection(['hostels', hostelCode, 'maintenance', task.id, 'comments']);
  }
  await deleteCollection(['hostels', hostelCode, 'maintenance']);

  onProgress('Removing team accounts…');
  const members = await getDocs(query(
    collection(db, 'users'),
    where('hostelCode', '==', hostelCode),
  ));

  const removable = members.docs.filter((d) => {
    const role = d.data().role;
    return role === 'cleaner' || role === 'staff';
  });

  for (let i = 0; i < removable.length; i += 200) {
    const batch = writeBatch(db);
    removable.slice(i, i + 200).forEach((d) => {
      batch.delete(d.ref);
      // Only cleaners have a lookup row. A missing row used to abort the whole
      // batch; filtering on role is what stops that.
      if (d.data().role === 'cleaner') {
        const name = d.data().username;
        if (name) batch.delete(doc(db, 'loginLookup', `${hostelCode}_${name}`));
      }
    });
    await batch.commit();
  }

  onProgress('Removing the hostel…');
  await deleteDoc(doc(db, 'hostels', hostelCode));
}

/**
 * Delete ONE hostel and keep the account. Only meaningful for an owner with
 * more than one property — the last hostel cannot be deleted on its own,
 * because a manager profile pointing at no hostel cannot read or write
 * anything and has no route back. Deleting the last one means deleting the
 * account, which is `deleteOwnAccount` below.
 *
 * @param {object}   user        the signed-in user ({ uid, hostelCodes })
 * @param {string}   hostelCode  which hostel to remove
 * @param {function} switchHostel  AuthContext's switchHostel — needed because
 *                                 the target must be active before the wipe
 * @param {function} onProgress
 */
export async function deleteHostel(
  { uid, hostelCodes = [] },
  hostelCode,
  switchHostel,
  onProgress = () => {},
) {
  const remaining = hostelCodes.filter(c => c !== hostelCode);
  if (remaining.length === 0) {
    throw new Error(
      'This is your only hostel. Deleting it means deleting your account — '
      + 'use Delete account instead.',
    );
  }

  onProgress('Opening the hostel…');
  await switchHostel(hostelCode);

  await wipeHostel(hostelCode, onProgress);

  // Drop the code and move to another property in a single write — the rules
  // require both to change together, because a profile pointing at a hostel
  // that no longer exists is a broken account.
  onProgress('Updating your account…');
  await updateDoc(doc(db, 'users', uid), {
    hostelCodes: remaining,
    hostelCode: remaining[0],
  });

  return remaining[0];
}

/**
 * Delete the signed-in account entirely. For an owner this takes every hostel
 * on the account with it.
 */
export async function deleteOwnAccount(user, password, onProgress = () => {}) {
  onProgress('Verifying…');
  await reauthenticate(password);

  const profileRef = doc(db, 'users', user.uid);
  const profile = await getDoc(profileRef);
  if (!profile.exists()) {
    // No profile, nothing to clean up — just remove the auth account.
    await deleteUser(auth.currentUser);
    return;
  }

  const { role, hostelCode, username, hostelCodes } = profile.data();

  if (role === 'cleaner') {
    await deleteOwnCleanerAccount({ uid: user.uid, hostelCode, username });
    return;
  }

  if (role === 'staff') {
    await deleteOwnStaffAccount({ uid: user.uid });
    return;
  }

  // Owner. Wipe each hostel in turn, making it active first so the
  // subcollection rules pass. The active hostel is left pointing at whichever
  // one we are currently wiping; that is fine, because the profile document
  // is deleted at the end regardless.
  const codes = Array.isArray(hostelCodes) && hostelCodes.length
    ? hostelCodes
    : [hostelCode].filter(Boolean);

  for (const code of codes) {
    if (code !== hostelCode) {
      // Switching is a plain field update on our own document, permitted as
      // long as the code is in hostelCodes.
      await updateDoc(profileRef, { hostelCode: code });
    }
    await wipeHostel(code, onProgress);
  }

  onProgress('Removing your account…');
  if (username && codes.length) {
    // Legacy managers created under the old synthetic-email scheme may still
    // have a lookup row. Best-effort: a missing row must not abort the delete.
    for (const code of codes) {
      await deleteDoc(doc(db, 'loginLookup', `${code}_${username}`)).catch(() => {});
    }
  }

  await deleteDoc(profileRef);
  await deleteUser(auth.currentUser);
}