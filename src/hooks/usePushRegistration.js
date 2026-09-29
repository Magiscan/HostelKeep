/**
 * src/hooks/usePushRegistration.js
 *
 * Registers the signed-in user's Expo push token and stores it on their user
 * document.
 *
 * What changed from the previous version:
 *
 *  1. It runs again every time the app comes back to the foreground, but
 *     WITHOUT prompting. So someone who turns notifications on in Android
 *     settings (via the "Notifications are off · Open settings" row in Account)
 *     starts receiving push as soon as they return, with no restart.
 *
 *  2. It only prompts when Android says it still can (`canAskAgain`). After a
 *     "Don't allow" on Android 13+, the system never shows the prompt again, so
 *     asking would do nothing.
 *
 *  3. It only writes to Firestore when the token actually changed for this
 *     user, so foregrounding the app doesn't cost a write every time.
 *
 * The token is removed from the user document on sign-out (see logout in
 * AuthContext), so a shared hostel phone doesn't keep receiving the previous
 * person's notifications.
 */

import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function usePushRegistration(user) {
  // `${uid}:${token}` of the last successful write in this session.
  const writtenRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return undefined;
    // Web push needs a VAPID key and a service worker; out of scope here.
    if (Platform.OS === 'web') return undefined;

    let cancelled = false;

    const register = async (mayPrompt) => {
      try {
        // Simulators and emulators cannot receive push notifications.
        if (!Device.isDevice) return;

        // Create the Android channel BEFORE requesting permission, so the
        // system prompt and any delivered notification are styled correctly.
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#0B1F3A',
          });
        }

        const current = await Notifications.getPermissionsAsync();
        let status = current.status;

        if (status !== 'granted' && mayPrompt && current.canAskAgain !== false) {
          // On Android 13+ this triggers the POST_NOTIFICATIONS prompt.
          const res = await Notifications.requestPermissionsAsync();
          status = res.status;
        }

        // Declining is a normal choice: never nag or block the UI.
        if (status !== 'granted') return;

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;

        if (!projectId) {
          console.warn('No EAS projectId found; skipping push registration.');
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData?.data;
        if (cancelled || !token) return;

        const key = `${user.uid}:${token}`;
        if (writtenRef.current === key) return;

        await setDoc(doc(db, 'users', user.uid), { pushToken: token }, { merge: true });
        writtenRef.current = key;
      } catch (e) {
        // Push is a nice-to-have; never let it break the app.
        console.warn('Push registration failed:', e.message);
      }
    };

    register(true);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') register(false);
    });

    return () => {
      cancelled = true;
      sub.remove();
      // Sign-out clears the token on the server, so the next sign-in (even by
      // the same person) must write it again.
      writtenRef.current = null;
    };
  }, [user?.uid]);
}