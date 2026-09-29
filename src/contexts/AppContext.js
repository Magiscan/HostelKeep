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
import { buildDailyLog, localDateStr } from '../utils/dailyLog';
import { useDailyLogAutosave } from '../hooks/useDailyLogAutosave';
import { describeSubscription } from '../utils/subscription';
import i18n from '../i18n';
import { pushToManagers, pushToUser } from '../services/push';

const AppContext = createContext();

// Every roomStatus write carries the time it happened. The daily-history
// autosave uses the most recent one to decide which DAY the live state belongs
// to — see src/utils/dailyLog.js. Client clock, deliberately: it has to be a
// plain number the moment the write is made, not a pending serverTimestamp.
const stamp = (data) => ({ ...data, updatedAt: Date.now() });

/* ─── Push notification helpers (via api.hostelkeep.com/push) ─── */

// The Worker reads the caller's hostel from Firestore itself, so `hostelCode`
// is accepted for signature compatibility and ignored.
// eslint-disable-next-line no-unused-vars
async function sendPushToManagers(hostelCode, title, body, data) {
  await pushToManagers(title, body, data);
}

async function sendPushToCleaner(cleanerUid, title, body, data) {
  await pushToUser(cleanerUid, title, body, data);
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
  const [billing, setBilling] = useState(null);

  // Which hostel each listener has actually delivered data for. Keyed by code
  // rather than a boolean so that switching hostel can never pair the new code
  // with the previous hostel's rooms still sitting in state — the autosave
  // waits until every listener has reported for the CURRENT code.
  const [readyFor, setReadyFor] = useState({});
  const markReady = useCallback((key, code) => {
    setReadyFor(prev => (prev[key] === code ? prev : { ...prev, [key]: code }));
  }, []);

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
      setBilling(null);
      setReadyFor({});
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
      setBilling(null);
      setReadyFor({});
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
      markReady('hostel', hostelCode);
    }, (e) => console.warn('hostel listener stopped:', e.code));

    const floorsQuery = query(collection(db, 'hostels', hostelCode, 'floors'), orderBy('name'));
    const unsubFloors = onSnapshot(floorsQuery, (snap) => {
      setFloors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      markReady('floors', hostelCode);
    }, (e) => console.warn('floors listener stopped:', e.code));

    const roomsQuery = query(collection(db, 'hostels', hostelCode, 'rooms'), orderBy('name'));
    const unsubRooms = onSnapshot(roomsQuery, (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoaded(true);   // FIXED: was fired before any data arrived
      markReady('rooms', hostelCode);
    }, (e) => {
      console.warn('rooms listener stopped:', e.code);
      setLoaded(true);
    });

    const statusQuery = collection(db, 'hostels', hostelCode, 'roomStatus');
    const unsubStatus = onSnapshot(statusQuery, (snap) => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data(); });
      setRoomStatus(map);
      markReady('status', hostelCode);
    }, (e) => console.warn('roomStatus listener stopped:', e.code));

    const cleanersQuery = query(collection(db, 'users'), where('hostelCode', '==', hostelCode), where('role', '==', 'cleaner'));
    const unsubCleaners = onSnapshot(cleanersQuery, (snap) => {
      setCleaners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      markReady('cleaners', hostelCode);
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

    // The subscription. Top-level billing/{code}, written only by you in the
    // Firebase console. Read by every member so the paywall can render.
    const unsubBilling = onSnapshot(
      doc(db, 'billing', hostelCode),
      (snap) => {
        setBilling(snap.exists() ? snap.data() : null);
        markReady('billing', hostelCode);
      },
      (e) => {
        console.warn('billing listener stopped:', e.code);
        setBilling(null);
        markReady('billing', hostelCode);
      },
    );

    return () => {
      unsubBilling();
      unsubHostel();
      unsubFloors();
      unsubRooms();
      unsubStatus();
      unsubCleaners();
      unsubRoles();
      unsubStaff();
    };
  }, [hostelCode, markReady]);

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
      markReady('extra', hostelCode);
      return undefined;
    }

    return onSnapshot(
      collection(db, 'hostels', hostelCode, 'extraRequests'),
      (snap) => {
        setExtraRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        markReady('extra', hostelCode);
      },
      (e) => {
        // Should not fire given the check above, but a role can change under a
        // live listener. Empty is the right answer either way.
        console.warn('extraRequests listener stopped:', e.code);
        setExtraRequests([]);
        markReady('extra', hostelCode);
      },
    );
  }, [hostelCode, rolesLoaded, mayReadExtraRequests, markReady]);

  // ── Subscription ──
  // Re-evaluated every minute so a trial or period that ends while the
  // dashboard is open locks it without a reload.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!hostelCode) return undefined;
    const id = setInterval(() => setClock(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, [hostelCode]);

  const subscription = useMemo(() => ({
    loaded: !!hostelCode && readyFor.billing === hostelCode,
    ...describeSubscription(readyFor.billing === hostelCode ? billing : null, clock),
  }), [hostelCode, readyFor.billing, billing, clock]);

  // ── Daily history autosave ──
  // Runs on manager-side devices that can change the day's state. Must match
  // the dailyLogs write rule in firestore.rules (export OR assign).
  const autosaveEnabled = useMemo(() => {
    if (!userData || userData.role === 'cleaner' || !rolesLoaded) return false;
    // Every dailyLogs write is gated by isPaid() — don't fire denied writes.
    if (!subscription.active) return false;
    const u = { ...userData };
    return canDo(u, roles, 'export') || canDo(u, roles, 'assign');
  }, [userData, roles, rolesLoaded, subscription.active]);

  const dataReady = !!hostelCode
    && readyFor.hostel === hostelCode
    && readyFor.rooms === hostelCode
    && readyFor.status === hostelCode
    && readyFor.cleaners === hostelCode
    && readyFor.floors === hostelCode
    && readyFor.extra === hostelCode;

  const {
    lastSavedAt: lastAutoSavedAt,
    error: autosaveError,
    closeDayBeforeWipe,
  } = useDailyLogAutosave({
    enabled: autosaveEnabled,
    ready: dataReady,
    hostelCode,
    hostelName: hostel.name,
    rooms,
    roomStatus,
    cleaners,
    floors,
    extraRequests,
  });

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
      throw new Error(i18n.t('appAddFloorFailed', { message: error.message }));
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

    const uid = auth.currentUser?.uid;
    const me = uid ? cleaners.find(c => c.id === uid) : null;

    // A cleaner must send managerNotes and assignmentBedStatus back byte-identical
    // to committed state or the rules reject the whole write. CleanerScreen echoes
    // a cached copy, which goes stale the moment a manager edits either one. With
    // merge:true, omitting them leaves them untouched — the rule then compares
    // committed against committed and always passes.
    const payload = me
      ? (({ managerNotes, assignmentBedStatus, ...rest }) => rest)(newStatus)
      : newStatus;

    const promise = setDoc(
      doc(db, 'hostels', hostelCode, 'roomStatus', roomId),
      stamp(payload),
      { merge: true },
    );

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
        message: i18n.t('notifRoomCleaned', { room: roomName, cleaner: me.username }),
      });
      sendPushToManagers(
        hostelCode,
        i18n.t('notifRoomCleanedTitle'),
        i18n.t('notifRoomCleanedBody', { room: roomName, cleaner: me.username }),   
        { type: 'room_cleaned', roomId },
      ).catch(e => console.warn('Push failed:', e.message));
    }

    if (noteChanged) {
      notifyHostel(hostelCode, {
        type: 'note_added',
        roomId,
        bucket: bucketOf(newStatus.notes),
        message: i18n.t('notifNoteAdded', {
        room: roomName,
        text: `${newStatus.notes.slice(0, 50)}${newStatus.notes.length > 50 ? '…' : ''}`,
      }),
      });
    }

    if (extraChanged) {
      notifyHostel(hostelCode, {
        type: 'extra_time',
        roomId,
        bucket: String(newStatus.extraTime),
        message: i18n.t('notifExtraTime', { room: roomName, minutes: newStatus.extraTime }),
      });
    }

    return promise;
  }, [hostelCode, rooms, cleaners, roomStatus]);  // added roomStatus as dependency

  const resetAllRoomStatus = useCallback(async () => {
    closeDayBeforeWipe('resetAll');
    const statusCol = collection(db, 'hostels', hostelCode, 'roomStatus');
    const snap = await getDocs(statusCol);
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }, [hostelCode, closeDayBeforeWipe]);

  const assignRoom = useCallback((roomId, cleanerUid) =>
    updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), { assignedTo: cleanerUid }), [hostelCode]);

  const unassignRoom = useCallback(async (roomId) => {
    if (!hostelCode) return;
    // Unassigning wipes the room's progress below. Checkpoints the day first if
    // THIS room had any; "Clear all" calls this per room and gets one checkpoint.
    closeDayBeforeWipe('unassign', [roomId]);

    await updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), { assignedTo: null });

    // NOTE: intentionally does NOT touch `assignmentBedStatus` — unassigning a
    // room should only clear who's cleaning it, not the bed states/notes the
    // manager already configured for it. Those are preserved so the manager
    // can re-assign to someone else without having to redo them.
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    await setDoc(statusRef, stamp({
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
    }), { merge: true });
  }, [hostelCode, closeDayBeforeWipe]);

  const assignRoomWithDetails = useCallback(async (roomId, cleanerUid, bedAssignments, managerNotes, commonOnly = false, assignmentAttributes = {}, earlyCheckIn = false, lateCheckOut = false) => {
    if (!hostelCode) return;
    await updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), { assignedTo: cleanerUid });
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    await setDoc(statusRef, stamp({
      assignmentBedStatus: bedAssignments,
      managerNotes: managerNotes || '',
      commonOnly,
      assignmentAttributes,
      earlyCheckIn,
      lateCheckOut,
    }), { merge: true });

    // Push notification to the assigned cleaner
    const room = rooms.find(r => r.id === roomId);
    const roomName = room?.name || roomId;
    sendPushToCleaner(
      cleanerUid,
      i18n.t('notifNewAssignmentTitle'),
      i18n.t('notifNewAssignmentBody', { room: roomName }),
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
    await setDoc(statusRef, stamp({
      extraCleaning: true,
      extraCleaningBy: cleanerUid,
      extraCleaningTime: extraTime || 0,
      extraCleaningNotes: notes || '',
      cleaned: true,
    }), { merge: true });
  }, [hostelCode]);

  const removeExtraRoomCleaning = useCallback(async (roomId) => {
    if (!hostelCode) return;
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    await setDoc(statusRef, stamp({
      extraCleaning: false,
      extraCleaningBy: null,
      extraCleaningTime: 0,
      extraCleaningNotes: '',
      cleaned: false,
    }), { merge: true });
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
    await setDoc(statusRef, stamp({
      extraBedsCleaning: [...filtered, newEntry],
    }), { merge: true });
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
    await setDoc(statusRef, stamp({ extraBedsCleaning: updated }), { merge: true });
  }, [hostelCode]);

  const selfAssignExtraRoom = useCallback(async (roomId, cleanerUid) => {
    if (!hostelCode) return;
    const batch = writeBatch(db);
    const roomRef = doc(db, 'hostels', hostelCode, 'rooms', roomId);
    batch.update(roomRef, { assignedTo: cleanerUid });
    const statusRef = doc(db, 'hostels', hostelCode, 'roomStatus', roomId);
    batch.set(statusRef, stamp({
      extraCleaning: true,
      extraCleaningBy: cleanerUid,
      extraCleaningTime: 0,
      extraCleaningNotes: '',
    }), { merge: true });
    await batch.commit();
  }, [hostelCode]);

  const requestExtraRoom = useCallback(async (roomId, cleanerUid, imageBase64 = null) => {
    if (!hostelCode) return;
    // Firestore caps a document at 1 MiB; the rules reject over 700 KB.
    if (imageBase64 && imageBase64.length > 700000) {
      throw new Error(i18n.t('appPhotoTooLarge'));
    }
    const requestRef = doc(db, 'hostels', hostelCode, 'extraRequests', roomId);
    await setDoc(requestRef, {
      cleanerId: cleanerUid,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      imageBase64: imageBase64 || null,
    });

    // roomId is the document ID, not the room's name. Managers read these
    // strings in the notification panel, so always resolve the name first.
    const room = rooms.find(r => r.id === roomId);
    const roomName = room?.name || roomId;
    const who = cleaners.find(c => c.id === cleanerUid)?.username;

    notifyHostel(hostelCode, {
      type: 'extra_request',
      roomId,
      // Without a bucket the ID is extra_request__<room>__<day>, so a second
      // request for the same room on the same day is a duplicate and is denied.
      // Now that a rejected request can be re-raised, that has to change.
      bucket: bucketOf(`${cleanerUid}_${Math.floor(Date.now() / 60000)}`),
      message: who
        ? i18n.t('notifExtraRequestWithName', { room: roomName, cleaner: who })
        : i18n.t('notifExtraRequestAnonymous', { room: roomName }),
    });

    sendPushToManagers(
      hostelCode,
      i18n.t('notifExtraRequestTitle'),
      who
        ? i18n.t('notifExtraRequestBodyWithName', { room: roomName, cleaner: who })
        : i18n.t('notifExtraRequestBodyAnonymous', { room: roomName }),
      { type: 'extra_request', roomId },
    ).catch(e => console.warn('Push failed:', e));
  }, [hostelCode, rooms, cleaners]);

  const approveExtraRoom = useCallback(async (roomId, cleanerUid) => {
    if (!hostelCode) return;
    await updateDoc(doc(db, 'hostels', hostelCode, 'rooms', roomId), { assignedTo: cleanerUid });
    await setDoc(doc(db, 'hostels', hostelCode, 'roomStatus', roomId), stamp({
      extraCleaning: true,
      extraCleaningBy: cleanerUid,
      extraCleaningTime: 0,
      extraCleaningNotes: '',
    }), { merge: true });
    await updateDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId), {
      status: 'approved',
      imageBase64: null,   // privacy.html promises deletion on resolve
    });
  }, [hostelCode]);

  const rejectExtraRoom = useCallback(async (roomId, cleanerUid) => {
    if (!hostelCode) return;
    // Marked, not deleted. The cleaner has no notification panel, so a card on
    // their own screen is the only way they learn of a rejection. They dismiss
    // it themselves, which deletes the document and frees the room — a delete
    // the rules already allow for whoever raised the request.
    await updateDoc(doc(db, 'hostels', hostelCode, 'extraRequests', roomId), {
      status: 'rejected',
      imageBase64: null,   // privacy.html promises deletion on resolve
    });

    if (cleanerUid) {
      const room = rooms.find(r => r.id === roomId);
      sendPushToCleaner(
        cleanerUid,
        i18n.t('notifExtraRejectedTitle'),
        i18n.t('notifExtraRejectedBody', { room: room?.name || roomId }),
        { type: 'extra_rejected', roomId },
      ).catch(e => console.warn('Push failed:', e.message));
    }
  }, [hostelCode, rooms]);

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

  // Manual snapshot. Nothing in the UI needs it any more — the autosave covers
  // it — but it stays available (e.g. for a future "Save now" button). Uses the
  // same builder, so photos and tokens are stripped here too.
  const saveDailyLog = useCallback(async (dateOverride = null) => {
    if (!hostelCode) return;

    if (rooms.some(r => r.assignedTo) && cleaners.length === 0) {
      throw new Error(i18n.t('appStillLoadingTeam'));
    }

    const log = buildDailyLog({
      hostelName: hostel.name,
      rooms, roomStatus, cleaners, floors, extraRequests,
      date: dateOverride || localDateStr(),
    });

    await setDoc(doc(db, 'hostels', hostelCode, 'dailyLogs', log.date), {
      ...log,
      savedAt: new Date().toISOString(),
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
    closeDayBeforeWipe,
    lastAutoSavedAt,
    autosaveError,
    subscription,
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
    closeDayBeforeWipe,
    lastAutoSavedAt,
    autosaveError,
    subscription,
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