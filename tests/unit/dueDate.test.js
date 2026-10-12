/**
 * The custom due-date helpers behind "Pick date & time" (maintenanceUi.js)
 * and where an archived task goes when a manager restores it.
 */
process.env.TZ = 'Europe/Rome';

jest.mock('firebase/firestore', () => ({}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('../../src/firebase', () => ({ db: {}, auth: { currentUser: null } }));
jest.mock('../../src/contexts/AppContext', () => ({ useApp: () => ({}) }));
jest.mock('../../src/utils/notify', () => ({ notifyHostel: jest.fn(), bucketOf: jest.fn() }));
jest.mock('../../src/services/push', () => ({ pushToManagers: jest.fn(), pushToUser: jest.fn() }));
jest.mock('../../src/i18n', () => ({
  __esModule: true,
  default: { t: (key, opts) => (opts && opts.defaultValue) || key },
}));

import { defaultCustomDue, minimumDueDate, toLocalInput, dueOptions, photoFileName } from '../../src/components/maintenance/maintenanceUi';
import { restoredStatus } from '../../src/hooks/useMaintenance';

// Monday 12 October 2026, 21:40 local.
const NOW = new Date(2026, 9, 12, 21, 40).getTime();
const t = (_k, fallback) => fallback;

describe('Pick date & time', () => {
  test('starts at tomorrow 09:00 when there is no date yet', () => {
    const d = new Date(defaultCustomDue(NOW));
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([13, 9, 0]);
  });

  test('cannot pick a day before today', () => {
    const d = minimumDueDate(null, NOW);
    expect([d.getDate(), d.getHours()]).toEqual([12, 0]);
  });

  test('an overdue task keeps its past date pickable', () => {
    const past = new Date(2026, 9, 5, 10, 0).getTime();
    expect(minimumDueDate(past, NOW).getTime()).toBe(past);
  });

  test('a Timestamp due date works too', () => {
    const past = new Date(2026, 9, 5, 10, 0).getTime();
    expect(minimumDueDate({ toMillis: () => past }, NOW).getTime()).toBe(past);
  });

  test('web field value is local time, not UTC', () => {
    expect(toLocalInput(new Date(2026, 9, 14, 8, 5).getTime())).toBe('2026-10-14T08:05');
    expect(toLocalInput(null)).toBe('');
  });

  test('the quick chips are still there', () => {
    expect(dueOptions(t).map(o => o.key)).toEqual(['none', 'today', 'tomorrow', '3d', 'week']);
  });
});

describe('saved photo file names', () => {
  test('task title and local time, safe characters only', () => {
    const at = new Date(2026, 9, 12, 9, 30).getTime();
    expect(photoFileName('Doccia: scarico intasato!', at)).toBe('hostelkeep-doccia-scarico-intasato-2026-10-12-0930.jpg');
  });

  test('accents are kept readable, not dropped', () => {
    const at = new Date(2026, 0, 2, 14, 5).getTime();
    expect(photoFileName('Baño roto', at)).toBe('hostelkeep-bano-roto-2026-01-02-1405.jpg');
  });

  test('no title still gives a valid name', () => {
    const at = new Date(2026, 0, 2, 14, 5).getTime();
    expect(photoFileName('', at)).toBe('hostelkeep-2026-01-02-1405.jpg');
  });
});

describe('restoring an archived task', () => {
  test('goes back to To do when someone is assigned', () => {
    expect(restoredStatus({ status: 'dismissed', assignees: ['marco'] })).toBe('open');
  });

  test('goes back to To review when nobody is', () => {
    expect(restoredStatus({ status: 'dismissed', assignees: [] })).toBe('reported');
    expect(restoredStatus({ status: 'dismissed' })).toBe('reported');
  });
});