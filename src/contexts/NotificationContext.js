import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from './AppContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { roomStatus, extraRequests, rooms, cleaners } = useApp();
  const [notifications, setNotifications] = useState([]);
  const prevStatusRef = useRef({});
  const prevExtraRef = useRef([]);

  // Helper to add a notification
  const addNotification = useCallback(({ type, message, roomId }) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    setNotifications(prev => [
      { id, type, message, roomId, read: false, timestamp: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  // Watch roomStatus for cleaned, notes, extraTime changes
  useEffect(() => {
    if (!roomStatus || Object.keys(roomStatus).length === 0) return;
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
    prevStatusRef.current = { ...roomStatus };
  }, [roomStatus, rooms, cleaners, addNotification]);

  // Watch extraRequests for new requests
  useEffect(() => {
    if (!extraRequests) return;
    const prev = prevExtraRef.current;
    const newReqs = extraRequests.filter(req => !prev.some(p => p.id === req.id && p.status === req.status));
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
  }, [extraRequests, rooms, cleaners, addNotification]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearAll = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);