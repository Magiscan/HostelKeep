import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  getAuth,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { auth, db, firebaseConfig } from '../firebase';

const AuthContext = createContext();

const EMAIL_DOMAIN = 'hostelkeep.app';
export const MIN_PASSWORD_LENGTH = 8;

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
  if (code.includes('too-many-requests'))
    return 'Too many failed attempts. Please wait a few minutes.';
  if (code.includes('network-request-failed'))
    return 'Network error. Check your internet connection.';
  if (code.includes('email-already-in-use'))
    return 'That account already exists.';
  if (code.includes('weak-password'))
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
          // no longer write. The old fallback defaulted unknown users to
          // role:'manager' — a privilege escalation waiting to happen.
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: data.username,
            role: data.role,
            hostelCode: data.hostelCode,
            recoveryEmail: data.recoveryEmail || null,
          });
        } else {
          // An authenticated account with no profile can read and write
          // nothing under the new rules. Sign out rather than guess a role.
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
  // Reads ONE loginLookup document by exact ID. The `users` collection is no
  // longer readable before sign-in.
  const login = useCallback(async (username, password, hostelCode) => {
    let email;
    try {
      const snap = await getDoc(doc(db, 'loginLookup', lookupKey(hostelCode, username)));
      if (!snap.exists()) throw new Error('Invalid username or hostel code.');
      email = snap.data().email;
      if (!email) throw new Error('Invalid username or hostel code.');
    } catch (e) {
      throw new Error(e.message.startsWith('Invalid') ? e.message : friendlyAuthError(e));
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      throw new Error(friendlyAuthError(e));
    }
  }, []);

  // ── Create a hostel + its manager ──────────────────────────────
  // Write order matters, because the rules depend on it:
  //   1. users/{uid}   — allowed only while the hostel does NOT exist
  //   2. loginLookup   — needs the users doc to prove manager status
  //   3. hostels/{code}— needs the users doc to name this exact code
  const createHostel = useCallback(
    async ({ hostelName, username, password, recoveryEmail }) => {
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      }

      // Find a free code. Without a server we can't read the hostels list, so
      // rely on create() failing if the document already exists.
      const code = generateCode();
      const email = `manager_${code.toLowerCase()}@${EMAIL_DOMAIN}`;
      const cleanName = username.trim();
      const cleanRecovery = (recoveryEmail || '').trim();

      let cred;
      try {
        cred = await createUserWithEmailAndPassword(auth, email, password);
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      }

      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          username: cleanName,
          role: 'manager',
          hostelCode: code,
          email,
          ...(cleanRecovery ? { recoveryEmail: cleanRecovery } : {}),
        });

        await setDoc(doc(db, 'loginLookup', lookupKey(code, cleanName)), {
          email,
          hostelCode: code,
          ...(cleanRecovery ? { recoveryEmail: cleanRecovery } : {}),
        });

        await setDoc(doc(db, 'hostels', code), {
          name: hostelName.trim(),
          code,
          roomAttributes: [],
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Hostel setup failed:', e.message);
        throw new Error(
          'Your account was created but hostel setup failed. ' +
          'Please contact support before trying again.',
        );
      }

      return code;
    },
    [],
  );

  // ── Register cleaner ───────────────────────────────────────────
  // On Spark there is no Admin SDK, so account creation uses a secondary
  // Firebase app. That keeps the manager's own session intact — signing the
  // cleaner in on the primary app would log the manager out.
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

  // ── Reset a cleaner's password (manager action) ────────────────
  // The client SDK can only change the CURRENT user's password, so on Spark a
  // manager cannot edit a cleaner's credentials directly. This recreates the
  // account and MIGRATES their room assignments to the new uid — the old code
  // silently orphaned every assignedTo reference and left the previous auth
  // account alive with a working password.
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
  // Works for anyone who knows their current password, and needs no server.
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
  // Only works when a real recovery email is on file — synthetic
  // @keepclean.app addresses cannot receive mail. Managers should always set
  // one: without it, a forgotten manager password is unrecoverable on Spark.
  const requestPasswordReset = useCallback(async (username, hostelCode) => {
    const generic =
      'If a recovery email is on file for that account, a reset link has been sent.';
    try {
      const snap = await getDoc(doc(db, 'loginLookup', lookupKey(hostelCode, username)));
      if (snap.exists()) {
        const recovery = snap.data().recoveryEmail;
        if (recovery && !recovery.endsWith(`@${EMAIL_DOMAIN}`)) {
          await sendPasswordResetEmail(auth, recovery);
        }
      }
    } catch (e) {
      console.warn('Password reset request failed:', e.message);
    }
    // Same answer either way, so this can't be used to test whether an
    // account exists.
    return generic;
  }, []);

  const logout = useCallback(() => firebaseSignOut(auth), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        createHostel,
        registerCleaner,
        resetCleanerPassword,
        changeOwnPassword,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);