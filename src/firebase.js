import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFunctions } from 'firebase/functions';

export const firebaseConfig = {
  apiKey: "AIzaSyAh-oZKaZipoYjXiyXM8oEYgakBYnZUJ5I",
  authDomain: "keepclean-hostel.firebaseapp.com",
  projectId: "keepclean-hostel",
  storageBucket: "keepclean-hostel.firebasestorage.app",
  messagingSenderId: "794054195007",
  appId: "1:794054195007:web:90120b4c458144dba9058a",
  measurementId: "G-M61YXEDZ0Y"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

if (typeof window !== 'undefined') {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LftqUQtAAAAAAhUgAk2UqIG50xE3VNRYBbzUsdD'),
    isTokenAutoRefreshEnabled: true,
  });
}