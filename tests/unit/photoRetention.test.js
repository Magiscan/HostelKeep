/**
 * Photo retention (src/utils/photoRetention.js): photos are deleted 30 days
 * after a task is finished, with a warning in the last 7. Pure functions.
 */
import {
  finishedAt, photosDeleteAt, photosToPurge, photosExpiringSoon,
  PHOTO_RETENTION_DAYS, PHOTO_WARNING_DAYS,
} from '../../src/utils/photoRetention';

const DAY = 24 * 3600 * 1000;
const NOW = new Date(2026, 9, 12, 12, 0).getTime();
const ids = (list) => list.map(x => x.id).sort();

const tasks = [
  { id: 'doneOld',      status: 'done', doneAt: NOW - 31 * DAY, photoCount: 2 },
  { id: 'doneSoon',     status: 'done', doneAt: NOW - 25 * DAY, photoCount: 1 },
  { id: 'doneRecent',   status: 'done', doneAt: NOW - 3 * DAY,  photoCount: 4 },
  { id: 'doneNoPhotos', status: 'done', doneAt: NOW - 90 * DAY, photoCount: 0 },
  { id: 'archivedOld',  status: 'dismissed', dismissedAt: NOW - 40 * DAY, updatedAt: NOW - 1 * DAY, photoCount: 1 },
  { id: 'archivedLegacy', status: 'dismissed', updatedAt: NOW - 35 * DAY, photoCount: 1 },
  { id: 'openOld',      status: 'open', reportedAt: NOW - 200 * DAY, photoCount: 3 },
  { id: 'reopened',     status: 'in_progress', doneAt: null, photoCount: 3 },
  { id: 'purged',       status: 'done', doneAt: NOW - 60 * DAY, photoCount: 0, photosPurgedAt: NOW - 30 * DAY },
];

test('the agreed numbers', () => {
  expect(PHOTO_RETENTION_DAYS).toBe(30);
  expect(PHOTO_WARNING_DAYS).toBe(7);
});

describe('finishedAt', () => {
  test('done tasks use doneAt', () => expect(finishedAt(tasks[0])).toBe(NOW - 31 * DAY));
  test('archived tasks use dismissedAt, not their last update', () => expect(finishedAt(tasks[4])).toBe(NOW - 40 * DAY));
  test('archived before dismissedAt existed: last update', () => expect(finishedAt(tasks[5])).toBe(NOW - 35 * DAY));
  test('open work is never finished', () => expect(finishedAt(tasks[6])).toBeNull());
  test('Timestamp values are read', () => {
    expect(finishedAt({ status: 'done', doneAt: { toMillis: () => 123 } })).toBe(123);
  });
});

test('photos older than 30 days after finishing are due', () => {
  expect(ids(photosToPurge(tasks, NOW))).toEqual(['archivedLegacy', 'archivedOld', 'doneOld']);
});

test('open, reopened and photo-less tasks are never touched', () => {
  const due = ids(photosToPurge(tasks, NOW));
  ['openOld', 'reopened', 'doneNoPhotos', 'purged', 'doneRecent'].forEach(id => expect(due).not.toContain(id));
});

test('warning only in the last 7 days', () => {
  expect(ids(photosExpiringSoon(tasks, NOW))).toEqual(['doneSoon']);
});

test('delete date is exactly 30 days after finishing', () => {
  expect(photosDeleteAt(tasks[1])).toBe(NOW - 25 * DAY + 30 * DAY);
  expect(photosDeleteAt(tasks[3])).toBeNull();
});

test('no tasks at all', () => {
  expect(photosToPurge(undefined, NOW)).toEqual([]);
  expect(photosExpiringSoon(null, NOW)).toEqual([]);
});