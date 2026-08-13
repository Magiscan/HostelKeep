import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, getDocs, writeBatch, getDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

const AppContext = createContext();

/* ─── Push notification helpers (free Expo push) ──────────────── */

async function getManagerTokens(hostelCode) {
  const managersQuery = query(
    collection(db, 'users'),
    where('hostelCode', '==', hostelCode),
    where('role', '==', 'manager')
  );
  const snapshot = await getDocs(managersQuery);
  const tokenSet = new Set();
  snapshot.forEach(doc => {
    const manager = doc.data();
    if (manager.pushToken) tokenSet.add(manager.pushToken);
  });
  return Array.from(tokenSet);
}

async function getCleanerToken(cleanerUid) {
  const cleanerDoc = await getDoc(doc(db, 'users', cleanerUid));
  if (!cleanerDoc.exists()) return null;
  const data = cleanerDoc.data();
  return data.pushToken || null;
}

async function sendPush(tokens, title, body, data) {
  if (!tokens || tokens.length === 0) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: tokens,
      title,
      body,
      data,
    }),
  });
}

async function sendPushToManagers(hostelCode, title, body, data) {
  const tokens = await getManagerTokens(hostelCode);
  await sendPush(tokens, title, body, data);
}

async function sendPushToCleaner(cleanerUid, title, body, data) {
  const token = await getCleanerToken(cleanerUid);
  if (token) await sendPush([token], title, body, data);
}

