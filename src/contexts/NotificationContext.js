import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from './AppContext';
import {
  collection, query, orderBy, onSnapshot,
  updateDoc, doc, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { isManagerSide } from '../utils/permissions';

const NotificationContext = createContext();

// Firestore caps a batch at 500 writes. The 24-hour window makes overflow
// unlikely, but a busy hostel that hasn't had a manager sign in for a while can
// get there, and a rejected batch would take the whole cleanup with it.
const CHUNK = 400;

async function commitInChunks(refs, apply) {
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK).forEach(ref => apply(batch, ref));
    await batch.commit();
  }
}

export function NotificationProvider({ children }) {
  const { userData, hostelCode } = useApp();
  const [notifications, setNotifications] = useState([]);

  // Owner or staff. Cleaners can create notifications but never mark them read
  // or delete them — the rules used to let a cleaner wipe the manager's entire
  // inbox, and the client should not be offering an action the backend rejects.
  const managerSide = isManagerSide(userData);

  // Real-time listener + 24-hour cleanup
  useEffect(() => {
    if (!hostelCode) return undefined;

    const q = query(
      collection(db, 'hostels', hostelCode, 'notifications'),
      orderBy('timestamp', 'desc'),
    );

    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // A malformed timestamp yielded NaN. `now - NaN < 24h` is false, so the
        // row fell through to `stale` below and got DELETED immediately.
        // Unparseable timestamps are treated as fresh, not ancient.
        const ageOf = (d) => {
          if (!d.timestamp) return 0;
          const ms = new Date(d.timestamp).getTime();
          return Number.isFinite(ms) ? now - ms : 0;
        };

        setNotifications(docs.filter(d => ageOf(d) < twentyFourHours));

        const stale = docs.filter(d => ageOf(d) >= twentyFourHours);
        if (stale.length > 0 && managerSide) {
          commitInChunks(
            stale.map(d => doc(db, 'hostels', hostelCode, 'notifications', d.id)),
            (batch, ref) => batch.delete(ref),
          ).catch(e => console.warn('Notification cleanup failed:', e.code || e.message));
        }
      },
      // Without this a denial throws out of the listener and takes the provider
      // down with it, which is how a staff sign-in ends up stuck on a spinner.
      (e) => {
        console.warn('notifications listener stopped:', e.code);
        setNotifications([]);
      },
    );
    // managerSide belongs here: it starts false while the user document loads,
    // and the effect has to re-run once it resolves or cleanup never happens.
  }, [hostelCode, managerSide]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  );

  const markAsRead = useCallback(async (id) => {
    if (!hostelCode || !managerSide) return;
    await updateDoc(doc(db, 'hostels', hostelCode, 'notifications', id), { read: true });
  }, [hostelCode, managerSide]);

  const clearAll = useCallback(async () => {
    if (!hostelCode || !managerSide) return;
    const refs = notifications
      .filter(n => !n.read)
      .map(n => doc(db, 'hostels', hostelCode, 'notifications', n.id));
    await commitInChunks(refs, (batch, ref) => batch.update(ref, { read: true }));
  }, [hostelCode, managerSide, notifications]);

  const deleteAllNotifications = useCallback(async () => {
    if (!hostelCode || !managerSide) return;
    const refs = notifications.map(
      n => doc(db, 'hostels', hostelCode, 'notifications', n.id),
    );
    await commitInChunks(refs, (batch, ref) => batch.delete(ref));
  }, [hostelCode, managerSide, notifications]);

  // Memoised: an unstable value re-runs every consumer's effects on every
  // render of this provider.
  const value = useMemo(() => ({
    notifications,
    unreadCount,
    canManage: managerSide,
    markAsRead,
    clearAll,
    deleteAllNotifications,
  }), [notifications, unreadCount, managerSide, markAsRead, clearAll, deleteAllNotifications]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);