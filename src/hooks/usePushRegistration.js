/**
 * src/hooks/usePushRegistration.js
 *
 * Registers the signed-in user's Expo push token and stores it on their user
 * document.
 *
 * Fixes two problems in the previous code:
 *
 *  1. getExpoPushTokenAsync() was called with NO projectId. That works in Expo
 *     Go, which can infer one, but THROWS in production EAS builds — so push
 *     registration failed on exactly the builds you ship.
 *
 *  2. Cleaners never registered a token at all (CleanerScreen had no
 *     registration code), so approve/reject notifications had no recipient.
 *
 * Android 13+ (API 33) also requires the POST_NOTIFICATIONS runtime
 * permission, which requestPermissionsAsync handles — but the channel must be
 * created first or the prompt looks bare.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function usePushRegistration(user) {
  useEffect(() => {
    if (!user?.uid) return;
    // Web push needs a VAPID key and a service worker; out of scope here.
    if (Platform.OS === 'web') return;

    let cancelled = false;

    (async () => {
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

        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;

        if (existing !== 'granted') {
          // On Android 13+ this triggers the POST_NOTIFICATIONS prompt.
          const res = await Notifications.requestPermissionsAsync();
          status = res.status;
        }

        // Declining is a normal choice — never nag or block the UI.
        if (status !== 'granted') return;

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;

        if (!projectId) {
          console.warn('No EAS projectId found; skipping push registration.');
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled || !tokenData?.data) return;

        await setDoc(
          doc(db, 'users', user.uid),
          { pushToken: tokenData.data },
          { merge: true },
        );
      } catch (e) {
        // Push is a nice-to-have; never let it break the app.
        console.warn('Push registration failed:', e.message);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.uid]);
}