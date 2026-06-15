import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAh-oZKaZipoYjXiyXM8oEYgakBYnZUJ5I",
  authDomain: "keepclean-hostel.firebaseapp.com",
  projectId: "keepclean-hostel",
  storageBucket: "keepclean-hostel.firebasestorage.app",
  messagingSenderId: "794054195007",
  appId: "1:794054195007:web:90120b4c458144dba9058a",
  measurementId: "G-M61YXEDZ0Y"
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);
export { auth };