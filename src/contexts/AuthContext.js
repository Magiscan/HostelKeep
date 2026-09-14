import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  deleteUser,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  getAuth,
  setPersistence,
  inMemoryPersistence,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, deleteDoc, writeBatch, collection, query, where,
  getDocs, updateDoc, getFirestore, terminate
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { auth, db, firebaseConfig } from '../firebase';
import { sendWelcomeEmail } from '../services/email';

const AuthContext = createContext();

// Synthetic addresses exist only for cleaners, who have no email of their own.
// Managers authenticate with their real address, which is what makes Firebase's
// own password-reset email work without a server.
const EMAIL_DOMAIN = 'keepclean.app';
const SYNTHETIC_DOMAINS = ['keepclean.app', 'hostelkeep.app'];
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True for anything shaped like an email address. */
export const looksLikeEmail = (value) => EMAIL_RE.test((value || '').trim());

/** True only for a real, reachable address — synthetic ones can't receive mail. */
export const isRealEmail = (value) => {
  const v = (value || '').trim().toLowerCase();
  return EMAIL_RE.test(v)
    && !SYNTHETIC_DOMAINS.some(d => v.endsWith(`@${d}`));
};

/** Builds the loginLookup document ID for a hostel + username pair. */
const lookupKey = (hostelCode, username) =>
  `${hostelCode.trim().toUpperCase()}_${username.trim()}`;

// ── Friendly error messages ────────────────────────────────────
function friendlyAuthError(e) {
  const code = e?.code || '';
  if (code.includes('wrong-password') || code.includes('invalid-credential'))
    return 'Incorrect password. Please try again.';
  if (code.includes('user-not-found'))
    return 'Invalid username, hostel code, or password.';
  if (code.includes('invalid-email'))
    return 'That email address is not valid.';
  if (code.includes('too-many-requests'))
    return 'Too many failed attempts. Please wait a few minutes.';
  if (code.includes('network-request-failed'))
    return 'Network error. Check your internet connection.';
  if (code.includes('email-already-in-use'))
    return 'That email already has a HostelKeep account. Use a different address, or sign in with it.';
  if (code.includes('weak-password'))
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (code.includes('requires-recent-login'))
    return 'Please sign in again before changing this.';
  if (code.includes('permission-denied'))
    return 'You do not have permission to do that.';
  return e?.message || 'Something went wrong. Please try again.';
}

/** 6 characters, no confusable 0/O/1/I. */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/**
 * Claims a hostel code by creating hostelCodes/{code}. The rules allow create
 * only — a code already taken comes back as permission-denied, so a collision
 * costs a retry instead of overwriting a live hostel.
 */
