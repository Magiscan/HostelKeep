/**
 * The pure helpers exported by src/hooks/useMaintenance.js, plus a check that
 * the client's vocabulary (statuses, priorities, limits) matches what
 * firestore.rules accepts. Firebase and the contexts are mocked: nothing here
 * talks to a database.
 */
// The Firebase SDK ships as ES modules that jest-expo doesn't transform. These
// helpers never call it, so an empty stand-in is enough.
jest.mock('firebase/firestore', () => ({}));
jest.mock('../../src/firebase', () => ({ db: {}, auth: { currentUser: null } }));
jest.mock('../../src/contexts/AppContext', () => ({ useApp: () => ({}) }));
jest.mock('../../src/utils/notify', () => ({ notifyHostel: jest.fn(), bucketOf: jest.fn() }));
jest.mock('../../src/services/push', () => ({ pushToManagers: jest.fn(), pushToUser: jest.fn() }));
jest.mock('../../src/i18n', () => ({
  __esModule: true,
  default: { t: (key, opts) => (opts && opts.defaultValue) || key },
}));

import fs from 'fs';
import path from 'path';
import {
  PRIORITIES, ACTIVE_STATUSES, CLOSED_STATUSES, WORK_STATUSES, MAX_PHOTO_CHARS,
  normaliseChecklist, isClearedFor, isFinished, isOverdue, locationLabel, compareTasks,
  normalisePlaces, placesOf, MAX_PLACES,
} from '../../src/hooks/useMaintenance';

const NOW = new Date(2026, 9, 12, 12, 0).getTime();
const H = 3600 * 1000;
const ts = (ms) => ({ toMillis: () => ms, valueOf: () => String(Math.floor(ms / 1000)).padStart(15, '0') });

describe('checklist', () => {
  test('accepts plain strings and objects, trims, drops blanks', () => {
    const out = normaliseChecklist(['  Bring the snake ', '', { text: 'Test the flow', done: true }, { text: '   ' }]);
    expect(out.map(i => i.text)).toEqual(['Bring the snake', 'Test the flow']);
    expect(out[1].done).toBe(true);
    expect(out.every(i => typeof i.id === 'string' && i.id.length > 0)).toBe(true);
  });

  test('keeps existing ids (ticks stay attached to the right step)', () => {
    expect(normaliseChecklist([{ id: 'c1', text: 'x', done: false }])[0].id).toBe('c1');
  });

  test('caps at 30 steps and 120 characters (the rules limit)', () => {
    const out = normaliseChecklist(Array.from({ length: 40 }, (_, i) => `Step ${i} ${'x'.repeat(200)}`));
    expect(out).toHaveLength(30);
    expect(out[0].text.length).toBe(120);
  });

  test('anything that is not a list becomes an empty list', () => {
    expect(normaliseChecklist(undefined)).toEqual([]);
    expect(normaliseChecklist('oops')).toEqual([]);
  });
});

describe('finished and cleared', () => {
  test('done and dismissed are finished; nothing else', () => {
    expect(['done', 'dismissed'].every(s => isFinished({ status: s }))).toBe(true);
    expect(['reported', 'open', 'in_progress', 'on_hold'].some(s => isFinished({ status: s }))).toBe(false);
    expect(isFinished(undefined)).toBe(false);
  });

  test('cleared is per person', () => {
    const t = { status: 'done', clearedBy: ['marco'] };
    expect(isClearedFor(t, 'marco')).toBe(true);
    expect(isClearedFor(t, 'maria')).toBe(false);
    expect(isClearedFor({ status: 'done' }, 'marco')).toBe(false);
  });
});

describe('overdue', () => {
  test('open and past due', () => {
    expect(isOverdue({ status: 'open', dueAt: NOW - H }, NOW)).toBe(true);
  });

  test('not yet due, no date, or already finished', () => {
    expect(isOverdue({ status: 'open', dueAt: NOW + H }, NOW)).toBe(false);
    expect(isOverdue({ status: 'open', dueAt: null }, NOW)).toBe(false);
    expect(isOverdue({ status: 'done', dueAt: NOW - H }, NOW)).toBe(false);
    expect(isOverdue({ status: 'dismissed', dueAt: NOW - H }, NOW)).toBe(false);
  });

  test('a Timestamp due date (edited in the console) is read correctly', () => {
    // Before the fix, Timestamp < number compared seconds-as-text with millis
    // and every such task looked overdue.
    expect(isOverdue({ status: 'open', dueAt: ts(NOW + 5 * 24 * H) }, NOW)).toBe(false);
    expect(isOverdue({ status: 'open', dueAt: ts(NOW - H) }, NOW)).toBe(true);
  });
});

