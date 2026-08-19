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
 * ORDER MATTERS. Every security rule begins by reading users/{uid}, so the
 * caller's own profile document must be deleted LAST — delete it early and
 * every subsequent write is denied.
 */

import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, deleteDoc,
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

/**
 * Cleaner deleting their own account.
 * Releases their rooms, removes their profile and login lookup, then deletes
 * the auth user.
 */
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

/**
 * Manager deleting their own account. This removes the ENTIRE hostel: all
 * rooms, floors, statuses, requests, notifications, logs, and every cleaner
 * profile belonging to it.
 *
 * Cleaner Firebase Auth accounts survive — the client SDK cannot delete other
 * users — but they are inert, since every rule starts by reading
 * users/{uid} and those documents are gone. The store requirement covers the
 * signed-in user's own account, which IS fully deleted here.
 *
 * @param {function} onProgress optional (message: string) => void
 */
export async function deleteOwnManagerAccountAndHostel(
  { uid, hostelCode, username },
  onProgress = () => {},
) {
  // ── 1. Hostel subcollections (manager still has full rights here) ──
  onProgress('Removing rooms and cleaning data…');
  await deleteCollection(['hostels', hostelCode, 'roomStatus']);
  await deleteCollection(['hostels', hostelCode, 'extraRequests']);
  await deleteCollection(['hostels', hostelCode, 'rooms']);
  await deleteCollection(['hostels', hostelCode, 'floors']);
  await deleteCollection(['hostels', hostelCode, 'notifications']);
  await deleteCollection(['hostels', hostelCode, 'dailyLogs']);

  // ── 2. Cleaner profiles and their login lookups ──
  onProgress('Removing team accounts…');
  const cleaners = await getDocs(query(
    collection(db, 'users'),
    where('hostelCode', '==', hostelCode),
    where('role', '==', 'cleaner'),
  ));

  for (let i = 0; i < cleaners.docs.length; i += 200) {
    const batch = writeBatch(db);
    cleaners.docs.slice(i, i + 200).forEach((d) => {
      batch.delete(d.ref);
      const name = d.data().username;
      if (name) batch.delete(doc(db, 'loginLookup', `${hostelCode}_${name}`));
    });
    await batch.commit();
  }

  // ── 3. The hostel document ──
  onProgress('Removing the hostel…');
  await deleteDoc(doc(db, 'hostels', hostelCode));

  // ── 4. The manager's own lookup and profile — LAST, because every rule
  //       above depends on users/{uid} still existing. ──
  onProgress('Removing your account…');
  await deleteDoc(doc(db, 'loginLookup', `${hostelCode}_${username}`));
  await deleteDoc(doc(db, 'users', uid));

  // ── 5. The auth account ──
  await deleteUser(auth.currentUser);
}

/** Convenience wrapper — picks the right flow for the signed-in user. */
export async function deleteOwnAccount(user, password, onProgress) {
  await reauthenticate(password);

  const profile = await getDoc(doc(db, 'users', user.uid));
  if (!profile.exists()) {
    // No profile, nothing to clean up — just remove the auth account.
    await deleteUser(auth.currentUser);
    return;
  }

  const { role, hostelCode, username } = profile.data();

  if (role === 'manager') {
    await deleteOwnManagerAccountAndHostel(
      { uid: user.uid, hostelCode, username }, onProgress,
    );
  } else {
    await deleteOwnCleanerAccount({ uid: user.uid, hostelCode, username });
  }
}