// src/hooks/useMaintenance.js
//
// Maintenance tasks — data layer only. Screens import this; nothing here
// renders. Kept out of AppContext on purpose: only screens that show
// maintenance subscribe, so the housekeeping screens don't pay for it.
//
// SHAPE ON DISK — hostels/{code}/maintenance/{taskId}:
//
//   title        string ≤120        "Shower drain blocked"
//   description  string ≤2000
//   places       [{ roomId, beds: [bedId] }] ≤20 rooms; beds empty = whole room
//   roomId       string | null      first room in `places` (kept for older
//                                   clients and for notifications)
//   area         string | null ≤80  free text when there's no room ("Laundry")
//   priority     'low' | 'medium' | 'high' | 'urgent'
//   status       'reported' | 'open' | 'in_progress' | 'on_hold' | 'done' | 'dismissed'
//   assignees    uid[] ≤6
//   reportedBy   uid                 who raised it (housekeeper or manager)
//   reportedAt   ms
//   dueAt        ms | null
//   checklist    [{ id, text, done }] ≤30
//   photoCount   number              photos live in ./photos, never inline
//                                   (≤5 when created, ≤12 in total — client side)
//   startedAt, doneAt  ms | null
//   doneBy       uid | null
//   holdReason   string | null ≤200 "Waiting for the plumber"
//   updatedAt    ms
//   clearedBy    uid[]              people who removed it (finished) from THEIR list
//   dismissedAt  ms | null           when it was archived (5g)
//   photosPurgedAt ms | null         when its photos were deleted, 30 days after
//                                   it was finished (5g, utils/photoRetention.js)
//
//   ./photos/{id}    { data: base64, by, at, kind: 'report' | 'progress' | 'fix' }
//   ./comments/{id}  { text, by, at }
//
// Times are client Date.now() numbers, like stamp() in AppContext.
//
// The rules are the boundary (firestore.rules, ROUND 5). This file only
// decides what to ask for; if the two disagree the rules win.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  collection, doc, onSnapshot, query, where, orderBy,
  writeBatch, updateDoc, getDocs, increment, arrayUnion,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useApp } from '../contexts/AppContext';
import { notifyHostel } from '../utils/notify';
import { pushToManagers, pushToUser } from '../services/push';
import i18n from '../i18n';
import { asMillis } from '../utils/maintenanceSchedule';
import { photosToPurge } from '../utils/photoRetention';

/* ─── Vocabulary ──────────────────────────────────────────────── */

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const ACTIVE_STATUSES = ['reported', 'open', 'in_progress', 'on_hold'];
export const CLOSED_STATUSES = ['done', 'dismissed'];
export const WORK_STATUSES = ['open', 'in_progress', 'on_hold', 'done'];

// Same ceiling as extra requests; the rules reject at 700 000 characters.
export const MAX_PHOTO_CHARS = 700000;
// Photos attached when a task or report is created (one write, well under
// Firestore's 10 MB request limit), and the most a task collects in total.
export const MAX_NEW_PHOTOS = 5;
export const MAX_TASK_PHOTOS = 12;

/** fields.photos (list) or the older fields.photoBase64 → up to 5 photos. */
export const newPhotosOf = (fields) => (Array.isArray(fields?.photos) ? fields.photos : [fields?.photoBase64])
  .filter(p => typeof p === 'string' && p.length > 0)
  .slice(0, MAX_NEW_PHOTOS);

const PRIORITY_RANK = { urgent: 3, high: 2, medium: 1, low: 0 };

/* ─── Days (worker schedule) ──────────────────────────────────── */

export const startOfDay = (ms = Date.now()) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (ms, n) => { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); };

/* ─── Small helpers ───────────────────────────────────────────── */

const tasksCol = (code) => collection(db, 'hostels', code, 'maintenance');
const taskRef = (code, id) => doc(db, 'hostels', code, 'maintenance', id);

// i18n with an inline fallback, so this works before the keys are translated.
const tr = (key, defaultValue, vars) => i18n.t(key, { defaultValue, ...vars });

// Push is best-effort: it must never undo or fail the write that caused it.
const quiet = (p) =>
  Promise.resolve(p).catch(e => console.warn('Maintenance push failed:', e?.message));

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const genId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

