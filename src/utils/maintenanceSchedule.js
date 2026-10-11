// src/utils/maintenanceSchedule.js
//
// Pure scheduling maths for the maintenance worker's screen. No React, no
// Firestore — so it can be tested on its own (see the check in the guide).
//
// A worker looks at ONE day at a time (dayOffset: 0 = today, 1 = tomorrow,
// -1 = yesterday …). For that day:
//
//   open    tasks still to do that belong to the day:
//             today   → overdue + due today + no due date ("anytime")
//             future  → due that day
//             past    → nothing (overdue work is shown on today)
//   fixed   tasks fixed ON that day (doneAt inside the day) — whatever their
//           due date. Includes ones the worker removed from their list, so
//           removing never takes progress back.
//   progress = fixed / (open + fixed)
//
// So the bar moves the moment a task is marked fixed, and every day starts
// fresh.

const DAY = 24 * 3600 * 1000;
const OPEN = ['open', 'in_progress', 'on_hold'];
const workOrder = { in_progress: 0, on_hold: 1, open: 2 };
const byWork = (a, b) => (workOrder[a.status] ?? 3) - (workOrder[b.status] ?? 3)
  || (a.dueAt || Infinity) - (b.dueAt || Infinity);

export function startOfDay(ms = Date.now()) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Calendar-safe (DST): uses setDate, never ms arithmetic. */
export function addDays(ms, n) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

const toMs = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v.toMillis === 'function') return v.toMillis();          // Firestore Timestamp
  const n = new Date(v).getTime();
  return Number.isFinite(n) ? n : null;
};

/**
 * @param tasks     every task this worker can see (assigned to them)
 * @param uid       the worker
 * @param dayOffset 0 = today
 * @param now       for tests
 */
export function planDay(tasks, uid, dayOffset = 0, now = Date.now()) {
  const today0 = startOfDay(now);
  const from = addDays(today0, dayOffset);
  const to = addDays(today0, dayOffset + 1);

  const mine = (tasks || []).filter(t => (t.assignees || []).includes(uid));
  const due = (t) => toMs(t.dueAt);
  const doneAt = (t) => toMs(t.doneAt);

  const open = mine.filter(t => OPEN.includes(t.status));

  let overdue = [];
  let dueThatDay = [];
  let anytime = [];
  if (dayOffset === 0) {
    overdue = open.filter(t => due(t) != null && due(t) < from);
    anytime = open.filter(t => due(t) == null);
  }
  if (dayOffset >= 0) {
    dueThatDay = open.filter(t => due(t) != null && due(t) >= from && due(t) < to);
  }

  const fixedThatDay = mine
    .filter(t => t.status === 'done' && doneAt(t) != null && doneAt(t) >= from && doneAt(t) < to)
    .sort((a, b) => doneAt(b) - doneAt(a));

  const openCount = overdue.length + dueThatDay.length + anytime.length;
  const done = fixedThatDay.length;
  const total = openCount + done;

  return {
    from,
    isToday: dayOffset === 0,
    isPast: dayOffset < 0,
    overdue: overdue.sort(byWork),
    due: dueThatDay.sort(byWork),
    anytime: anytime.sort(byWork),
    fixed: fixedThatDay,
    openCount,
    progress: { done, total, pct: total ? Math.round((done / total) * 100) : 0 },
  };
}

/** Open-task counts for a run of days, for the week strip's badges. */
export function countsByDay(tasks, uid, fromOffset, days, now = Date.now()) {
  const out = {};
  for (let i = 0; i < days; i += 1) {
    const off = fromOffset + i;
    out[off] = planDay(tasks, uid, off, now).openCount;
  }
  return out;
}

export { DAY };