async function reserveCode(secondaryDb, uid, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const code = generateCode();
    try {
      await setDoc(doc(secondaryDb, 'hostelCodes', code), {
        uid,
        createdAt: new Date().toISOString(),
      });
      return code;
    } catch (e) {
      if ((e?.code || '') === 'permission-denied') continue;
      throw e;
    }
  }
  throw new Error('Could not allocate a hostel code. Please try again.');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set while a hostel is being provisioned on a secondary app. Nothing in
  // this file touches the primary session during provisioning, but the flag
  // documents the invariant and guards against a future regression.
  const provisioningRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

        if (userDoc.exists()) {
          const data = userDoc.data();
          // Only ever trust role/hostelCode from Firestore, which clients can
          // no longer write.
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: data.username,
            role: data.role,
            roleId: data.roleId || null,
            hostelCode: data.hostelCode,
            hostelCodes: data.hostelCodes || (data.hostelCode ? [data.hostelCode] : []),
            recoveryEmail: data.recoveryEmail || null,
            photoUri: data.photoUri || null,
          });

          // A manager who has finished migrating off a synthetic address no
          // longer needs a loginLookup row — and that row is the only thing
          // that ever exposed a real address to unauthenticated callers.
          if (
            data.role === 'manager'
            && data.username
            && data.hostelCode
            && isRealEmail(firebaseUser.email)
          ) {
            const staleRef = doc(db, 'loginLookup', lookupKey(data.hostelCode, data.username));
            getDoc(staleRef)
              .then((snap) => {
                if (snap.exists() && !isRealEmail(snap.data().email)) {
                  return deleteDoc(staleRef);
                }
                return null;
              })
              .catch(() => {});

            if (data.email !== firebaseUser.email) {
              updateDoc(doc(db, 'users', firebaseUser.uid), {
                email: firebaseUser.email,
                recoveryEmail: firebaseUser.email,
              }).catch(() => {});
            }
          }

          // One-time backfill for managers created before multi-hostel support.
          if (data.role === 'manager' && data.hostelCode && !data.hostelCodes) {
            updateDoc(doc(db, 'users', firebaseUser.uid), {
              hostelCodes: [data.hostelCode],
            }).catch(() => {});
          }

        } else {
          // An authenticated account with no profile can read and write
          // nothing under the current rules. Sign out rather than guess a role.
          console.warn('No user document for', firebaseUser.uid);
          await firebaseSignOut(auth);
          setUser(null);
        }
      } catch (e) {
        console.warn('Could not load user document:', e.message);
        await firebaseSignOut(auth).catch(() => {});
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // ── Login ──────────────────────────────────────────────────────
  // Two paths, chosen by what the person typed:
  //   • an email       → a manager, signing in directly. No lookup, so no
  //                      pre-auth read of anything.
  //   • a username     → a cleaner. One loginLookup read by exact document ID,
  //                      which only ever holds a synthetic address.
  const login = useCallback(async (identifier, password, hostelCode) => {
    const id = (identifier || '').trim();
    if (!id) throw new Error('Enter your email or username.');

    let email;

    if (looksLikeEmail(id)) {
      email = id.toLowerCase();
    } else {
      if (!hostelCode || !hostelCode.trim()) {
        throw new Error('Enter your hostel code.');
      }
      try {
        const snap = await getDoc(doc(db, 'loginLookup', lookupKey(hostelCode, id)));
        if (!snap.exists()) throw new Error('Invalid username or hostel code.');
        email = snap.data().email;
        if (!email) throw new Error('Invalid username or hostel code.');
      } catch (e) {
        throw new Error(
          e.message.startsWith('Invalid') ? e.message : friendlyAuthError(e),
        );
      }
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      throw new Error(friendlyAuthError(e));
    }
  }, []);

  // ── Create a hostel + its manager ──────────────────────────────
  // Provisioned entirely on a SECONDARY Firebase app. Creating the account on
  // the primary auth fires onAuthStateChanged before users/{uid} exists, which
  // either signs the half-built account straight back out or flips the
  // navigator to the manager stack and unmounts the screen mid-write.
  //
  // Write order matters, because the rules depend on it:
  //   1. users/{uid}    — allowed only while the hostel does NOT exist
  //   2. hostels/{code} — needs the users doc to name this exact code
  //
  // Managers get NO loginLookup row: they sign in with the email below.
  const createHostel = useCallback(
    async ({ hostelName, username, password, recoveryEmail }) => {
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      }

      const email = (recoveryEmail || '').trim().toLowerCase();
      if (!isRealEmail(email)) {
        throw new Error('Enter a valid email address. It is how you sign in and reset your password.');
      }

      const cleanName = username.trim();
      const cleanHostel = hostelName.trim();
      if (!cleanName || !cleanHostel) {
        throw new Error('Hostel name and manager name are both required.');
      }

      provisioningRef.current = true;
      let secondaryApp;
      let secondaryDbRef;
      let code;
      try {
        secondaryApp = initializeApp(firebaseConfig, `provision-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        const secondaryDb = getFirestore(secondaryApp);
        secondaryDbRef = secondaryDb;

        // Keep the provisional session out of browser storage entirely — it
        // exists for the length of this function and nothing should outlive it.
        await setPersistence(secondaryAuth, inMemoryPersistence).catch(() => {});

        let cred;
        try {
          cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        } catch (e) {
          throw new Error(friendlyAuthError(e));
        }

        const uid = cred.user.uid;

        try {
          code = await reserveCode(secondaryDb, uid);
        } catch (e) {
          await deleteUser(cred.user).catch(() => {});
          throw e;
        }

        try {
          await setDoc(doc(secondaryDb, 'users', uid), {
            username: cleanName,
            role: 'manager',
            hostelCode: code,
            hostelCodes: [code],
            email,
            recoveryEmail: email,
          });

          await setDoc(doc(secondaryDb, 'hostels', code), {
            name: cleanHostel,
            code,
            roomAttributes: [],
            createdAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Hostel setup failed:', e.message);
          // Roll the auth account back so the address stays reusable — without
          // this, a failed attempt permanently blocks that email.
          await deleteUser(cred.user).catch(() => {});
          throw new Error('Hostel setup failed. Please try again.');
        }

        // Best-effort: the code is shown on screen either way, so a mail
        // failure must never undo a hostel that exists.
        try {
          await sendWelcomeEmail({
            toEmail: email,
            managerName: cleanName,
            hostelName: cleanHostel,
            code,
          });
        } catch (e) {
          console.warn('Welcome email could not be sent:', e.message);
        }

        await firebaseSignOut(secondaryAuth).catch(() => {});
      } finally {
        // Close Firestore explicitly before dropping the app. Letting deleteApp
        // cascade into termination leaves in-flight work to reject outside this
        // try, which surfaces as an unhandled rejection and a dev error overlay.
        if (secondaryDbRef) {
          try { await terminate(secondaryDbRef); } catch (_) { /* ignore */ }
        }
        if (secondaryApp) {
          try { await deleteApp(secondaryApp); } catch (_) { /* ignore */ }
        }
        provisioningRef.current = false;
      }

      return code;
    },
    [],
  );

  // ── Register cleaner ───────────────────────────────────────────
  // Same secondary-app technique, for the same reason: signing the cleaner in
  // on the primary app would log the manager out.
  const registerCleaner = useCallback(async (username, password, hostelCode) => {
    if (!hostelCode) throw new Error('Hostel code is missing.');
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const cleanName = username.trim();
    const key = lookupKey(hostelCode, cleanName);

    // Cheap pre-check for a clearer error. The real guarantee is that
    // create() on the lookup document fails if it already exists.
    const existing = await getDoc(doc(db, 'loginLookup', key));
    if (existing.exists()) {
      throw new Error('Someone in your hostel already uses that name.');
    }

    // Random suffix, not Date.now() — two cleaners created in the same
    // millisecond used to collide.
    const suffix = Math.random().toString(36).slice(2, 10);
    const email = `cleaner_${suffix}_${hostelCode.toLowerCase()}@${EMAIL_DOMAIN}`;

    let secondaryApp;
    let uid;
    try {
      secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      uid = cred.user.uid;
      await firebaseSignOut(secondaryAuth);
    } catch (e) {
      throw new Error(friendlyAuthError(e));
    } finally {
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch (_) { /* ignore */ }
      }
    }

    await setDoc(doc(db, 'users', uid), {
      username: cleanName,
      role: 'cleaner',
      hostelCode,
      email,
    });

    await setDoc(doc(db, 'loginLookup', key), { email, hostelCode });

    return uid;
  }, []);

    // ── Register a manager-side staff account (owner action) ───────
  // Same secondary-app technique as registerCleaner, and for the same reason:
  // creating the account on the primary auth would sign the owner out.
  //
  // Staff use a REAL email address, not a synthetic one. That is what lets them
  // reset their own password through Firebase without a server, and it means
  // they need no loginLookup row — so nothing about them is readable pre-auth.
  const registerStaff = useCallback(
    async ({ username, email, password, roleId, hostelCode }) => {
      if (!hostelCode) throw new Error('Hostel code is missing.');
      if (!roleId) throw new Error('Pick a role for this person.');
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      }

      const cleanName = (username || '').trim();
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanName) throw new Error('Enter a name.');
      if (!isRealEmail(cleanEmail)) {
        throw new Error('Enter a valid email address. It is how they sign in.');
      }

      let secondaryApp;
      let uid;
      try {
        secondaryApp = initializeApp(firebaseConfig, `staff-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        await setPersistence(secondaryAuth, inMemoryPersistence).catch(() => {});
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth, cleanEmail, password,
        );
        uid = cred.user.uid;
        await firebaseSignOut(secondaryAuth);
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      } finally {
        if (secondaryApp) {
          try { await deleteApp(secondaryApp); } catch (_) { /* ignore */ }
        }
      }

      // Written on the PRIMARY db, as the owner — the rules check isOwnerOf().
      await setDoc(doc(db, 'users', uid), {
        username: cleanName,
        role: 'staff',
        roleId,
        hostelCode,
        email: cleanEmail,
      });

      return uid;
    },
    [],
  );

  // ── Move a staff member onto a different role (owner action) ───
  const setStaffRole = useCallback(async (uid, roleId) => {
    if (!roleId || roleId === 'owner') throw new Error('Pick a valid role.');
    await updateDoc(doc(db, 'users', uid), { roleId });
  }, []);

  // ── Remove manager access (owner action) ──────────────────────
  // Their Firestore profile goes; the Firebase Auth account survives because
  // the client SDK can only delete the signed-in user. It is inert — every
  // rule starts by reading users/{uid} — but it stays in the Auth console.
  const deleteStaffAccount = useCallback(async (uid) => {
    await deleteDoc(doc(db, 'users', uid));
  }, []);

  // ── Reset a cleaner's password (manager action) ────────────────
  // The client SDK can only change the CURRENT user's password, so a manager
  // cannot edit a cleaner's credentials directly. This recreates the account
  // and MIGRATES their room assignments to the new uid.
  //
  // The old auth account still exists but is inert: every rule starts by
  // reading users/{uid}, and that document is gone.
  const resetCleanerPassword = useCallback(
    async (cleanerUid, newPassword, hostelCode) => {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      }

      const oldDoc = await getDoc(doc(db, 'users', cleanerUid));
      if (!oldDoc.exists()) throw new Error('That cleaner no longer exists.');
      const { username } = oldDoc.data();

      // 1. Remove the old lookup so the name is free to reuse.
      await deleteDoc(doc(db, 'loginLookup', lookupKey(hostelCode, username)));

      let newUid;
      try {
        newUid = await registerCleaner(username, newPassword, hostelCode);
      } catch (e) {
        // Put the lookup back so the cleaner can still sign in with the old
        // password rather than being locked out entirely.
        await setDoc(doc(db, 'loginLookup', lookupKey(hostelCode, username)), {
          email: oldDoc.data().email,
          hostelCode,
        });
        throw e;
      }

      // 2. Move their rooms across, then drop the old profile.
      const assigned = await getDocs(query(
        collection(db, 'hostels', hostelCode, 'rooms'),
        where('assignedTo', '==', cleanerUid),
      ));

      const batch = writeBatch(db);
      assigned.forEach((d) => batch.update(d.ref, { assignedTo: newUid }));
      batch.delete(doc(db, 'users', cleanerUid));
      await batch.commit();

      return newUid;
    },
    [registerCleaner],
  );

  // ── Change your own password ───────────────────────────────────
  const changeOwnPassword = useCallback(async (currentPassword, newPassword) => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    const current = auth.currentUser;
    if (!current) throw new Error('You are not signed in.');

    try {
      const credential = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, credential);
      await updatePassword(current, newPassword);
    } catch (e) {
      throw new Error(friendlyAuthError(e));
    }
  }, []);

  // ── Forgot password ────────────────────────────────────────────
  // Managers authenticate with a real address, so Firebase's own reset mail
  // reaches them with no server involved. Cleaners have synthetic addresses
  // and no inbox — their manager resets them from the Team screen.
  //
  // Takes the address the person typed. Nothing is read from Firestore, so
  // this cannot be used to discover whether an account exists.
  const requestPasswordReset = useCallback(async (emailInput) => {
    const generic =
      'If that address has a HostelKeep account, a reset link is on its way.';
    const email = (emailInput || '').trim().toLowerCase();

    if (!isRealEmail(email)) return generic;

    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      // user-not-found is expected and must stay invisible to the caller.
      if (!(e?.code || '').includes('user-not-found')) {
        console.warn('Password reset request failed:', e.message);
      }
    }
    return generic;
  }, []);

  // ── Migrate an existing manager onto a real address ────────────
  // One-time, for managers created under the old synthetic scheme. Firebase
  // sends a verification link first; the address only changes once it is
  // clicked, and the auth listener above then clears the stale loginLookup row.
  const migrateManagerEmail = useCallback(async (newEmail, currentPassword) => {
    const email = (newEmail || '').trim().toLowerCase();
    if (!isRealEmail(email)) {
      throw new Error('Enter a valid email address.');
    }
    const current = auth.currentUser;
    if (!current) throw new Error('You are not signed in.');

    try {
      const credential = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, credential);
      await verifyBeforeUpdateEmail(current, email);
    } catch (e) {
      throw new Error(friendlyAuthError(e));
    }

    return `Check ${email} and click the link to confirm. You'll sign in with that address from then on.`;
  }, []);

  const needsEmailMigration = useMemo(
    () => !!user && user.role === 'manager' && !isRealEmail(user.email),
    [user],
  );

    // ── Switch the active hostel ───────────────────────────────────
  const switchHostel = useCallback(async (code) => {
    if (!user?.uid) throw new Error('You are not signed in.');
    if (!user.hostelCodes?.includes(code)) {
      throw new Error('That hostel is not on your account.');
    }
    if (code === user.hostelCode) return;

    await updateDoc(doc(db, 'users', user.uid), { hostelCode: code });
    setUser(prev => ({ ...prev, hostelCode: code }));
  }, [user?.uid, user?.hostelCode, user?.hostelCodes]);

  // ── Add another hostel to this account ─────────────────────────
  const addHostel = useCallback(async (hostelName) => {
    if (!user?.uid) throw new Error('You are not signed in.');
    if (user.role !== 'manager') throw new Error('Only managers can add a hostel.');

    const cleanName = (hostelName || '').trim();
    if (!cleanName) throw new Error('Enter a name for the hostel.');

    const existing = user.hostelCodes || [user.hostelCode];
    const code = await reserveCode(db, user.uid);

    await updateDoc(doc(db, 'users', user.uid), {
      hostelCodes: [...existing, code],
    });

    await setDoc(doc(db, 'hostels', code), {
      name: cleanName,
      code,
      roomAttributes: [],
      createdAt: new Date().toISOString(),
    });

    await updateDoc(doc(db, 'users', user.uid), { hostelCode: code });
    setUser(prev => ({
      ...prev,
      hostelCode: code,
      hostelCodes: [...existing, code],
    }));

    try {
      await sendWelcomeEmail({
        toEmail: user.email,
        managerName: user.username,
        hostelName: cleanName,
        code,
      });
    } catch (e) {
      console.warn('Hostel code email could not be sent:', e.message);
    }

    return code;
  }, [user?.uid, user?.role, user?.email, user?.username, user?.hostelCode, user?.hostelCodes]);

  const logout = useCallback(() => firebaseSignOut(auth), []);

  const updateProfile = useCallback(async (patch) => {
    if (!user?.uid) return;
    await updateDoc(doc(db, 'users', user.uid), patch);
    setUser((prev) => ({ ...prev, ...patch }));
  }, [user?.uid]);

  // Memoized: an unstable value re-runs every consumer's effects on every
  // render of this provider.
  const value = useMemo(() => ({
    user,
    loading,
    needsEmailMigration,
    login,
    logout,
    createHostel,
    registerCleaner,
    resetCleanerPassword,
    changeOwnPassword,
    requestPasswordReset,
    migrateManagerEmail,
    updateProfile,
    switchHostel,
    addHostel,
    registerStaff,
    setStaffRole,
    deleteStaffAccount,
  }), [
    user, loading, needsEmailMigration, login, logout, createHostel,
    registerCleaner, resetCleanerPassword, changeOwnPassword,
    requestPasswordReset, migrateManagerEmail, updateProfile, switchHostel, addHostel, registerStaff,
    setStaffRole,
    deleteStaffAccount,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);