/* ─── Places: one or more rooms, optionally specific beds ─────────
   Tasks written before multi-room support only have `roomId`; placesOf()
   reads both, so nothing needs migrating. */

export const MAX_PLACES = 20;
export const MAX_BEDS_PER_PLACE = 30;

export function normalisePlaces(places) {
  const seen = new Set();
  return (Array.isArray(places) ? places : [])
    .map(p => (typeof p === 'string' ? { roomId: p } : p))
    .filter(p => p && typeof p.roomId === 'string' && p.roomId && !seen.has(p.roomId) && seen.add(p.roomId))
    .slice(0, MAX_PLACES)
    .map(p => ({
      roomId: p.roomId,
      beds: [...new Set((Array.isArray(p.beds) ? p.beds : []).filter(b => typeof b === 'string' && b))]
        .slice(0, MAX_BEDS_PER_PLACE),
    }));
}

export function placesOf(task) {
  if (Array.isArray(task?.places) && task.places.length) return normalisePlaces(task.places);
  return task?.roomId ? [{ roomId: task.roomId, beds: [] }] : [];
}

const bedLabel = (room, bedId) => {
  const bed = (room?.beds || []).find(b => b.id === bedId);
  return (bed?.name || bed?.label || bedId || '').trim();
};

export function normaliseChecklist(items) {
  return (Array.isArray(items) ? items : [])
    .map(i => (typeof i === 'string' ? { text: i } : i))
    .filter(i => i && str(i.text, 120))
    .slice(0, 30)
    .map(i => ({ id: i.id || genId(), text: str(i.text, 120), done: !!i.done }));
}

/** Finished, and this person removed it from their own list. */
export const isClearedFor = (task, uid) => (task?.clearedBy || []).includes(uid);
export const isFinished = (task) => CLOSED_STATUSES.includes(task?.status);
/** Where an archived task goes back to: triage if nobody was assigned. */
export const restoredStatus = (task) => ((task?.assignees || []).length ? 'open' : 'reported');

export function isOverdue(task, now = Date.now()) {
  // asMillis: a due date edited in the Firebase console is a Timestamp, and
  // `Timestamp < number` compares seconds-as-text with millis — always true.
  const due = asMillis(task?.dueAt);
  return due != null && ACTIVE_STATUSES.includes(task.status) && due < now;
}

/** "101", "101 (A, B) · 102", "Laundry", or "General". */
export function locationLabel(task, rooms = []) {
  const places = placesOf(task);
  if (places.length) {
    const parts = places.map((p) => {
      const room = rooms.find(r => r.id === p.roomId);
      if (!room) return null;
      const beds = p.beds.map(b => bedLabel(room, b)).filter(Boolean);
      return beds.length ? `${room.name} (${beds.join(', ')})` : room.name;
    }).filter(Boolean);
    return parts.length ? parts.join(' · ') : (task.area || '—');
  }
  return task?.area || tr('maintGeneral', 'General');
}

/** Overdue first, then priority, then soonest due, then newest. */
export function compareTasks(a, b, now = Date.now()) {
  const oa = isOverdue(a, now) ? 1 : 0;
  const ob = isOverdue(b, now) ? 1 : 0;
  if (oa !== ob) return ob - oa;
  const pa = PRIORITY_RANK[a.priority] ?? 1;
  const pb = PRIORITY_RANK[b.priority] ?? 1;
  if (pa !== pb) return pb - pa;
  const da = asMillis(a.dueAt) ?? Infinity;
  const dbb = asMillis(b.dueAt) ?? Infinity;
  if (da !== dbb) return da - dbb;
  return (b.reportedAt || 0) - (a.reportedAt || 0);
}

/** A full, rule-valid task document. Every key present, nothing undefined. */
function buildTask(fields, { status, reportedBy, now }) {
  return {
    title: str(fields.title, 120),
    description: str(fields.description, 2000),
    ...(() => {
      const places = normalisePlaces(fields.places ?? (fields.roomId ? [{ roomId: fields.roomId }] : []));
      return {
        places,
        roomId: places[0]?.roomId || null,
        area: places.length ? null : (str(fields.area, 80) || null),
      };
    })(),
    priority: PRIORITIES.includes(fields.priority) ? fields.priority : 'medium',
    status,
    assignees: Array.isArray(fields.assignees) ? [...new Set(fields.assignees)].slice(0, 6) : [],
    reportedBy,
    reportedAt: now,
    dueAt: Number.isFinite(fields.dueAt) ? fields.dueAt : null,
    checklist: normaliseChecklist(fields.checklist),
    photoCount: newPhotosOf(fields).length,
    startedAt: null,
    doneAt: null,
    doneBy: null,
    holdReason: null,
    updatedAt: now,
  };
}

