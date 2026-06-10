import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, getDocs, writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

const AppContext = createContext();

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

  // NEW: customisable room attributes per hostel
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

  // ── Write operations ──
  const updateHostel = (data) => updateDoc(doc(db, 'hostels', hostelCode), data);

  const updateRoomAttributes = async (newAttributes) => {
    if (!hostelCode) return;
    await updateDoc(doc(db, 'hostels', hostelCode), { roomAttributes: newAttributes });
    setRoomAttributes(newAttributes);
  };

  const addFloor = async (name) => {
    try {
      await addDoc(collection(db, 'hostels', hostelCode, 'floors'), { name });
    } catch (error) {
      throw new Error('Failed to add floor: ' + error.message);
    }
  };

  const removeFloor = async (floorId) => {
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
  };

  const saveRoom = async (roomData) => {
    const docRef = doc(db, 'hostels', hostelCode, 'rooms', roomData.id);
    // Overwrite the whole document – ensures fields like 'attributes' are replaced completely
    await setDoc(docRef, roomData);
  };

  const deleteRoom = (roomId) => deleteDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId));

  const updateRoomStatus = (roomId, newStatus) =>
    setDoc(doc(db, 'hostels', hostelCode, 'roomStatus', roomId), newStatus, { merge: true });

  const resetAllRoomStatus = async () => {
    const statusCol = collection(db, 'hostels', hostelCode, 'roomStatus');
    const snap = await getDocs(statusCol);
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  const assignRoom = (roomId, cleanerUid) =>
    updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), { assignedTo: cleanerUid });

  const unassignRoom = async (roomId) => {
    if (!hostelCode) return;
    await updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), { assignedTo: null });

    // Reset room status
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
  };

  const assignRoomWithDetails = async (roomId, cleanerUid, bedAssignments, managerNotes, commonOnly = false, assignmentAttributes = {}, earlyCheckIn = false, lateCheckOut = false) => {
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
  };

  const deleteCleaner = async (cleanerId) => {
    await deleteDoc(doc(db, 'users', cleanerId));
    const roomsQuery = query(collection(db, 'hostels', hostelCode, 'rooms'), where('assignedTo', '==', cleanerId));
    const snap = await getDocs(roomsQuery);
    const batch = writeBatch(db);
    snap.forEach(d => batch.update(d.ref, { assignedTo: null }));
    await batch.commit();
  };

  const markExtraRoomCleaning = async (roomId, cleanerUid, extraTime, notes) => {
    if (!hostelCode) return;
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    await setDoc(statusRef, {
      extraCleaning: true,
      extraCleaningBy: cleanerUid,
      extraCleaningTime: extraTime || 0,
      extraCleaningNotes: notes || '',
      cleaned: true,
    }, { merge: true });
  };

  const removeExtraRoomCleaning = async (roomId) => {
    if (!hostelCode) return;
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    // Reset extra cleaning fields and cleaned state
    await setDoc(statusRef, {
      extraCleaning: false,
      extraCleaningBy: null,
      extraCleaningTime: 0,
      extraCleaningNotes: '',
      cleaned: false,
    }, { merge: true });
  };

  const markExtraBedCleaning = async (roomId, bedId, cleanerUid, extraTime, notes) => {
    if (!hostelCode) return;
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    const statusSnap = await getDoc(statusRef);
    const existing = statusSnap.exists() ? (statusSnap.data().extraBedsCleaning || []) : [];
    
    // Remove any previous entry for the same bed/cleaner (update)
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
  };

  const removeExtraBedCleaning = async (roomId, bedId, cleanerUid) => {
    if (!hostelCode) return;
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    const statusSnap = await getDoc(statusRef);
    if (!statusSnap.exists()) return;
    const existing = statusSnap.data().extraBedsCleaning || [];
    const updated = existing.filter(
      entry => !(entry.bedId === bedId && entry.cleanerId === cleanerUid)
    );
    await setDoc(statusRef, { extraBedsCleaning: updated }, { merge: true });
  };

  const selfAssignExtraRoom = async (roomId, cleanerUid) => {
    if (!hostelCode) return;
    const batch = writeBatch(db);
    // 1. Assign the room
    const roomRef = doc(db, 'hostels', hostelCode, 'rooms', roomId);
    batch.update(roomRef, { assignedTo: cleanerUid });
    // 2. Mark as extra cleaning
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    batch.set(statusRef, {
      extraCleaning: true,
      extraCleaningBy: cleanerUid,
      extraCleaningTime: 0,
      extraCleaningNotes: '',
    }, { merge: true });
    await batch.commit();
  };

  // Add request functions
  const requestExtraRoom = async (roomId, cleanerUid) => {
    if (!hostelCode) return;
    const requestRef = doc(db, 'hostels', hostelCode, 'extraRequests', roomId);
    await setDoc(requestRef, {
      cleanerId: cleanerUid,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
  };

  const approveExtraRoom = async (roomId, cleanerUid) => {
    if (!hostelCode) return;
    // Assign the room
    await updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), {
      assignedTo: cleanerUid,
    });
    // Mark as extra cleaning
    await setDoc(doc(db, 'hostels', hostelCode, 'roomStatus', roomId), {
      extraCleaning: true,
      extraCleaningBy: cleanerUid,
      extraCleaningTime: 0,
      extraCleaningNotes: '',
    }, { merge: true });
    // Delete the request
    await deleteDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId));
  };

  const rejectExtraRoom = async (roomId) => {
    if (!hostelCode) return;
    await deleteDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId));
  };

  const cancelExtraRoomRequest = async (roomId) => {
    if (!hostelCode) return;
    await deleteDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId));
  };

  return (
    <AppContext.Provider value={{
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
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);