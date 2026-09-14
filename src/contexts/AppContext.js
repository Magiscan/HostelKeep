import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, getDocs, writeBatch, getDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { notifyHostel, bucketOf } from '../utils/notify';
import {
  normaliseRoles, DEFAULT_ROLES, canDo, visibleSections,
} from '../utils/permissions';

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
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [staff, setStaff] = useState([]);

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
      setRoles(DEFAULT_ROLES);
      setRolesLoaded(false);
      setStaff([]);
    } else {
      setHostel({ name: '', code: '' });
      setFloors([]);
      setRooms([]);
      setRoomStatus({});
      setCleaners([]);
      setRoomAttributes([]);
      setLoaded(false);
      setRoles(DEFAULT_ROLES);
      setRolesLoaded(false);
      setStaff([]);
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
    }, (e) => console.warn('hostel listener stopped:', e.code));

    const floorsQuery = query(collection(db, 'hostels', hostelCode, 'floors'), orderBy('name'));
    const unsubFloors = onSnapshot(floorsQuery, (snap) => {
      setFloors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => console.warn('floors listener stopped:', e.code));

    const roomsQuery = query(collection(db, 'hostels', hostelCode, 'rooms'), orderBy('name'));
    const unsubRooms = onSnapshot(roomsQuery, (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoaded(true);   // FIXED: was fired before any data arrived
    }, (e) => {
      console.warn('rooms listener stopped:', e.code);
      setLoaded(true);
    });

    const statusQuery = collection(db, 'hostels', hostelCode, 'roomStatus');
    const unsubStatus = onSnapshot(statusQuery, (snap) => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data(); });
      setRoomStatus(map);
    }, (e) => console.warn('roomStatus listener stopped:', e.code));

    const cleanersQuery = query(collection(db, 'users'), where('hostelCode', '==', hostelCode), where('role', '==', 'cleaner'));
    const unsubCleaners = onSnapshot(cleanersQuery, (snap) => {
      setCleaners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => console.warn('cleaners listener stopped:', e.code));

    // The permission model. Every member reads it — a staff client has to know
    // its own role to render, and the rules grant read to any member.
    const unsubRoles = onSnapshot(
      doc(db, 'hostels', hostelCode, 'config', 'roles'),
      (snap) => {
        if (snap.exists()) {
          setRoles(normaliseRoles(snap.data()));
        } else {
          // Not seeded yet. Fall back to the defaults for rendering only —
          // nothing is enforced against a document that doesn't exist, and the
          // rules deny every staff write until one does.
          setRoles(DEFAULT_ROLES);
        }
        setRolesLoaded(true);
      },
      (e) => {
        console.warn('roles listener stopped:', e.code);
        setRolesLoaded(true);   // permission-denied → stop spinning
      },
    );

    const staffQuery = query(
      collection(db, 'users'),
      where('hostelCode', '==', hostelCode),
      where('role', '==', 'staff'),
    );
    const unsubStaff = onSnapshot(staffQuery, (snap) => {
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => console.warn('staff listener stopped:', e.code));

    return () => {
      unsubHostel();
      unsubFloors();
      unsubRooms();
      unsubStatus();
      unsubCleaners();
      unsubRoles();
      unsubStaff();
    };
  }, [hostelCode]);

  // Whether this account is allowed to READ extra requests. Mirrors canSee()
  // in firestore.rules. Cleaners always may — they raise them. Owners always
  // may. Staff only if their role includes the section.
  //
  // This one collection holds the base64 photos cleaners attach, which is why
  // it is gated at the database rather than just hidden in the sidebar.
  const mayReadExtraRequests = useMemo(() => {
    if (!userData) return false;
    if (userData.role !== 'staff') return true;
    return (roles?.[userData.roleId]?.sections || []).includes('extraRequests');
  }, [userData, roles]);

  // Deliberately its own effect, keyed on permission as well as hostel. Kept
  // inside the main subscription effect, a role change would have to tear down
  // and rebuild every other listener just to add or drop this one.
  useEffect(() => {
    if (!hostelCode || !rolesLoaded) return undefined;

    if (!mayReadExtraRequests) {
      setExtraRequests([]);
      return undefined;
    }

    return onSnapshot(
      collection(db, 'hostels', hostelCode, 'extraRequests'),
      (snap) => setExtraRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (e) => {
        // Should not fire given the check above, but a role can change under a
        // live listener. Empty is the right answer either way.
        console.warn('extraRequests listener stopped:', e.code);
        setExtraRequests([]);
      },
    );
  }, [hostelCode, rolesLoaded, mayReadExtraRequests]);

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
    // Capture previous status BEFORE the write. CleanerScreen spreads the whole
    // existing status into every update, so `newStatus.cleaned` is true on every
    // write after the first — only a transition is newsworthy.
    const prev = roomStatus[roomId] || {};

    const promise = setDoc(
      doc(db, 'hostels', hostelCode, 'roomStatus', roomId),
      newStatus,
      { merge: true },
    );

    const uid = auth.currentUser?.uid;
    const me = uid ? cleaners.find(c => c.id === uid) : null;
    if (!hostelCode || !me) return promise;

    const room = rooms.find(r => r.id === roomId);
    const roomName = room?.name || roomId;

    const becameClean = newStatus.cleaned === true && prev.cleaned !== true;
    const noteChanged =
      typeof newStatus.notes === 'string' &&
      newStatus.notes.trim() &&
      newStatus.notes !== (prev.notes || '');
    const extraChanged = (newStatus.extraTime || 0) > (prev.extraTime || 0);

    if (becameClean) {
      notifyHostel(hostelCode, {
        type: 'room_cleaned',
        roomId,
        message: `Room ${roomName} cleaned by ${me.username}`,
      });
      sendPushToManagers(
        hostelCode,
        'Room cleaned',
        `Room ${roomName} was marked clean by ${me.username}.`,
        { type: 'room_cleaned', roomId },
      ).catch(e => console.warn('Push failed:', e.message));
    }

    if (noteChanged) {
      notifyHostel(hostelCode, {
        type: 'note_added',
        roomId,
        bucket: bucketOf(newStatus.notes),
        message: `Note on room ${roomName}: "${newStatus.notes.slice(0, 50)}${newStatus.notes.length > 50 ? '…' : ''}"`,
      });
    }

    if (extraChanged) {
      notifyHostel(hostelCode, {
        type: 'extra_time',
        roomId,
        bucket: String(newStatus.extraTime),
        message: `Extra time on room ${roomName}: +${newStatus.extraTime} min`,
      });
    }

    return promise;
  }, [hostelCode, rooms, cleaners, roomStatus]);  // added roomStatus as dependency

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

    // NOTE: intentionally does NOT touch `assignmentBedStatus` — unassigning a
    // room should only clear who's cleaning it, not the bed states/notes the
    // manager already configured for it. Those are preserved so the manager
    // can re-assign to someone else without having to redo them.
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    await setDoc(statusRef, {
      cleaned: false,
      notes: '',
      extraTime: 0,
      bedStatus: {},
      managerNotes: '',
      commonOnly: false,
      extraCleaning: false,
      extraCleaningBy: null,
      extraCleaningTime: 0,
      extraCleaningNotes: '',
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
    // Read the profile BEFORE deleting it — we need the username to build the
    // loginLookup key. Without this the name stays permanently taken.
    const profile = await getDoc(doc(db, 'users', cleanerId));
    const username = profile.exists() ? profile.data().username : null;

    const roomsQuery = query(
      collection(db, 'hostels', hostelCode, 'rooms'),
      where('assignedTo', '==', cleanerId),
    );
    const snap = await getDocs(roomsQuery);
    const batch = writeBatch(db);
    snap.forEach(d => batch.update(d.ref, { assignedTo: null }));
    batch.delete(doc(db, 'users', cleanerId));
    if (username) {
      batch.delete(doc(db, 'loginLookup', `${hostelCode}_${username}`));
    }
    await batch.commit();

    // NOTE: on the Spark plan the Firebase Auth account itself cannot be
    // deleted from the client. It survives, but is inert — every security rule
    // begins by reading users/{uid}, and that document is now gone, so the
    // account can read and write nothing.
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
    // Firestore caps a document at 1 MiB; the rules reject over 700 KB.
    if (imageBase64 && imageBase64.length > 700000) {
      throw new Error('That photo is too large. Please retake it.');
    }
    const requestRef = doc(db, 'hostels', hostelCode, 'extraRequests', roomId);
    await setDoc(requestRef, {
      cleanerId: cleanerUid,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      imageBase64: imageBase64 || null,
    });

    notifyHostel(hostelCode, {
      type: 'extra_request',
      roomId,
      message: `Extra room requested for ${roomId}`,
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
    await updateDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId), {
      status: 'approved',
      imageBase64: null,   // privacy.html promises deletion on resolve
    });
  }, [hostelCode]);

  const rejectExtraRoom = useCallback(async (roomId) => {
    if (!hostelCode) return;
    await updateDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId), {
      status: 'rejected',
      imageBase64: null,   // privacy.html promises deletion on resolve
    });
  }, [hostelCode]);

  const cancelExtraRoomRequest = useCallback(async (roomId) => {
    if (!hostelCode) return;
    await deleteDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId));
  }, [hostelCode]);

  const deleteExtraRequest = useCallback(async (roomId) => {
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
      if (data.requestedAt) {
        const age = now - new Date(data.requestedAt).getTime();
        if (age > twentyFourHours) {
          batch.delete(docSnap.ref);
        }
      }
    });
    await batch.commit();
  }, [hostelCode]);

  // Check if a daily log already exists for a given date
  const dailyLogExists = useCallback(async (date) => {
    if (!hostelCode) return false;
    const snap = await getDoc(doc(db, 'hostels', hostelCode, 'dailyLogs', date));
    return snap.exists();
  }, [hostelCode]);

  // Save a snapshot of today’s work
  const saveDailyLog = useCallback(async (dateOverride = null) => {
    if (!hostelCode) return;

    if (rooms.some(r => r.assignedTo) && cleaners.length === 0) {
      throw new Error('Still loading team data — please try again in a moment.');
    }

    // Use the override date if provided, otherwise today (local time)
    let dateStr = dateOverride;
    if (!dateStr) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      dateStr = `${yyyy}-${mm}-${dd}`;
    }

    // Build cleaner name map
    const cleanerNameMap = {};
    cleaners.forEach((c) => {
      cleanerNameMap[c.id] = c.username;
    });

    // Build cleaner -> rooms snapshot
    const cleanerMap = {};
    rooms.forEach((room) => {
      if (!room.assignedTo) return;
      const status = roomStatus[room.id] || {};
      const cleanerId = room.assignedTo;

      if (!cleanerMap[cleanerId]) {
        cleanerMap[cleanerId] = {
          cleanerName: cleanerNameMap[cleanerId] || 'Deleted cleaner',
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

    // Write the daily log document
    await setDoc(doc(db, 'hostels', hostelCode, 'dailyLogs', dateStr), {
      date: dateStr,
      hostelName: hostel.name,
      cleaners: cleanerMap,
      savedAt: new Date().toISOString(),

      // Full snapshots for rich report generation later
      roomsSnapshot: rooms,
      floorsSnapshot: floors,
      cleanersSnapshot: cleaners,
      extraRequestsSnapshot: extraRequests,
      roomStatusSnapshot: roomStatus,
    });
  }, [hostelCode, rooms, roomStatus, cleaners, floors, extraRequests, hostel.name]);

  // Owner-only on the server. Writing the whole map at once keeps the document
  // consistent — a partial merge could leave a role with sections but no perms.
  const saveRoles = useCallback(async (next) => {
    if (!hostelCode) return;
    await setDoc(doc(db, 'hostels', hostelCode, 'config', 'roles'), {
      roles: next,
      updatedAt: new Date().toISOString(),
    });
  }, [hostelCode]);

  // Mirrors can() in firestore.rules. Decides what to RENDER, never what is
  // allowed — if these two disagree, the rules win and the user gets a
  // permission-denied error, which is the correct failure.
  const can = useCallback(
    (perm) => canDo(userData ? { ...userData } : null, roles, perm),
    [userData, roles],
  );

  const sections = useMemo(
    () => visibleSections(userData, roles),
    [userData, roles],
  );

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
    userData,
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
    deleteExtraRequest,
    cleanupOldExtraRequests,
    dailyLogExists,
    saveDailyLog,
    roles,
    rolesLoaded,
    staff,
    saveRoles,
    can,
    sections,
  }), [
    loaded,
    hostel,
    floors,
    rooms,
    roomStatus,
    cleaners,
    hostelCode,
    roomAttributes,
    userData,
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
    deleteExtraRequest,
    cleanupOldExtraRequests,
    // FIXED: these were in the returned object but missing from the deps, so
    // consumers were handed stale closures.
    dailyLogExists,
    saveDailyLog,
    roles,
    rolesLoaded,
    staff,
    saveRoles,
    can,
    sections,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);