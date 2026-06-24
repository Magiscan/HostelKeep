import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  initializeAuth,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, query, where, getDocs, collection,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { auth, db, firebaseConfig } from '../firebase';

const AuthContext = createContext();

// ── Friendly error messages ────────────────────────────────────
function friendlyAuthError(e) {
  const code = e?.code || '';
  if (code.includes('wrong-password') || code.includes('invalid-credential'))
    return 'Incorrect password. Please try again.';
  if (code.includes('user-not-found'))
    return 'No account found with those details.';
  if (code.includes('too-many-requests'))
    return 'Too many failed attempts. Please wait a few minutes.';
  if (code.includes('network-request-failed'))
    return 'Network error. Check your internet connection.';
  if (code.includes('email-already-in-use'))
    return 'A cleaner with this name already exists.';
  return e.message || 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ ...firebaseUser, ...userDoc.data() });
          } else {
            setUser({
              ...firebaseUser,
              username: firebaseUser.email,
              role: 'manager',
              hostelCode: '',
            });
          }
        } catch (e) {
          console.warn('Could not load user document:', e.message);
          setUser({
            ...firebaseUser,
            username: firebaseUser.email,
            role: 'manager',
            hostelCode: '',
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ── Login ──────────────────────────────────────────────────────
  const login = async (username, password, hostelCode) => {
    const q = query(
      collection(db, 'users'),
      where('username', '==', username),
      where('hostelCode', '==', hostelCode),
    );
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Invalid username or hostel code.');
    const userData = snap.docs[0].data();
    if (!userData.email)
      throw new Error('User account is incomplete. Contact your manager.');
    try {
      await signInWithEmailAndPassword(auth, userData.email, password);
    } catch (e) {
      throw new Error(friendlyAuthError(e));
    }
  };

  // ── Register manager ───────────────────────────────────────────
  const registerManager = async (username, password, hostelCode) => {
    const email = `manager_${hostelCode.toLowerCase()}@keepclean.app`;
    let userCred;
    try {
      userCred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) {
      throw new Error(friendlyAuthError(e));
    }
    await setDoc(doc(db, 'users', userCred.user.uid), {
      username,
      role: 'manager',
      hostelCode,
      email,
    });
    return userCred;
  };

  // ── Register cleaner ───────────────────────────────────────────
  const registerCleaner = async (username, password, hostelCode) => {
    if (!hostelCode) throw new Error('Hostel code is missing.');

    const email = `cleaner_${Date.now().toString(36)}_${hostelCode.toLowerCase()}@keepclean.app`;

    let secondaryApp;
    let uid;
    try {
      const secondaryAppName = `secondary-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = initializeAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      uid = cred.user.uid;
      await firebaseSignOut(secondaryAuth);
    } catch (e) {
      throw new Error(friendlyAuthError(e));
    } finally {
      if (secondaryApp) {
        try { await secondaryApp.delete(); } catch (_) {}
      }
    }

    await setDoc(doc(db, 'users', uid), {
      username: username.trim(),
      role: 'cleaner',
      hostelCode,
      email,
    });
  };

  // ── Logout ─────────────────────────────────────────────────────
  const logout = () => firebaseSignOut(auth);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, registerManager, registerCleaner }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);