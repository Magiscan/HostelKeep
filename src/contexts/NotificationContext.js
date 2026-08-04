import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from './AppContext';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, doc, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { roomStatus, extraRequests, rooms, cleaners, hostelCode } = useApp();
  const [notifications, setNotifications] = useState([]);

  const initializedStatus = useRef(false);
  const initializedExtra = useRef(false);
  const prevStatusRef = useRef({});
  const prevExtraRef = useRef([]);

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

      const validDocs = docs.filter(d => {
        const timestamp = d.timestamp ? new Date(d.timestamp).getTime() : 0;
        return now - timestamp < twentyFourHours;
      });

      setNotifications(validDocs);

      const stale = docs.filter(d => {
        const timestamp = d.timestamp ? new Date(d.timestamp).getTime() : 0;
        return now - timestamp >= twentyFourHours;
      });

      if (stale.length > 0) {
        const batch = writeBatch(db);
        stale.forEach(d => {
          batch.delete(doc(db, 'hostels', hostelCode, 'notifications', d.id));
        });
        batch.commit().catch(console.warn);
      }
    });

    return unsub;
  }, [hostelCode]);

  // Add a notification document (deduplication)
  const addNotification = useCallback(async ({ type, message, roomId }) => {
    if (!hostelCode) return;

    const existing = notifications.find(
      n => n.roomId === roomId && n.type === type && !n.read
    );
    if (existing) return;

    await addDoc(collection(db, 'hostels', hostelCode, 'notifications'), {
      type,
      message,
      roomId,
      read: false,
      timestamp: new Date().toISOString(),
    });
  }, [hostelCode, notifications]);

  // Watch roomStatus
  useEffect(() => {
    if (!hostelCode || Object.keys(roomStatus).length === 0) return;

    if (!initializedStatus.current) {
      prevStatusRef.current = JSON.parse(JSON.stringify(roomStatus));
      initializedStatus.current = true;
      return;
    }

    const prev = prevStatusRef.current;
    Object.keys(roomStatus).forEach(roomId => {
      const old = prev[roomId] || {};
      const cur = roomStatus[roomId];
      const room = rooms.find(r => r.id === roomId);
      const cleaner = room?.assignedTo ? cleaners.find(c => c.id === room.assignedTo) : null;

      if (cur.cleaned && !old.cleaned) {
        addNotification({
          type: 'room_cleaned',
          message: `Room ${room?.name || roomId} cleaned by ${cleaner?.username || 'a cleaner'}`,
          roomId,
        });
      }

      if (cur.notes && cur.notes !== old.notes) {
        addNotification({
          type: 'note_added',
          message: `Note added to room ${room?.name || roomId}: "${cur.notes.substring(0, 50)}${cur.notes.length > 50 ? '…' : ''}"`,
          roomId,
        });
      }

      if ((cur.extraTime || 0) > (old.extraTime || 0)) {
        addNotification({
          type: 'extra_time',
          message: `Extra time requested for room ${room?.name || roomId}: +${cur.extraTime} min`,
          roomId,
        });
      }
    });
    prevStatusRef.current = JSON.parse(JSON.stringify(roomStatus));
  }, [roomStatus, rooms, cleaners, hostelCode, addNotification]);

  // Watch extraRequests
  useEffect(() => {
    if (!hostelCode || !extraRequests) return;

    if (!initializedExtra.current) {
      // First snapshot – just remember the current state, no notifications
      prevExtraRef.current = [...extraRequests];
      initializedExtra.current = true;
      return;
    }

    const prev = prevExtraRef.current;

    // Ignore the transition from empty → filled (initial load after context populated)
    if (prev.length === 0 && extraRequests.length > 0) {
      prevExtraRef.current = [...extraRequests];
      return;
    }

    // Only notify for brand‑new request IDs (ignore status changes)
    const newReqs = extraRequests.filter(
      req => !prev.some(p => p.id === req.id)
    );

    newReqs.forEach(req => {
      const room = rooms.find(r => r.id === req.id);
      const cleaner = cleaners.find(c => c.id === req.cleanerId);
      addNotification({
        type: 'extra_request',
        message: `Extra room requested by ${cleaner?.username || 'unknown'} for room ${room?.name || req.id}`,
        roomId: req.id,
      });
    });

    prevExtraRef.current = [...extraRequests];
  }, [extraRequests, rooms, cleaners, hostelCode, addNotification]);

  // Actions
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id) => {
    if (!hostelCode) return;
    const ref = doc(db, 'hostels', hostelCode, 'notifications', id);
    await updateDoc(ref, { read: true });
  };

  const clearAll = async () => {
    if (!hostelCode) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'hostels', hostelCode, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  // Delete all notifications permanently
  const deleteAllNotifications = async () => {
    if (!hostelCode) return;
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