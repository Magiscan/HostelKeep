import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, query, where, getDocs, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

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
            setUser({ ...firebaseUser, username: firebaseUser.email, role: 'manager', hostelCode: '' });
          }
        } catch (e) {
          console.warn('Could not load user document:', e.message);
          setUser({ ...firebaseUser, username: firebaseUser.email, role: 'manager', hostelCode: '' });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (username, password, hostelCode) => {
    const q = query(collection(db, 'users'), where('username', '==', username), where('hostelCode', '==', hostelCode));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Invalid username or hostel code.');
    const userData = snap.docs[0].data();
    if (!userData.email) throw new Error('User account is incomplete. Contact manager.');
    await signInWithEmailAndPassword(auth, userData.email, password);
  };

  const registerManager = async (username, password, hostelCode) => {
    const email = `manager_${hostelCode}@keepclean.app`;
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', userCred.user.uid), {
      username,
      role: 'manager',
      hostelCode,
      email,
    });
    return userCred;
  };

  const registerCleaner = async (username, password, hostelCode) => {
    if (!hostelCode) throw new Error('Hostel code is missing.');
    const apiKey = auth.app.options.apiKey;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
    const email = `cleaner_${Date.now().toString(36)}_${hostelCode}@keepclean.app`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Failed to create cleaner.');
    const uid = data.localId;
    await setDoc(doc(db, 'users', uid), {
      username: username.trim(),
      role: 'cleaner',
      hostelCode,
      email,
    });
  };

  const logout = () => firebaseSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerManager, registerCleaner }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);