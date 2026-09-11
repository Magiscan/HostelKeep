import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from './AppContext';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, doc, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { userData, hostelCode } = useApp();
  const [notifications, setNotifications] = useState([]);

  // Real‑time listener + 24‑hour cleanup
  useEffect(() => {
    if (!hostelCode) return;

    const q = query(
      collection(db, 'hostels', hostelCode, 'notifications'),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // FIXED: a malformed timestamp yielded NaN. `now - NaN < 24h` is false,
      // so the row fell through to `stale` below and got DELETED immediately.
      // Unparseable timestamps are now treated as fresh, not ancient.
      const ageOf = (d) => {
        if (!d.timestamp) return 0;
        const ms = new Date(d.timestamp).getTime();
        return Number.isFinite(ms) ? now - ms : 0;
      };

      const validDocs = docs.filter(d => ageOf(d) < twentyFourHours);

      setNotifications(validDocs);

      const stale = docs.filter(d => ageOf(d) >= twentyFourHours);

      if (stale.length > 0 && userData?.role === 'manager') {
        const batch = writeBatch(db);
        stale.forEach(d => {
          batch.delete(doc(db, 'hostels', hostelCode, 'notifications', d.id));
        });
        batch.commit().catch(console.warn);
      }
    });

    return unsub;
  }, [hostelCode]);

  // Actions
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id) => {
    if (!hostelCode) return;
    const ref = doc(db, 'hostels', hostelCode, 'notifications', id);
    await updateDoc(ref, { read: true });
  };

  const clearAll = async () => {
    if (!hostelCode) return;
    if (userData?.role !== 'manager') return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'hostels', hostelCode, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  // Delete all notifications permanently
  const deleteAllNotifications = async () => {
    if (!hostelCode) return;
    if (userData?.role !== 'manager') return;
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'hostels', hostelCode, 'notifications', n.id));
    });
    await batch.commit();
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, clearAll, deleteAllNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);