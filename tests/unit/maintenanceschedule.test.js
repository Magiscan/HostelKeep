/**
 * The maintenance worker's day planner and progress bar
 * (src/utils/maintenanceSchedule.js). Pure functions, no Firebase.
 *
 * Runs in Europe/Rome so the daylight-saving test means something: on
 * 25 Oct 2026 clocks go back an hour, and "tomorrow" must still start at
 * midnight, not 23:00.
 */
process.env.TZ = 'Europe/Rome';

import { planDay, countsByDay, startOfDay, addDays } from '../../src/utils/maintenanceSchedule';

const U = 'marco';
const H = 3600 * 1000;
// Monday 12 October 2026, 19:30 local.
const NOW = new Date(2026, 9, 12, 19, 30).getTime();
const T0 = startOfDay(NOW);

const ts = (ms) => ({ toMillis: () => ms });          // Firestore Timestamp shape
const ids = (list) => list.map(x => x.id);

const base = () => ([
  { id: 'overdue',   status: 'open',        assignees: [U], dueAt: addDays(T0, -2) + 10 * H },
  { id: 'today',     status: 'in_progress', assignees: [U], dueAt: T0 + 18 * H },
  { id: 'anytime',   status: 'open',        assignees: [U], dueAt: null },
  { id: 'waiting',   status: 'on_hold',     assignees: [U], dueAt: null },
  { id: 'tomorrow',  status: 'open',        assignees: [U], dueAt: addDays(T0, 1) + 12 * H },
  { id: 'friday',    status: 'open',        assignees: [U], dueAt: addDays(T0, 4) + 9 * H },
  { id: 'nextMonth', status: 'open',        assignees: [U], dueAt: addDays(T0, 30) },
  { id: 'fixedNow',  status: 'done',        assignees: [U], dueAt: addDays(T0, 3), doneAt: NOW - 60 * 1000 },
  { id: 'fixedYest', status: 'done',        assignees: [U], doneAt: addDays(T0, -1) + 10 * H },
  { id: 'notMine',   status: 'open',        assignees: ['luca'], dueAt: null },
  { id: 'dismissed', status: 'dismissed',   assignees: [U], dueAt: T0 + H },
  { id: 'reported',  status: 'reported',    assignees: [], reportedBy: U, dueAt: null },
]);

describe('dates', () => {
  test('startOfDay is local midnight', () => {
    const d = new Date(T0);
    expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([0, 0, 12]);
  });

  test('addDays keeps midnight across the end of summer time (25 Oct 2026)', () => {
    const sat = startOfDay(new Date(2026, 9, 24, 15, 0).getTime());
    const sun = addDays(sat, 1);
    const mon = addDays(sat, 2);
    expect(new Date(sun).getHours()).toBe(0);
    expect(new Date(mon).getHours()).toBe(0);
    expect(new Date(mon).getDate()).toBe(26);
    expect(sun - sat).toBe(24 * H);          // Saturday→Sunday is a normal day
    expect(mon - sun).toBe(25 * H);          // Sunday has the extra hour (03:00 → 02:00)
  });
});

describe('today', () => {
  const day = planDay(base(), U, 0, NOW);

  test('overdue, due today and undated work all land on today', () => {
    expect(ids(day.overdue)).toEqual(['overdue']);
    expect(ids(day.due)).toEqual(['today']);
    expect(ids(day.anytime).sort()).toEqual(['anytime', 'waiting']);
  });

  test('only tasks assigned to me count', () => {
    const all = [...day.overdue, ...day.due, ...day.anytime, ...day.fixed];
    expect(ids(all)).not.toContain('notMine');
  });

  test('dismissed and untriaged reports are never on the plan', () => {
    const all = [...day.overdue, ...day.due, ...day.anytime, ...day.fixed];
    expect(ids(all)).not.toContain('dismissed');
    expect(ids(all)).not.toContain('reported');
  });

  test('"fixed today" goes by when it was fixed, not when it was due', () => {
    expect(ids(day.fixed)).toEqual(['fixedNow']);
  });

  test('progress = fixed today / (to do today + fixed today)', () => {
    // to do: overdue, today, anytime, waiting = 4 · fixed: 1
    expect(day.openCount).toBe(4);
    expect(day.progress).toEqual({ done: 1, total: 5, pct: 20 });
  });

  test('fixing a task moves the bar', () => {
    const tasks = base();
    Object.assign(tasks.find(x => x.id === 'today'), { status: 'done', doneAt: NOW });
    expect(planDay(tasks, U, 0, NOW).progress).toEqual({ done: 2, total: 5, pct: 40 });
  });

  test('removing a fixed task from the list does not take progress back', () => {
    const tasks = base();
    tasks.find(x => x.id === 'fixedNow').clearedBy = [U];
    expect(planDay(tasks, U, 0, NOW).progress.done).toBe(1);
  });

  test('in progress comes before waiting before to-do', () => {
    const tasks = [
      { id: 'a', status: 'open',        assignees: [U], dueAt: null },
      { id: 'b', status: 'on_hold',     assignees: [U], dueAt: null },
      { id: 'c', status: 'in_progress', assignees: [U], dueAt: null },
    ];
    expect(ids(planDay(tasks, U, 0, NOW).anytime)).toEqual(['c', 'b', 'a']);
  });

  test('everything fixed → 100%', () => {
    const tasks = [{ id: 'x', status: 'done', assignees: [U], doneAt: NOW - 1000 }];
    expect(planDay(tasks, U, 0, NOW).progress).toEqual({ done: 1, total: 1, pct: 100 });
  });
});

