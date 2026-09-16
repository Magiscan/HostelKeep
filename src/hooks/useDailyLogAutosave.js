// src/hooks/useDailyLogAutosave.js
//
// Thin React/Firebase wrapper around createDailyLogAutosaver (see
// src/utils/dailyLog.js for how and when a day gets saved).
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { createDailyLogAutosaver } from '../utils/dailyLog';

export function useDailyLogAutosave({
  enabled, ready, hostelCode, hostelName,
  rooms, roomStatus, cleaners, floors, extraRequests,
}) {
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState(null);

  const saverRef = useRef(null);
  if (!saverRef.current) {
    saverRef.current = createDailyLogAutosaver({
      readLog: async (code, date) => {
        const snap = await getDoc(doc(db, 'hostels', code, 'dailyLogs', date));
        return snap.exists() ? snap.data() : null;
      },
      writeLog: (code, docId, log) =>
        setDoc(doc(db, 'hostels', code, 'dailyLogs', docId), {
          ...log,
          savedAt: new Date().toISOString(),
        }),
      onSaved: () => {
        setLastSavedAt(Date.now());
        setError(null);
      },
      onError: (e) => {
        const msg = typeof e === 'string' ? e : (e?.code || e?.message || 'unknown');
        console.warn('[daily log autosave]', msg);
        setError(msg);
      },
    });
  }

  useEffect(() => {
    saverRef.current.update({
      enabled, ready, hostelCode, hostelName,
      rooms, roomStatus, cleaners, floors, extraRequests,
    });
  }, [enabled, ready, hostelCode, hostelName, rooms, roomStatus, cleaners, floors, extraRequests]);

  // Save whatever is pending when the app goes to the background, the tab is
  // hidden, or the page is closed. Best effort — a closing tab may not finish.
  useEffect(() => {
    const flush = () => saverRef.current.flush();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    let removeWeb = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('pagehide', flush);
      removeWeb = () => window.removeEventListener('pagehide', flush);
    }
    return () => {
      sub?.remove?.();
      removeWeb?.();
      saverRef.current.dispose();
    };
  }, []);

  const closeDayBeforeWipe = useCallback(
    (reason, roomIds = null) => saverRef.current.closeBeforeWipe(reason, roomIds),
    [],
  );

  return { lastSavedAt, error, closeDayBeforeWipe };
}