describe('sorting (manager board and worker lists)', () => {
  const t = (id, o) => ({ id, status: 'open', priority: 'medium', dueAt: null, reportedAt: 0, ...o });

  test('overdue first, then priority, then soonest due, then newest', () => {
    const list = [
      t('lowSoon', { priority: 'low', dueAt: NOW + H }),
      t('urgent', { priority: 'urgent' }),
      t('overdueLow', { priority: 'low', dueAt: NOW - H }),
      t('mediumLater', { dueAt: NOW + 5 * H }),
      t('mediumSoon', { dueAt: NOW + 2 * H }),
      t('mediumNoDateNew', { reportedAt: 200 }),
      t('mediumNoDateOld', { reportedAt: 100 }),
    ];
    const order = [...list].sort((a, b) => compareTasks(a, b, NOW)).map(x => x.id);
    expect(order).toEqual([
      'overdueLow', 'urgent', 'mediumSoon', 'mediumLater', 'mediumNoDateNew', 'mediumNoDateOld', 'lowSoon',
    ]);
  });

  test('Timestamp due dates sort like numbers', () => {
    const a = t('a', { dueAt: ts(NOW + 2 * H) });
    const b = t('b', { dueAt: NOW + 1 * H });
    expect([a, b].sort((x, y) => compareTasks(x, y, NOW)).map(x => x.id)).toEqual(['b', 'a']);
  });
});

describe('several rooms and beds', () => {
  test('placesOf reads new tasks and tasks written before multi-room', () => {
    expect(placesOf({ places: [{ roomId: 'r1', beds: ['A'] }] })).toEqual([{ roomId: 'r1', beds: ['A'] }]);
    expect(placesOf({ roomId: 'r1' })).toEqual([{ roomId: 'r1', beds: [] }]);
    expect(placesOf({ area: 'Laundry' })).toEqual([]);
  });

  test('duplicates and junk are dropped; limits match the rules', () => {
    const out = normalisePlaces([
      { roomId: 'r1', beds: ['A', 'A', '', null] }, { roomId: 'r1', beds: ['B'] }, 'r2', null, { beds: ['x'] },
      ...Array.from({ length: 30 }, (_, i) => ({ roomId: `x${i}` })),
    ]);
    expect(out[0]).toEqual({ roomId: 'r1', beds: ['A'] });
    expect(out[1]).toEqual({ roomId: 'r2', beds: [] });
    expect(out).toHaveLength(MAX_PLACES);
  });
});

describe('location label', () => {
  const rooms = [
    { id: 'r1', name: '101' },
    { id: 'd1', name: 'Dorm 4', type: 'dorm', beds: [{ id: 'b1', name: 'A' }, { id: 'b2', name: 'B' }, { id: 'b3', name: 'C' }] },
  ];
  test('several rooms', () => expect(locationLabel({ places: [{ roomId: 'r1', beds: [] }, { roomId: 'd1', beds: [] }] }, rooms)).toBe('101 · Dorm 4'));
  test('specific beds use their names', () => expect(locationLabel({ places: [{ roomId: 'd1', beds: ['b1', 'b3'] }] }, rooms)).toBe('Dorm 4 (A, C)'));
  test('a deleted room is skipped', () => expect(locationLabel({ places: [{ roomId: 'gone', beds: [] }, { roomId: 'r1', beds: [] }] }, rooms)).toBe('101'));
  test('room name', () => expect(locationLabel({ roomId: 'r1' }, rooms)).toBe('101'));
  test('free-text place', () => expect(locationLabel({ roomId: null, area: 'Laundry' }, rooms)).toBe('Laundry'));
  test('deleted room falls back, never crashes', () => expect(locationLabel({ roomId: 'gone' }, rooms)).toBe('—'));
  test('nothing at all → General', () => expect(locationLabel({}, rooms)).toBe('General'));
});

describe('client and firestore.rules agree', () => {
  const rules = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
  const listAfter = (marker) => {
    const at = rules.indexOf(marker);
    const m = rules.slice(at).match(/\[([^\]]*)\]/);
    return m[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
  };

  test('statuses', () => {
    expect(listAfter('d.status in').sort()).toEqual([...ACTIVE_STATUSES, ...CLOSED_STATUSES].sort());
  });

  test('worker statuses are the ones the assignee rule lets them move between', () => {
    expect(listAfter('&& resource.data.status in').sort()).toEqual([...WORK_STATUSES].sort());
  });

  test('priorities', () => {
    expect(listAfter('d.priority in')).toEqual(PRIORITIES);
  });

  test('room limit', () => {
    expect(rules).toContain(`d.get('places', []).size() <= ${MAX_PLACES}`);
  });

  test('photo limit', () => {
    expect(rules).toContain(`data.data.size() < ${MAX_PHOTO_CHARS}`);
  });
});