// src/components/PushDiagnostics.js
//
// On-device push checks for PREVIEW builds, for when adb isn't available.
// Shown only when EXPO_PUBLIC_DIAGNOSTICS=1 (set in eas.json → build.preview.env),
// so production builds never include it in the UI.
//
// What it answers, in order:
//   1. Is this a real device, and is notification permission granted?
//   2. Does the "default" Android channel exist with high importance?
//   3. Can the app get an Expo push token at all? (If google-services.json never
//      reached the EAS build, this is where "FirebaseApp is not initialized" shows.)
//   4. Does users/{uid}.pushToken in Firestore match this device's token?
//   5. Test push to THIS phone, sent after 8 s so you can leave the app first,
//      then the Expo receipt, which is where InvalidCredentials (FCM V1 key
//      missing on the EAS project) is reported.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { sendSentryTestEvent } from '../services/sentry';

export const SHOW_DIAGNOSTICS = process.env.EXPO_PUBLIC_DIAGNOSTICS === '1';

const IMPORTANCE = ['unspecified', 'none', 'min', 'low', 'default', 'high', 'max'];

export default function PushDiagnostics() {
  const [lines, setLines] = useState([]);
  const [token, setToken] = useState(null);
  const [ticketId, setTicketId] = useState(null);
  const [busy, setBusy] = useState(false);

  const log = (ok, text) => setLines((l) => [...l, { ok, text }]);

  const runChecks = async () => {
    setBusy(true);
    setLines([]);
    try {
      log(Device.isDevice, `Real device: ${Device.isDevice} (${Device.manufacturer} ${Device.modelName}, Android ${Device.osVersion})`);

      const perm = await Notifications.getPermissionsAsync();
      log(perm.status === 'granted', `Permission: ${perm.status}, canAskAgain: ${perm.canAskAgain}`);

      if (Platform.OS === 'android') {
        const ch = await Notifications.getNotificationChannelAsync('default');
        log(!!ch && ch.importance >= 5,
          ch ? `Channel "default": importance ${IMPORTANCE[ch.importance] || ch.importance}` : 'Channel "default" missing');
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      log(!!projectId, `EAS projectId: ${projectId || 'MISSING'}`);

      let live = null;
      try {
        live = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        log(true, `Device token: ${live}`);
      } catch (e) {
        log(false, `Token request failed: ${e.message}`);
      }
      setToken(live);

      const uid = auth.currentUser?.uid;
      if (uid) {
        const snap = await getDoc(doc(db, 'users', uid));
        const stored = snap.data()?.pushToken;
        log(!!stored && stored === live,
          stored ? `Firestore token ${stored === live ? 'matches' : 'DIFFERS from'} this device` : 'Firestore: no pushToken on your user');
      }
    } catch (e) {
      log(false, `Unexpected: ${e.message}`);
    }
    setBusy(false);
  };

  const sendTest = async () => {
    if (!token) return;
    log(true, 'Sending in 8 s. Go to the home screen now.');
    setTimeout(async () => {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            to: token, title: 'HostelKeep test', body: 'If you see this, push works.',
            sound: 'default', channelId: 'default', priority: 'high',
          }),
        });
        const t = (await res.json())?.data;
        if (t?.status === 'ok') {
          setTicketId(t.id);
          log(true, `Ticket ok: ${t.id}. Tap "Check receipt" in ~15 s.`);
        } else {
          log(false, `Ticket error: ${t?.details?.error || t?.message || JSON.stringify(t)}`);
        }
      } catch (e) {
        log(false, `Send failed: ${e.message}`);
      }
    }, 8000);
  };

  const checkReceipt = async () => {
    if (!ticketId) return;
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids: [ticketId] }),
      });
      const r = (await res.json())?.data?.[ticketId];
      if (!r) log(false, 'Receipt not ready yet. Try again in a few seconds.');
      else if (r.status === 'ok') log(true, 'Receipt ok: Google accepted it. If nothing showed, it is the phone settings.');
      else log(false, `Receipt error: ${r.details?.error || ''} ${r.message || ''}`);
    } catch (e) {
      log(false, `Receipt check failed: ${e.message}`);
    }
  };

  return (
    <View style={s.box}>
      <Text style={s.title}>Push diagnostics (preview only)</Text>
      <View style={s.row}>
        <Btn label={busy ? 'Checking…' : 'Run checks'} onPress={runChecks} disabled={busy} />
        <Btn label="Send test push" onPress={sendTest} disabled={!token} />
        <Btn label="Check receipt" onPress={checkReceipt} disabled={!ticketId} />
        <Btn
          label="Send Sentry test event"
          onPress={() => {
            sendSentryTestEvent();
            log(true, 'Sentry test event sent: check Issues in Sentry');
          }}
        />
      </View>
      {lines.map((l, i) => (
        <Text key={i} selectable style={[s.line, { color: l.ok ? '#1E7B4A' : '#C43D3D' }]}>
          {l.ok ? '✓' : '✗'} {l.text}
        </Text>
      ))}
    </View>
  );
}

function Btn({ label, onPress, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[s.btn, disabled && { opacity: 0.4 }]}>
      <Text style={s.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  box: { margin: 18, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#DCE2EA', backgroundColor: '#fff' },
  title: { fontWeight: '600', fontSize: 15, marginBottom: 10, color: '#0B1F3A' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  btn: { backgroundColor: '#0B1F3A', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  line: { fontSize: 12.5, marginVertical: 2 },
});