function checkPhoto(base64) {
  if (base64 && base64.length >= MAX_PHOTO_CHARS) {
    throw new Error(tr('appPhotoTooLarge', 'That photo is too large. Try again a little further away.'));
  }
}

/* ─── Provider ────────────────────────────────────────────────────
   One set of listeners for the whole app. Mount it INSIDE AppProvider (it
   reads useApp). Every screen calls useMaintenance(), which reads this. */

const MaintenanceContext = createContext(null);

export function MaintenanceProvider({ children }) {
  const value = useMaintenanceData();
  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
}

export function useMaintenance() {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) throw new Error('useMaintenance must be used inside <MaintenanceProvider>');
  return ctx;
}

/* ─── Data (private — use the provider) ───────────────────────── */

function useMaintenanceData() {
  const { hostelCode, userData, rooms, cleaners, staff, can, sections, subscription } = useApp();
  const uid = auth.currentUser?.uid || null;

  // Must mirror maintenanceBoard() in the rules: the owner always, staff whose
  // role shows the section. (Owner is checked by role, not by `sections`, so
  // the board works even if SECTION_LIST hasn't been updated yet.)
  const managerSees = userData?.role === 'manager'
    || (userData?.role === 'staff' && (sections || []).includes('maintenance'));
  const canManage = !!userData && can('maintenance');

  // ── Plan ── Maintenance is Pro+ (subscription.proPlus, from
  // utils/subscription.js; mirrors isProPlus() in firestore.rules).
  const billingLoaded = !!subscription?.loaded;
  const enabled = !!subscription?.proPlus;

  const [lists, setLists] = useState({});
  const expected = managerSees ? 1 : 2; // board: all; worker: assigned + reported

  useEffect(() => {
    setLists({});
    // Not on Pro+: no listeners at all, so nobody pays for reads they can't use.
    if (!hostelCode || !uid || !userData || !enabled) return undefined;

    const subs = [];
    const listen = (key, q) => {
      subs.push(onSnapshot(
        q,
        (snap) => setLists(prev => ({
          ...prev,
          [key]: snap.docs.map(d => ({ id: d.id, ...d.data() })),
        })),
        (e) => {
          // A role can change under a live listener. Empty is the right answer,
          // but say so loudly: a denied listener looks exactly like "no tasks".
          console.error(`maintenance/${key} listener stopped:`, e.code, e.message);
          setLists(prev => ({ ...prev, [key]: [] }));
        },
      ));
    };

    if (managerSees) {
      // The whole collection, filtered on the client. No index needed, and a
      // task never drops out of view when its status changes. (Previously the
      // done/dismissed half was a separate query that required a composite
      // index — without it that listener failed silently and every finished
      // task vanished.) Finished tasks stay until someone deletes them.
      listen('all', tasksCol(hostelCode));
    } else {
      // Two queries, each provable by one branch of the read rule.
      listen('assigned', query(tasksCol(hostelCode), where('assignees', 'array-contains', uid)));
      listen('reported', query(tasksCol(hostelCode), where('reportedBy', '==', uid)));
    }

    return () => subs.forEach(u => u());
    // userData?.role, not userData: a profile-field write must not re-subscribe.
  }, [hostelCode, uid, managerSees, userData?.role, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const loaded = billingLoaded && (!enabled || Object.keys(lists).length >= expected);

  const tasks = useMemo(() => {
    const byId = new Map();
    Object.values(lists).forEach(list => list.forEach(t => byId.set(t.id, t)));
    const now = Date.now();
    return [...byId.values()].sort((a, b) => compareTasks(a, b, now));
  }, [lists]);

  // Finished work stays on the person's list until THEY remove it.
  const myTasks = useMemo(
    () => tasks.filter(t => (t.assignees || []).includes(uid)
      && WORK_STATUSES.includes(t.status)
      && !isClearedFor(t, uid)),
    [tasks, uid],
  );
  const myReports = useMemo(
    () => tasks.filter(t => t.reportedBy === uid && !isClearedFor(t, uid)),
    [tasks, uid],
  );

  const counts = useMemo(() => {
    const c = { reported: 0, open: 0, in_progress: 0, on_hold: 0, done: 0, dismissed: 0, overdue: 0 };
    const now = Date.now();
    tasks.forEach((t) => {
      c[t.status] = (c[t.status] || 0) + 1;
      if (isOverdue(t, now)) c.overdue += 1;
    });
    return c;
  }, [tasks]);

  // Who can be given a task: the maintenance team, then managers (staff, and
  // the owner when the owner is the one looking). Housekeepers don't fix
  // things, so they're not offered.
  //   { id, username, kind: 'maintenance' | 'manager' }
  const assignable = useMemo(() => {
    const byName = (a, b) => (a.username || '').localeCompare(b.username || '');
    const maint = (cleaners || [])
      .filter(c => c.team === 'maintenance')
      .map(c => ({ id: c.id, username: c.username, kind: 'maintenance' }))
      .sort(byName);
    const managers = (staff || []).map(s => ({ id: s.id, username: s.username, kind: 'manager' }));
    if (userData?.role === 'manager' && uid && !managers.some(x => x.id === uid)) {
      managers.push({ id: uid, username: userData.username, kind: 'manager' });
    }
    managers.sort(byName);
    return [...maint, ...managers];
  }, [cleaners, staff, userData?.role, userData?.username, uid]);

  const nameOf = useCallback(
    (id) => (cleaners || []).find(c => c.id === id)?.username
      || (staff || []).find(s => s.id === id)?.username
      || (id === uid ? userData?.username : null)
      || tr('maintSomeone', 'Someone'),
    [cleaners, staff, uid, userData?.username],
  );

  const isHousekeeper = useCallback(
    (id) => (cleaners || []).some(c => c.id === id),
    [cleaners],
  );

  const pushAssigned = useCallback((assigneeIds, task, taskId) => {
    const where_ = locationLabel(task, rooms);
    assigneeIds
      .filter(a => a && a !== uid)
      .forEach(a => quiet(pushToUser(
        a,
        task.priority === 'urgent'
          ? tr('notifMaintAssignedUrgentTitle', 'Urgent maintenance task')
          : tr('notifMaintAssignedTitle', 'New maintenance task'),
        `${where_} · ${task.title}`,
        { type: 'maint_assigned', taskId },
      )));
  }, [rooms, uid]);

  /* ── Report (anyone in the hostel) ── */
  const reportIssue = useCallback(async (fields) => {
    if (!hostelCode || !uid) return null;
    if (!str(fields?.title, 120)) {
      throw new Error(tr('maintTitleRequired', 'Describe the problem in a few words.'));
    }
    const photos = newPhotosOf(fields);
    photos.forEach(checkPhoto);

    const now = Date.now();
    const ref = doc(tasksCol(hostelCode));
    // A report is untriaged: the rules reject assignees, due date or checklist.
    const data = buildTask(
      { ...fields, assignees: [], dueAt: null, checklist: [] },
      { status: 'reported', reportedBy: uid, now },
    );

    const batch = writeBatch(db);
    batch.set(ref, data);
    // at: now + i keeps them in the order they were added.
    photos.forEach((data, i) => batch.set(doc(collection(ref, 'photos')), {
      data, by: uid, at: now + i, kind: 'report',
    }));
    await batch.commit();

    const where_ = locationLabel(data, rooms);
    const who = userData?.username || nameOf(uid);
    notifyHostel(hostelCode, {
      type: 'maint_reported',
      roomId: ref.id, // unique per task, so two reports a day aren't "duplicates"
      message: tr('notifMaintReported', '{{who}} reported a problem: {{title}} ({{where}})', {
        who, title: data.title, where: where_,
      }),
    });
    quiet(pushToManagers(
      data.priority === 'urgent'
        ? tr('notifMaintReportedUrgentTitle', 'Urgent problem reported')
        : tr('notifMaintReportedTitle', 'New problem reported'),
      `${where_} · ${data.title}`,
      { type: 'maint_reported', taskId: ref.id },
    ));
    return ref.id;
  }, [hostelCode, uid, rooms, userData?.username, nameOf]);

  /* ── Create a task directly (manager) ── */
  const createTask = useCallback(async (fields) => {
    if (!hostelCode || !uid) return null;
    if (!str(fields?.title, 120)) {
      throw new Error(tr('maintTitleRequired', 'Describe the problem in a few words.'));
    }
    const photos = newPhotosOf(fields);
    photos.forEach(checkPhoto);

    const now = Date.now();
    const ref = doc(tasksCol(hostelCode));
    const data = buildTask(fields, { status: 'open', reportedBy: uid, now });

    const batch = writeBatch(db);
    batch.set(ref, data);
    // at: now + i keeps them in the order they were added.
    photos.forEach((data, i) => batch.set(doc(collection(ref, 'photos')), {
      data, by: uid, at: now + i, kind: 'report',
    }));
    await batch.commit();

    pushAssigned(data.assignees, data, ref.id);
    return ref.id;
  }, [hostelCode, uid, pushAssigned]);

  /* ── Edit / triage (manager) ──
     Pass only what changed. Giving a 'reported' task its first assignee moves
     it to 'open' unless a status is passed explicitly. */
  const updateTask = useCallback(async (task, patch) => {
    if (!hostelCode || !task?.id) return;

    const next = { ...patch, updatedAt: Date.now() };
    if ('title' in next) next.title = str(next.title, 120);
    if ('description' in next) next.description = str(next.description, 2000);
    if ('area' in next) next.area = str(next.area, 80) || null;
    if ('places' in next) {
      next.places = normalisePlaces(next.places);
      next.roomId = next.places[0]?.roomId || null;
      if (next.places.length) next.area = null;
    } else if ('roomId' in next) {
      next.roomId = next.roomId || null;
      next.places = next.roomId ? [{ roomId: next.roomId, beds: [] }] : [];
      if (next.roomId) next.area = null;
    }
    if ('checklist' in next) next.checklist = normaliseChecklist(next.checklist);
    if ('assignees' in next) next.assignees = [...new Set(next.assignees || [])].slice(0, 6);
    if ('dueAt' in next && !Number.isFinite(next.dueAt)) next.dueAt = null;

    if (task.status === 'reported' && !next.status && (next.assignees || []).length) {
      next.status = 'open';
    }

    await updateDoc(taskRef(hostelCode, task.id), next);

    if (next.assignees) {
      const before = task.assignees || [];
      const added = next.assignees.filter(a => !before.includes(a));
      pushAssigned(added, { ...task, ...next }, task.id);
    }
  }, [hostelCode, pushAssigned]);

  /* ── Move through the lifecycle (assignee or manager) ── */
  const setStatus = useCallback(async (task, status, { holdReason } = {}) => {
    if (!hostelCode || !task?.id) return;

    const now = Date.now();
    const patch = { status, updatedAt: now };

    if (status === 'in_progress' && !task.startedAt) patch.startedAt = now;
    if (status === 'on_hold') patch.holdReason = str(holdReason, 200) || null;
    else if (task.holdReason) patch.holdReason = null;

    if (status === 'done') {
      patch.doneAt = now;
      patch.doneBy = uid;
    } else if (task.status === 'done') {
      // Reopened.
      patch.doneAt = null;
      patch.doneBy = null;
    }

    await updateDoc(taskRef(hostelCode, task.id), patch);

    const where_ = locationLabel(task, rooms);
    const who = userData?.username || nameOf(uid);

    if (status === 'done') {
      notifyHostel(hostelCode, {
        type: 'maint_done',
        roomId: task.id,
        message: tr('notifMaintDone', '{{who}} fixed: {{title}} ({{where}})', {
          who, title: task.title, where: where_,
        }),
      });
      quiet(pushToManagers(
        tr('notifMaintDoneTitle', 'Maintenance done'),
        `${where_} · ${task.title}`,
        { type: 'maint_done', taskId: task.id },
      ));
      // Close the loop with the housekeeper who reported it.
      if (task.reportedBy && task.reportedBy !== uid && isHousekeeper(task.reportedBy)) {
        quiet(pushToUser(
          task.reportedBy,
          tr('notifMaintFixedForReporterTitle', 'Fixed'),
          tr('notifMaintFixedForReporterBody', '{{title}} ({{where}}) has been fixed.', {
            title: task.title, where: where_,
          }),
          { type: 'maint_done', taskId: task.id },
        ));
      }
    }

    if (status === 'on_hold') {
      quiet(pushToManagers(
        tr('notifMaintOnHoldTitle', 'Maintenance on hold'),
        `${where_} · ${task.title}${patch.holdReason ? ` — ${patch.holdReason}` : ''}`,
        { type: 'maint_on_hold', taskId: task.id },
      ));
    }
  }, [hostelCode, uid, rooms, userData?.username, nameOf, isHousekeeper]);

  /* ── Remove finished tasks from MY list (worker, reporter, manager) ──
     Only hides them for this person; the Done tab still has them. */
  const clearForMe = useCallback(async (tasksToClear) => {
    if (!hostelCode || !uid) return;
    const list = (Array.isArray(tasksToClear) ? tasksToClear : [tasksToClear])
      .filter(x => x?.id && isFinished(x) && !isClearedFor(x, uid));
    for (let i = 0; i < list.length; i += 400) {
      const batch = writeBatch(db);
      list.slice(i, i + 400).forEach(x => batch.update(taskRef(hostelCode, x.id), {
        clearedBy: arrayUnion(uid),
      }));
      await batch.commit();
    }
  }, [hostelCode, uid]);

  const dismiss = useCallback(
    (task) => updateTask(task, { status: 'dismissed', dismissedAt: Date.now() }),
    [updateTask],
  );

  /* ── Restore an archived (dismissed) task (manager) ──
     Back to 'reported' if nobody is assigned, otherwise 'open'. clearedBy is
     emptied so it shows up again for everyone who had removed it. */
  const restore = useCallback(async (task) => {
    if (!hostelCode || !task?.id || task.status !== 'dismissed') return;
    await updateDoc(taskRef(hostelCode, task.id), {
      status: restoredStatus(task),
      clearedBy: [],
      dismissedAt: null,
      updatedAt: Date.now(),
    });
  }, [hostelCode]);

  /* ── Photo cleanup (30 days after a task is finished) ──
     Runs on the device of whoever can manage maintenance, while the board's
     data is loaded. Deletes the photos, sets photoCount 0 and photosPurgedAt;
     the task, comments and history stay. A few tasks per pass so a backlog
     doesn't burst the free plan's daily delete quota; the next snapshot
     picks up the rest. Two managers running it at once is harmless. */
  const purging = useRef(false);
  const failed = useRef(new Set());
  const [purgeRound, setPurgeRound] = useState(0);
  useEffect(() => {
    if (!hostelCode || !enabled || !canManage || !managerSees || !loaded || purging.current) return;
    const due = photosToPurge(tasks).filter(x => !failed.current.has(x.id)).slice(0, 10);
    if (!due.length) return;

    purging.current = true;
    (async () => {
      for (const task of due) {
        try {
          const ref = taskRef(hostelCode, task.id);
          const snap = await getDocs(collection(ref, 'photos'));
          for (let i = 0; i < snap.docs.length; i += 400) {
            const batch = writeBatch(db);
            snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
          // updatedAt deliberately untouched: archived tasks without
          // dismissedAt use it as their finish time.
          await updateDoc(ref, { photoCount: 0, photosPurgedAt: Date.now() });
        } catch (e) {
          failed.current.add(task.id); // don't retry it in a loop this session
          console.warn('maintenance photo cleanup failed for', task.id, e.code || e.message);
        }
      }
    })().finally(() => {
      purging.current = false;
      // Snapshots that arrived mid-pass were skipped; look again.
      setPurgeRound(n => n + 1);
    });
  }, [hostelCode, enabled, canManage, managerSees, loaded, tasks, purgeRound]);

  /* ── Checklist (assignee or manager) ── */
  const toggleChecklistItem = useCallback(async (task, itemId) => {
    if (!hostelCode || !task?.id) return;
    const checklist = (task.checklist || []).map(
      i => (i.id === itemId ? { ...i, done: !i.done } : i),
    );
    await updateDoc(taskRef(hostelCode, task.id), { checklist, updatedAt: Date.now() });
  }, [hostelCode]);

  /* ── Delete (manager, owner, or the reporter while still 'reported') ──
     Children first: once the parent is gone, the photo/comment read rules
     can't resolve it, and orphaned subcollections are never listed again. */
  const deleteTask = useCallback(async (task) => {
    if (!hostelCode || !task?.id) return;
    const ref = taskRef(hostelCode, task.id);
    const [photos, comments] = await Promise.all([
      getDocs(collection(ref, 'photos')),
      getDocs(collection(ref, 'comments')),
    ]);
    const children = [...photos.docs, ...comments.docs];
    for (let i = 0; i < children.length; i += 400) {
      const batch = writeBatch(db);
      children.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    const last = writeBatch(db);
    last.delete(ref);
    await last.commit();
  }, [hostelCode]);

  return useMemo(() => ({
    enabled,
    billingLoaded,
    loaded,
    tasks,
    myTasks,
    myReports,
    counts,
    assignable,
    managerSees,
    canManage,
    nameOf,
    uid,
    reportIssue,
    createTask,
    updateTask,
    setStatus,
    dismiss,
    restore,
    clearForMe,
    toggleChecklistItem,
    deleteTask,
  }), [
    enabled, billingLoaded, loaded, tasks, myTasks, myReports, counts, assignable, managerSees, canManage,
    nameOf, uid, reportIssue, createTask, updateTask, setStatus, dismiss, restore, clearForMe,
    toggleChecklistItem, deleteTask,
  ]);
}

/* ─── Detail view: comments + photos, loaded only when a task is open ── */

export function useTaskThread(task) {
  const { hostelCode, userData } = useApp();
  const uid = auth.currentUser?.uid || null;
  const taskId = task?.id || null;

  const [comments, setComments] = useState([]);
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    setComments([]);
    setPhotos([]);
    if (!hostelCode || !taskId) return undefined;

    const base = taskRef(hostelCode, taskId);
    const warn = (what) => (e) => console.warn(`maintenance ${what} listener stopped:`, e.code);

    const u1 = onSnapshot(
      query(collection(base, 'comments'), orderBy('at', 'asc')),
      s => setComments(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      warn('comments'),
    );
    const u2 = onSnapshot(
      query(collection(base, 'photos'), orderBy('at', 'asc')),
      s => setPhotos(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      warn('photos'),
    );
    return () => { u1(); u2(); };
  }, [hostelCode, taskId]);

  const addComment = useCallback(async (text) => {
    const clean = str(text, 1000);
    if (!clean || !hostelCode || !taskId) return;
    const ref = doc(collection(taskRef(hostelCode, taskId), 'comments'));
    const batch = writeBatch(db);
    batch.set(ref, { text: clean, by: uid, at: Date.now() });
    await batch.commit();

    // Tell the other side. Workers → managers; managers → assignees.
    const who = userData?.username || '';
    const body = `${who}: ${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''}`;
    const data = { type: 'maint_comment', taskId };
    if ((task.assignees || []).includes(uid)) {
      quiet(pushToManagers(task.title, body, data));
    } else {
      (task.assignees || [])
        .filter(a => a !== uid)
        .forEach(a => quiet(pushToUser(a, task.title, body, data)));
    }
  }, [hostelCode, taskId, uid, userData?.username, task]);

  /** kind: 'progress' while working, 'fix' as proof it's done. */
  const addPhoto = useCallback(async (base64, kind = 'progress') => {
    if (!base64 || !hostelCode || !taskId) return;
    checkPhoto(base64);
    const parent = taskRef(hostelCode, taskId);
    const batch = writeBatch(db);
    batch.set(doc(collection(parent, 'photos')), {
      data: base64, by: uid, at: Date.now(), kind,
    });
    // The reporter of a still-'reported' task can't update the parent, so
    // they can't add photos after the fact — they attach one when reporting.
    batch.update(parent, { photoCount: increment(1), updatedAt: Date.now() });
    await batch.commit();
  }, [hostelCode, taskId, uid]);

  return { comments, photos, addComment, addPhoto };
}