describe('other days', () => {
  test('tomorrow shows only what is due tomorrow', () => {
    const d = planDay(base(), U, 1, NOW);
    expect(ids(d.due)).toEqual(['tomorrow']);
    expect(d.overdue).toEqual([]);
    expect(d.anytime).toEqual([]);
    expect(d.isToday).toBe(false);
  });

  test('a day later in the week', () => {
    expect(ids(planDay(base(), U, 4, NOW).due)).toEqual(['friday']);
  });

  test('a task fixed early shows on the day it was fixed, not the day it was due', () => {
    expect(ids(planDay(base(), U, 3, NOW).fixed)).toEqual([]);
  });

  test('yesterday shows what was fixed yesterday and nothing to do', () => {
    const d = planDay(base(), U, -1, NOW);
    expect(d.isPast).toBe(true);
    expect(ids(d.fixed)).toEqual(['fixedYest']);
    expect(d.openCount).toBe(0);
    expect(d.progress.pct).toBe(100);
  });

  test('far ahead still works (no fixed window)', () => {
    expect(ids(planDay(base(), U, 30, NOW).due)).toEqual(['nextMonth']);
  });

  test('a task due exactly at midnight belongs to that day', () => {
    const tasks = [{ id: 'm', status: 'open', assignees: [U], dueAt: addDays(T0, 2) }];
    expect(ids(planDay(tasks, U, 2, NOW).due)).toEqual(['m']);
    expect(planDay(tasks, U, 1, NOW).due).toEqual([]);
  });
});

describe('date formats from Firestore', () => {
  test('Timestamp objects (e.g. edited in the console) are understood', () => {
    const tasks = [
      { id: 'a', status: 'open', assignees: [U], dueAt: ts(T0 + 9 * H) },
      { id: 'b', status: 'done', assignees: [U], doneAt: ts(NOW - 5000) },
    ];
    const d = planDay(tasks, U, 0, NOW);
    expect(ids(d.due)).toEqual(['a']);
    expect(ids(d.fixed)).toEqual(['b']);
    expect(d.progress.pct).toBe(50);
  });

  test('ISO strings are understood', () => {
    const tasks = [{ id: 'a', status: 'open', assignees: [U], dueAt: new Date(T0 + 9 * H).toISOString() }];
    expect(ids(planDay(tasks, U, 0, NOW).due)).toEqual(['a']);
  });

  test('garbage dates are treated as "no date", not as a crash', () => {
    const tasks = [{ id: 'a', status: 'open', assignees: [U], dueAt: 'not a date' }];
    expect(ids(planDay(tasks, U, 0, NOW).anytime)).toEqual(['a']);
  });
});

describe('edge cases', () => {
  test('no tasks at all', () => {
    const d = planDay(undefined, U, 0, NOW);
    expect(d.progress).toEqual({ done: 0, total: 0, pct: 0 });
    expect(d.openCount).toBe(0);
  });

  test('a task without an assignees field does not crash', () => {
    expect(planDay([{ id: 'x', status: 'open' }], U, 0, NOW).openCount).toBe(0);
  });

  test('week badges count open work per day', () => {
    expect(countsByDay(base(), U, -1, 6, NOW)).toEqual({ '-1': 0, 0: 4, 1: 1, 2: 0, 3: 0, 4: 1 });
  });
});