/* ─── Context provider ─────────────────────────────────────────── */

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(auth?.currentUser ?? null);
  const [extraRequests, setExtraRequests] = useState([]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setCurrentUser(u ?? null));
    return unsub;
  }, []);

  // ── User document ──
  const [userData, setUserData] = useState(null);
  useEffect(() => {
    if (!currentUser) {
      setUserData(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
      else setUserData(null);
    });
    return unsub;
  }, [currentUser]);

  const hostelCode = userData?.hostelCode;

  // ── Hostel data ──
  const [hostel, setHostel] = useState({ name: '', code: '' });
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomStatus, setRoomStatus] = useState({});
  const [cleaners, setCleaners] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [roomAttributes, setRoomAttributes] = useState([]);

  // Reset on user change
  useEffect(() => {
    if (!currentUser) {
      setHostel({ name: '', code: '' });
      setFloors([]);
      setRooms([]);
      setRoomStatus({});
      setCleaners([]);
      setRoomAttributes([]);
      setLoaded(true);
    } else {
      setHostel({ name: '', code: '' });
      setFloors([]);
      setRooms([]);
      setRoomStatus({});
      setCleaners([]);
      setRoomAttributes([]);
      setLoaded(false);
    }
  }, [currentUser]);

  // Listen to hostel data
  useEffect(() => {
    if (!hostelCode) return;

    const unsubHostel = onSnapshot(doc(db, 'hostels', hostelCode), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setHostel(data);
        setRoomAttributes(data.roomAttributes || []);
      }
    });

    const floorsQuery = query(collection(db, 'hostels', hostelCode, 'floors'), orderBy('name'));
    const unsubFloors = onSnapshot(floorsQuery, (snap) => {
      setFloors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const roomsQuery = query(collection(db, 'hostels', hostelCode, 'rooms'), orderBy('name'));
    const unsubRooms = onSnapshot(roomsQuery, (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const statusQuery = collection(db, 'hostels', hostelCode, 'roomStatus');
    const unsubStatus = onSnapshot(statusQuery, (snap) => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data(); });
      setRoomStatus(map);
    });

    const cleanersQuery = query(collection(db, 'users'), where('hostelCode', '==', hostelCode), where('role', '==', 'cleaner'));
    const unsubCleaners = onSnapshot(cleanersQuery, (snap) => {
      setCleaners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const extraReqQuery = collection(db, 'hostels', hostelCode, 'extraRequests');
    const unsubExtraReq = onSnapshot(extraReqQuery, (snap) => {
      setExtraRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    setLoaded(true);

    return () => {
      unsubHostel();
      unsubFloors();
      unsubRooms();
      unsubStatus();
      unsubCleaners();
      unsubExtraReq();
    };
  }, [hostelCode]);

  // ── Write operations (all wrapped in useCallback) ──

  const updateHostel = useCallback((data) => updateDoc(doc(db, 'hostels', hostelCode), data), [hostelCode]);

  const updateRoomAttributes = useCallback(async (newAttributes) => {
    if (!hostelCode) return;
    await updateDoc(doc(db, 'hostels', hostelCode), { roomAttributes: newAttributes });
    setRoomAttributes(newAttributes);
  }, [hostelCode]);

  const addFloor = useCallback(async (name) => {
    try {
      await addDoc(collection(db, 'hostels', hostelCode, 'floors'), { name });
    } catch (error) {
      throw new Error('Failed to add floor: ' + error.message);
    }
  }, [hostelCode]);

  const removeFloor = useCallback(async (floorId) => {
    const roomsQuery = query(collection(db, 'hostels', hostelCode, 'rooms'), where('floorId', '==', floorId));
    const roomSnap = await getDocs(roomsQuery);
    const batch = writeBatch(db);
    roomSnap.forEach(roomDoc => {
      batch.delete(roomDoc.ref);
      const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomDoc.id);
      batch.delete(statusRef);
    });
    await batch.commit();
    await deleteDoc(doc(db, 'hostels', hostelCode, 'floors', floorId));
  }, [hostelCode]);

  const saveRoom = useCallback(async (roomData) => {
    const docRef = doc(db, 'hostels', hostelCode, 'rooms', roomData.id);
    await setDoc(docRef, roomData);
  }, [hostelCode]);

  const deleteRoom = useCallback((roomId) => deleteDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId)), [hostelCode]);

  const updateRoomStatus = useCallback((roomId, newStatus) => {
    const promise = setDoc(doc(db, 'hostels', hostelCode, 'roomStatus', roomId), newStatus, { merge: true });

    // If the room is being marked as cleaned, send push to managers
    if (newStatus.cleaned && hostelCode) {
      const room = rooms.find(r => r.id === roomId);
      const roomName = room?.name || roomId;
      sendPushToManagers(
        hostelCode,
        'Room Cleaned',
        `Room ${roomName} has been marked as cleaned.`,
        { type: 'room_cleaned', roomId }
      ).catch(e => console.warn('Push failed:', e));
    }

    return promise;
  }, [hostelCode, rooms]);

  const resetAllRoomStatus = useCallback(async () => {
    const statusCol = collection(db, 'hostels', hostelCode, 'roomStatus');
    const snap = await getDocs(statusCol);
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }, [hostelCode]);

  const assignRoom = useCallback((roomId, cleanerUid) =>
    updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), { assignedTo: cleanerUid }), [hostelCode]);

  const unassignRoom = useCallback(async (roomId) => {
    if (!hostelCode) return;
    await updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), { assignedTo: null });

    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    await setDoc(statusRef, {
      cleaned: false,
      notes: '',
      extraTime: 0,
      bedStatus: {},
      assignmentBedStatus: {},
      managerNotes: '',
      commonOnly: false,
    }, { merge: true });
  }, [hostelCode]);

  const assignRoomWithDetails = useCallback(async (roomId, cleanerUid, bedAssignments, managerNotes, commonOnly = false, assignmentAttributes = {}, earlyCheckIn = false, lateCheckOut = false) => {
    if (!hostelCode) return;
    await updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), { assignedTo: cleanerUid });
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    await setDoc(statusRef, {
      assignmentBedStatus: bedAssignments,
      managerNotes: managerNotes || '',
      commonOnly,
      assignmentAttributes,
      earlyCheckIn,
      lateCheckOut,
    }, { merge: true });

    // Push notification to the assigned cleaner
    const room = rooms.find(r => r.id === roomId);
    const roomName = room?.name || roomId;
    sendPushToCleaner(
      cleanerUid,
      'New Room Assigned',
      `You have been assigned to room ${roomName}.`,
      { type: 'new_assignment', roomId }
    ).catch(e => console.warn('Push failed:', e));
  }, [hostelCode, rooms]);

  const deleteCleaner = useCallback(async (cleanerId) => {
    await deleteDoc(doc(db, 'users', cleanerId));
    const roomsQuery = query(collection(db, 'hostels', hostelCode, 'rooms'), where('assignedTo', '==', cleanerId));
    const snap = await getDocs(roomsQuery);
    const batch = writeBatch(db);
    snap.forEach(d => batch.update(d.ref, { assignedTo: null }));
    await batch.commit();
  }, [hostelCode]);

  const markExtraRoomCleaning = useCallback(async (roomId, cleanerUid, extraTime, notes) => {
    if (!hostelCode) return;
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    await setDoc(statusRef, {
      extraCleaning: true,
      extraCleaningBy: cleanerUid,
      extraCleaningTime: extraTime || 0,
      extraCleaningNotes: notes || '',
      cleaned: true,
    }, { merge: true });
  }, [hostelCode]);

  const removeExtraRoomCleaning = useCallback(async (roomId) => {
    if (!hostelCode) return;
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    await setDoc(statusRef, {
      extraCleaning: false,
      extraCleaningBy: null,
      extraCleaningTime: 0,
      extraCleaningNotes: '',
      cleaned: false,
    }, { merge: true });
  }, [hostelCode]);

  const markExtraBedCleaning = useCallback(async (roomId, bedId, cleanerUid, extraTime, notes) => {
    if (!hostelCode) return;
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    const statusSnap = await getDoc(statusRef);
    const existing = statusSnap.exists() ? (statusSnap.data().extraBedsCleaning || []) : [];
    
    const filtered = existing.filter(
      entry => !(entry.bedId === bedId && entry.cleanerId === cleanerUid)
    );
    const newEntry = {
      bedId,
      cleanerId: cleanerUid,
      time: extraTime || 0,
      notes: notes || '',
      timestamp: Date.now(),
    };
    await setDoc(statusRef, {
      extraBedsCleaning: [...filtered, newEntry],
    }, { merge: true });
  }, [hostelCode]);

  const removeExtraBedCleaning = useCallback(async (roomId, bedId, cleanerUid) => {
    if (!hostelCode) return;
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    const statusSnap = await getDoc(statusRef);
    if (!statusSnap.exists()) return;
    const existing = statusSnap.data().extraBedsCleaning || [];
    const updated = existing.filter(
      entry => !(entry.bedId === bedId && entry.cleanerId === cleanerUid)
    );
    await setDoc(statusRef, { extraBedsCleaning: updated }, { merge: true });
  }, [hostelCode]);

  const selfAssignExtraRoom = useCallback(async (roomId, cleanerUid) => {
    if (!hostelCode) return;
    const batch = writeBatch(db);
    const roomRef = doc(db, 'hostels', hostelCode, 'rooms', roomId);
    batch.update(roomRef, { assignedTo: cleanerUid });
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    batch.set(statusRef, {
      extraCleaning: true,
      extraCleaningBy: cleanerUid,
      extraCleaningTime: 0,
      extraCleaningNotes: '',
    }, { merge: true });
    await batch.commit();
  }, [hostelCode]);

  const requestExtraRoom = useCallback(async (roomId, cleanerUid, imageBase64 = null) => {
    if (!hostelCode) return;
    const requestRef = doc(db, 'hostels', hostelCode, 'extraRequests', roomId);
    await setDoc(requestRef, {
      cleanerId: cleanerUid,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      imageBase64: imageBase64 || null,
    });

    sendPushToManagers(
      hostelCode,
      'Extra Room Request',
      `Room ${roomId} requested by a cleaner.`,
      { type: 'extra_request', roomId }
    ).catch(e => console.warn('Push failed:', e));
  }, [hostelCode]);

  const approveExtraRoom = useCallback(async (roomId, cleanerUid) => {
    if (!hostelCode) return;
    await updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), { assignedTo: cleanerUid });
    await setDoc(doc(db, 'hostels', hostelCode, 'roomStatus', roomId), {
      extraCleaning: true,
      extraCleaningBy: cleanerUid,
      extraCleaningTime: 0,
      extraCleaningNotes: '',
    }, { merge: true });
    await updateDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId), { status: 'approved' });
  }, [hostelCode]);

  const rejectExtraRoom = useCallback(async (roomId) => {
    if (!hostelCode) return;
    await updateDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId), { status: 'rejected' });
  }, [hostelCode]);

  const cancelExtraRoomRequest = useCallback(async (roomId) => {
    if (!hostelCode) return;
    await deleteDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId));
  }, [hostelCode]);

  const cleanupOldExtraRequests = useCallback(async () => {
    if (!hostelCode) return;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const q = query(
      collection(db, 'hostels', hostelCode, 'extraRequests'),
      where('status', 'in', ['approved', 'rejected'])
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.imageBase64 && data.requestedAt) {
        const age = now - new Date(data.requestedAt).getTime();
        if (age > twentyFourHours) {
          batch.update(docSnap.ref, { imageBase64: null });
        }
      }
    });
    await batch.commit();
  }, [hostelCode]);

  // Check if a daily log already exists for a given date
  const dailyLogExists = async (date) => {
    if (!hostelCode) return false;
    const snap = await getDoc(doc(db, 'hostels', hostelCode, 'dailyLogs', date));
    return snap.exists();
  };

  // Save a snapshot of today’s work
  const saveDailyLog = useCallback(async () => {
    if (!hostelCode) return;

    const today = new Date().toISOString().slice(0, 10);
    const cleanerNameMap = {};
    cleaners.forEach(c => { cleanerNameMap[c.id] = c.username; });

    const cleanerMap = {};
    rooms.forEach(room => {
      if (!room.assignedTo) return;
      const status = roomStatus[room.id] || {};
      const cleanerId = room.assignedTo;
      if (!cleanerMap[cleanerId]) {
        cleanerMap[cleanerId] = {
          cleanerName: cleanerNameMap[cleanerId] || cleanerId,
          rooms: [],
        };
      }
      cleanerMap[cleanerId].rooms.push({
        roomId: room.id,
        roomName: room.name,
        cleaned: status.cleaned || false,
        notes: status.notes || '',
        extraTime: status.extraTime || 0,
        bedStatus: status.bedStatus || {},
        assignmentBedStatus: status.assignmentBedStatus || {},
        managerNotes: status.managerNotes || '',
        commonOnly: status.commonOnly || false,
        assignmentAttributes: status.assignmentAttributes || {},
        extraCleaning: status.extraCleaning || false,
      });
    });

    await setDoc(doc(db, 'hostels', hostelCode, 'dailyLogs', today), {
      date: today,
      cleaners: cleanerMap,
      savedAt: new Date().toISOString(),
    });
  }, [hostelCode, rooms, roomStatus, cleaners]);

  // ── Memoised context value ──
  const contextValue = useMemo(() => ({
    loaded,
    hostel,
    floors,
    rooms,
    roomStatus,
    cleaners,
    hostelCode,
    roomAttributes,
    updateHostel,
    addFloor,
    removeFloor,
    saveRoom,
    deleteRoom,
    updateRoomStatus,
    resetAllRoomStatus,
    assignRoom,
    unassignRoom,
    assignRoomWithDetails,
    updateRoomAttributes,
    deleteCleaner,
    markExtraRoomCleaning,
    removeExtraRoomCleaning,
    markExtraBedCleaning,
    removeExtraBedCleaning,
    selfAssignExtraRoom,
    requestExtraRoom,
    approveExtraRoom,
    rejectExtraRoom,
    extraRequests,
    cancelExtraRoomRequest,
    cleanupOldExtraRequests,
    dailyLogExists,
    saveDailyLog,
  }), [
    loaded,
    hostel,
    floors,
    rooms,
    roomStatus,
    cleaners,
    hostelCode,
    roomAttributes,
    updateHostel,
    addFloor,
    removeFloor,
    saveRoom,
    deleteRoom,
    updateRoomStatus,
    resetAllRoomStatus,
    assignRoom,
    unassignRoom,
    assignRoomWithDetails,
    updateRoomAttributes,
    deleteCleaner,
    markExtraRoomCleaning,
    removeExtraRoomCleaning,
    markExtraBedCleaning,
    removeExtraBedCleaning,
    selfAssignExtraRoom,
    requestExtraRoom,
    approveExtraRoom,
    rejectExtraRoom,
    extraRequests,
    cancelExtraRoomRequest,
    cleanupOldExtraRequests,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);