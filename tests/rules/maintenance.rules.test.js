/**
 * Maintenance (Pro+) security rules — runs against the LOCAL emulator.
 *
 *   npm run test:rules
 *
 * Same harness as firestore.rules.test.js, with its own seed so the two files
 * never interfere. Every write below has the exact shape the app sends
 * (src/hooks/useMaintenance.js → buildTask / setStatus / clearForMe …).
 *
 *   "can …"    fails → the app's own action is being DENIED in production.
 *   "cannot …" fails → the rules ALLOW something they must not.
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField,
  collection, query, where, writeBatch, increment, arrayUnion, Timestamp,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-hostelkeep-maint';
const DAY = 24 * 60 * 60 * 1000;

const PP = 'MNT234';     // Pro+ hostel
const PRO = 'PRO567';    // plain Pro hostel (no tier)

const OWNER = 'm-owner';
const WORKER = 'm-worker';    // cleaner, team: maintenance
const HK = 'm-hk';            // housekeeper
const HK2 = 'm-hk2';          // housekeeper
const MSTAFF = 'm-mstaff';    // staff: 'maintenance' perm + section
const VIEWER = 'm-viewer';    // staff: section only, no perm
const DESK = 'm-desk';        // staff: no maintenance at all
const LEAD = 'm-lead';        // staff: manageTeam only
const PROOWNER = 'p-owner';   // owner of the Pro hostel
const PROHK = 'p-hk';         // housekeeper in the Pro hostel

const ROLES = {
  maint:  { name: 'Maintenance manager', perms: ['maintenance'], sections: ['dashboard', 'maintenance'] },
  viewer: { name: 'Viewer', perms: [], sections: ['dashboard', 'maintenance'] },
  desk:   { name: 'Front desk', perms: ['assign'], sections: ['dashboard', 'assign'] },
  lead:   { name: 'Team lead', perms: ['manageTeam'], sections: ['team'] },
};

const T = (id) => `hostels/${PP}/maintenance/${id}`;

let testEnv;
const as = (uid) => testEnv.authenticatedContext(uid).firestore();

// What buildTask() writes. Every key present, nothing undefined.
const task = (o = {}) => ({
  title: 'Shower drain blocked',
  description: '',
  places: [{ roomId: 'room101', beds: [] }],
  roomId: 'room101',
  area: null,
  priority: 'medium',
  status: 'reported',
  assignees: [],
  reportedBy: HK,
  reportedAt: 1760000000000,
  dueAt: null,
  checklist: [],
  photoCount: 0,
  startedAt: null,
  doneAt: null,
  doneBy: null,
  holdReason: null,
  updatedAt: 1760000000000,
  ...o,
});

const setBilling = (code, data) => testEnv.withSecurityRulesDisabled(
  (ctx) => setDoc(doc(ctx.firestore(), `billing/${code}`), data),
);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (p, data) => setDoc(doc(db, p), data);
    const now = new Date().toISOString();

    // ── people ──
    await put(`users/${OWNER}`, { username: 'Maria', role: 'manager', hostelCode: PP, hostelCodes: [PP], email: 'maria@example.com' });
    await put(`users/${WORKER}`, { username: 'marco', role: 'cleaner', team: 'maintenance', hostelCode: PP, email: 'cleaner_marco_mnt234@keepclean.app' });
    await put(`users/${HK}`, { username: 'luca', role: 'cleaner', hostelCode: PP, email: 'cleaner_luca_mnt234@keepclean.app' });
    await put(`users/${HK2}`, { username: 'sara', role: 'cleaner', hostelCode: PP, email: 'cleaner_sara_mnt234@keepclean.app' });
    await put(`users/${MSTAFF}`, { username: 'Ana', role: 'staff', roleId: 'maint', hostelCode: PP, email: 'ana@example.com' });
    await put(`users/${VIEWER}`, { username: 'Vic', role: 'staff', roleId: 'viewer', hostelCode: PP, email: 'vic@example.com' });
    await put(`users/${DESK}`, { username: 'Gio', role: 'staff', roleId: 'desk', hostelCode: PP, email: 'gio@example.com' });
    await put(`users/${LEAD}`, { username: 'Lea', role: 'staff', roleId: 'lead', hostelCode: PP, email: 'lea@example.com' });
    await put(`users/${PROOWNER}`, { username: 'Otto', role: 'manager', hostelCode: PRO, hostelCodes: [PRO], email: 'otto@example.com' });
    await put(`users/${PROHK}`, { username: 'pia', role: 'cleaner', hostelCode: PRO, email: 'cleaner_pia_pro567@keepclean.app' });

    // ── hostels ──
    for (const [code, uid] of [[PP, OWNER], [PRO, PROOWNER]]) {
      await put(`hostelCodes/${code}`, { uid, createdAt: now });
      await put(`hostels/${code}`, { name: code, code, roomAttributes: [], createdAt: now });
      await put(`hostels/${code}/config/roles`, { roles: ROLES, updatedAt: now });
    }
    await put(`hostels/${PP}/rooms/room101`, { name: '101', floorId: 'f1', assignedTo: HK });

    // ── billing ──
    await put(`billing/${PP}`, {
      status: 'active', plan: 'monthly', tier: 'proplus',
      currentPeriodEnd: Timestamp.fromMillis(Date.now() + 20 * DAY),
    });
    await put(`billing/${PRO}`, {
      status: 'active', plan: 'monthly',
      currentPeriodEnd: Timestamp.fromMillis(Date.now() + 20 * DAY),
    });

    // ── tasks ──
    await put(T('t_reported'), task());
    await put(T('t_open'), task({
      status: 'open', assignees: [WORKER], reportedBy: OWNER,
      checklist: [{ id: 'c1', text: 'Unscrew the grate', done: false }],
    }));
    await put(T('t_done'), task({
      status: 'done', assignees: [WORKER], reportedBy: HK,
      startedAt: 1760000100000, doneAt: 1760000200000, doneBy: WORKER,
    }));
    await put(T('t_other'), task({ status: 'open', assignees: [MSTAFF], reportedBy: OWNER }));
    await put(T('t_dismissed'), task({ status: 'dismissed', assignees: [WORKER], reportedBy: HK2 }));
    await put(`${T('t_open')}/photos/p1`, { data: 'aaaa', by: OWNER, at: 1760000000000, kind: 'report' });
    await put(`${T('t_done')}/photos/p1`, { data: 'bbbb', by: WORKER, at: 1760000200000, kind: 'fix' });
  });
});

/* ───────────────────────────── reading ───────────────────────────── */

describe('reading tasks', () => {
  test('owner can load the whole board', async () => {
    await assertSucceeds(getDocs(collection(as(OWNER), `hostels/${PP}/maintenance`)));
  });

  test('staff with the maintenance section can load the board', async () => {
    await assertSucceeds(getDocs(collection(as(MSTAFF), `hostels/${PP}/maintenance`)));
    await assertSucceeds(getDocs(collection(as(VIEWER), `hostels/${PP}/maintenance`)));
  });

  test('staff without the section cannot load the board or open a task', async () => {
    await assertFails(getDocs(collection(as(DESK), `hostels/${PP}/maintenance`)));
    await assertFails(getDoc(doc(as(DESK), T('t_open'))));
  });

  test("worker's own query (assignees array-contains me) is allowed", async () => {
    const q = query(collection(as(WORKER), `hostels/${PP}/maintenance`), where('assignees', 'array-contains', WORKER));
    await assertSucceeds(getDocs(q));
  });

  test('worker cannot load the whole board', async () => {
    await assertFails(getDocs(collection(as(WORKER), `hostels/${PP}/maintenance`)));
  });

  test('worker can open their task, not someone else\'s', async () => {
    await assertSucceeds(getDoc(doc(as(WORKER), T('t_open'))));
    await assertFails(getDoc(doc(as(WORKER), T('t_other'))));
  });

  test("housekeeper's own query (reportedBy == me) is allowed", async () => {
    const q = query(collection(as(HK), `hostels/${PP}/maintenance`), where('reportedBy', '==', HK));
    await assertSucceeds(getDocs(q));
  });

  test('housekeeper cannot read tasks they did not report', async () => {
    await assertFails(getDoc(doc(as(HK), T('t_open'))));
    await assertFails(getDoc(doc(as(HK2), T('t_reported'))));
  });

  test('another hostel cannot read any task', async () => {
    await assertFails(getDoc(doc(as(PROOWNER), T('t_open'))));
  });

  test('photos follow the task: assignee yes, unrelated housekeeper no', async () => {
    await assertSucceeds(getDocs(collection(as(WORKER), `${T('t_open')}/photos`)));
    await assertFails(getDocs(collection(as(HK), `${T('t_open')}/photos`)));
  });
});

/* ───────────────────────────── reporting ───────────────────────────── */

describe('reporting a problem (housekeeper)', () => {
  test('can report, exactly as reportIssue() writes it', async () => {
    await assertSucceeds(setDoc(doc(as(HK), T('new1')), task()));
  });

  test('can report with a photo in the same batch', async () => {
    const db = as(HK);
    const b = writeBatch(db);
    b.set(doc(db, T('new2')), task({ photoCount: 1 }));
    b.set(doc(db, `${T('new2')}/photos/p1`), { data: 'a'.repeat(300000), by: HK, at: Date.now(), kind: 'report' });
    await assertSucceeds(b.commit());
  });

  test('can report a common area instead of a room', async () => {
    await assertSucceeds(setDoc(doc(as(HK), T('new3')), task({ roomId: null, area: 'Laundry' })));
  });

  test('can report several rooms, with specific beds in a dorm', async () => {
    await assertSucceeds(setDoc(doc(as(HK), T('multi')), task({
      places: [{ roomId: 'room101', beds: ['A', 'C'] }, { roomId: 'room102', beds: [] }],
    })));
  });

  test('a task written before multi-room (no places) still validates', async () => {
    const legacy = task(); delete legacy.places;
    await assertSucceeds(setDoc(doc(as(HK), T('legacy')), legacy));
  });

  test('at most 20 rooms per task', async () => {
    const places = Array.from({ length: 21 }, (_, i) => ({ roomId: `r${i}`, beds: [] }));
    await assertFails(setDoc(doc(as(HK), T('toomany')), task({ places })));
  });

  test('cannot create an already-open task', async () => {
    await assertFails(setDoc(doc(as(HK), T('new4')), task({ status: 'open' })));
  });

  test('cannot assign, date or add steps to a report', async () => {
    await assertFails(setDoc(doc(as(HK), T('n5')), task({ assignees: [WORKER] })));
    await assertFails(setDoc(doc(as(HK), T('n6')), task({ dueAt: Date.now() })));
    await assertFails(setDoc(doc(as(HK), T('n7')), task({ checklist: [{ id: 'x', text: 'x', done: false }] })));
  });

  test('cannot report in someone else\'s name', async () => {
    await assertFails(setDoc(doc(as(HK), T('n8')), task({ reportedBy: HK2 })));
  });

  test('field limits are enforced', async () => {
    await assertFails(setDoc(doc(as(HK), T('n9')), task({ title: '' })));
    await assertFails(setDoc(doc(as(HK), T('n10')), task({ title: 'x'.repeat(121) })));
    await assertFails(setDoc(doc(as(HK), T('n11')), task({ description: 'x'.repeat(2001) })));
    await assertFails(setDoc(doc(as(HK), T('n12')), task({ priority: 'asap' })));
    await assertFails(setDoc(doc(as(HK), T('n13')), task({ foo: 1 })));
  });

  test('an unresized photo is refused', async () => {
    await assertFails(setDoc(doc(as(HK), `${T('t_reported')}/photos/big`), {
      data: 'a'.repeat(700001), by: HK, at: Date.now(), kind: 'report',
    }));
  });

  test('someone from another hostel cannot report here', async () => {
    await assertFails(setDoc(doc(as(PROHK), T('n14')), task({ reportedBy: PROHK })));
  });
});

/* ───────────────────────────── Pro+ gate ───────────────────────────── */

describe('Pro+ gate', () => {
  test('plain Pro: housekeeper cannot report, owner cannot create', async () => {
    await assertFails(setDoc(doc(as(PROHK), `hostels/${PRO}/maintenance/x`), task({ reportedBy: PROHK })));
    await assertFails(setDoc(doc(as(PROOWNER), `hostels/${PRO}/maintenance/y`), task({ status: 'open', reportedBy: PROOWNER })));
  });

  test('plan field is not the tier: plan "proplus" without tier does not unlock', async () => {
    await setBilling(PRO, { status: 'active', plan: 'proplus', currentPeriodEnd: Timestamp.fromMillis(Date.now() + 5 * DAY) });
    await assertFails(setDoc(doc(as(PROHK), `hostels/${PRO}/maintenance/z`), task({ reportedBy: PROHK })));
  });

  test('within the 3-day grace period it still works', async () => {
    await setBilling(PP, { status: 'active', tier: 'proplus', currentPeriodEnd: Timestamp.fromMillis(Date.now() - 1 * DAY) });
    await assertSucceeds(setDoc(doc(as(HK), T('grace')), task()));
  });

  test('after the grace period: no reports, no task work', async () => {
    await setBilling(PP, { status: 'active', tier: 'proplus', currentPeriodEnd: Timestamp.fromMillis(Date.now() - 4 * DAY) });
    await assertFails(setDoc(doc(as(HK), T('late')), task()));
    await assertFails(updateDoc(doc(as(WORKER), T('t_open')), { status: 'in_progress', startedAt: Date.now(), updatedAt: Date.now() }));
    await assertFails(updateDoc(doc(as(OWNER), T('t_reported')), { assignees: [WORKER], status: 'open', updatedAt: Date.now() }));
  });

  test('a canceled subscription is locked', async () => {
    await setBilling(PP, { status: 'canceled', tier: 'proplus', currentPeriodEnd: Timestamp.fromMillis(Date.now() + 20 * DAY) });
    await assertFails(setDoc(doc(as(HK), T('cx')), task()));
  });

  test('reading stays open on a lapsed plan (it is the hostel\'s own data)', async () => {
    await setBilling(PP, { status: 'canceled', tier: 'proplus', currentPeriodEnd: Timestamp.fromMillis(Date.now() - 30 * DAY) });
    await assertSucceeds(getDocs(collection(as(OWNER), `hostels/${PP}/maintenance`)));
  });

  test('the owner can still delete on a lapsed plan', async () => {
    await setBilling(PP, { status: 'canceled', tier: 'proplus', currentPeriodEnd: Timestamp.fromMillis(Date.now() - 30 * DAY) });
    await assertSucceeds(deleteDoc(doc(as(OWNER), T('t_open'))));
  });
});

/* ─────────────────────────── triage / manage ─────────────────────────── */

describe('managing tasks', () => {
  const triage = { assignees: [WORKER], status: 'open', priority: 'high', dueAt: Date.now() + DAY,
    checklist: [{ id: 'a', text: 'Bring the snake', done: false }], updatedAt: Date.now() };

  test('owner can triage a report (assign, date, steps)', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), T('t_reported')), triage));
  });

  test('staff with the maintenance perm can triage', async () => {
    await assertSucceeds(updateDoc(doc(as(MSTAFF), T('t_reported')), triage));
  });

  test('section-only staff and other staff cannot', async () => {
    await assertFails(updateDoc(doc(as(VIEWER), T('t_reported')), triage));
    await assertFails(updateDoc(doc(as(DESK), T('t_reported')), triage));
  });

  test('owner can create an open task directly', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), T('direct')), task({ status: 'open', reportedBy: OWNER, assignees: [WORKER] })));
  });

  test('nobody can rewrite who reported it, or when', async () => {
    await assertFails(updateDoc(doc(as(OWNER), T('t_reported')), { reportedBy: OWNER }));
    await assertFails(updateDoc(doc(as(OWNER), T('t_reported')), { reportedAt: 1 }));
  });

  test('owner can change the rooms and beds', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), T('t_open')), {
      places: [{ roomId: 'room101', beds: ['B'] }, { roomId: 'room102', beds: [] }],
      roomId: 'room101', area: null, updatedAt: Date.now(),
    }));
  });

  test('at most 6 assignees', async () => {
    await assertFails(updateDoc(doc(as(OWNER), T('t_reported')), { assignees: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }));
  });

  test('owner can dismiss a report', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), T('t_reported')), { status: 'dismissed', updatedAt: Date.now() }));
  });

  test('owner can restore an archived task (and it reappears for everyone)', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), T('t_dismissed')), { status: 'open', clearedBy: [], updatedAt: Date.now() }));
  });

  test('maintenance staff can restore an archived task too', async () => {
    await assertSucceeds(updateDoc(doc(as(MSTAFF), T('t_dismissed')), { status: 'open', clearedBy: [], updatedAt: Date.now() }));
  });

  test('the reporter cannot restore what a manager archived', async () => {
    await assertFails(updateDoc(doc(as(HK2), T('t_dismissed')), { status: 'reported', clearedBy: [], updatedAt: Date.now() }));
  });

  test('a housekeeper cannot edit their own report', async () => {
    await assertFails(updateDoc(doc(as(HK), T('t_reported')), { title: 'Edited', updatedAt: Date.now() }));
  });
});

/* ───────────────────────────── the worker ───────────────────────────── */

describe('maintenance worker on their task', () => {
  test('can start it', async () => {
    await assertSucceeds(updateDoc(doc(as(WORKER), T('t_open')), { status: 'in_progress', startedAt: Date.now(), updatedAt: Date.now() }));
  });

  test('can put it on hold with a reason', async () => {
    await assertSucceeds(updateDoc(doc(as(WORKER), T('t_open')), { status: 'on_hold', holdReason: 'Waiting for the part', updatedAt: Date.now() }));
  });

  test('can mark it fixed in their own name', async () => {
    await assertSucceeds(updateDoc(doc(as(WORKER), T('t_open')), { status: 'done', doneAt: Date.now(), doneBy: WORKER, updatedAt: Date.now() }));
  });

  test('cannot mark it fixed in someone else\'s name', async () => {
    await assertFails(updateDoc(doc(as(WORKER), T('t_open')), { status: 'done', doneAt: Date.now(), doneBy: OWNER, updatedAt: Date.now() }));
  });

  test('can reopen a fixed task', async () => {
    await assertSucceeds(updateDoc(doc(as(WORKER), T('t_done')), { status: 'in_progress', doneAt: null, doneBy: null, updatedAt: Date.now() }));
  });

  test('can tick a step', async () => {
    await assertSucceeds(updateDoc(doc(as(WORKER), T('t_open')), {
      checklist: [{ id: 'c1', text: 'Unscrew the grate', done: true }], updatedAt: Date.now(),
    }));
  });

  test('can add a progress photo (photo + photoCount in one batch)', async () => {
    const db = as(WORKER);
    const b = writeBatch(db);
    b.set(doc(db, `${T('t_open')}/photos/w1`), { data: 'abc', by: WORKER, at: Date.now(), kind: 'progress' });
    b.update(doc(db, T('t_open')), { photoCount: increment(1), updatedAt: Date.now() });
    await assertSucceeds(b.commit());
  });

  test('can comment', async () => {
    await assertSucceeds(setDoc(doc(as(WORKER), `${T('t_open')}/comments/c1`), { text: 'On my way', by: WORKER, at: Date.now() }));
  });

  test('cannot reassign, retitle or re-prioritise', async () => {
    await assertFails(updateDoc(doc(as(WORKER), T('t_open')), { assignees: [WORKER, HK] }));
    await assertFails(updateDoc(doc(as(WORKER), T('t_open')), { title: 'Something else' }));
    await assertFails(updateDoc(doc(as(WORKER), T('t_open')), { priority: 'low' }));
  });

  test('cannot change which rooms or beds the task is for', async () => {
    await assertFails(updateDoc(doc(as(WORKER), T('t_open')), { places: [{ roomId: 'room102', beds: [] }] }));
  });

  test('cannot touch a task that is not theirs', async () => {
    await assertFails(updateDoc(doc(as(WORKER), T('t_other')), { status: 'in_progress', updatedAt: Date.now() }));
  });

  test('cannot revive a dismissed task', async () => {
    await assertFails(updateDoc(doc(as(WORKER), T('t_dismissed')), { status: 'open', updatedAt: Date.now() }));
  });

  test('cannot delete a task', async () => {
    await assertFails(deleteDoc(doc(as(WORKER), T('t_open'))));
  });

  test('a housekeeper cannot comment on a task that is not theirs', async () => {
    await assertFails(setDoc(doc(as(HK), `${T('t_open')}/comments/c2`), { text: 'hi', by: HK, at: Date.now() }));
  });

  test('a comment over 1000 characters is refused', async () => {
    await assertFails(setDoc(doc(as(WORKER), `${T('t_open')}/comments/c3`), { text: 'x'.repeat(1001), by: WORKER, at: Date.now() }));
  });

  test('worker can post the "fixed" notification', async () => {
    await assertSucceeds(setDoc(doc(as(WORKER), `hostels/${PP}/notifications/maint_done__t_open__20261012`), {
      type: 'maint_done', message: 'marco fixed: Shower drain blocked (101)', roomId: 't_open',
      read: false, timestamp: new Date().toISOString(),
    }));
  });
});

/* ─────────────────────── remove from my list (clearedBy) ─────────────────────── */

describe('removing a finished task from your own list', () => {
  const clear = (uid) => updateDoc(doc(as(uid), T('t_done')), { clearedBy: arrayUnion(uid) });

  test('the worker can', async () => { await assertSucceeds(clear(WORKER)); });
  test('the housekeeper who reported it can', async () => { await assertSucceeds(clear(HK)); });
  test('the owner can', async () => { await assertSucceeds(clear(OWNER)); });

  test('section-only staff can (5e)', async () => { await assertSucceeds(clear(VIEWER)); });

  test('the owner can even after Pro+ lapsed (5e)', async () => {
    await setBilling(PP, { status: 'canceled', tier: 'proplus', currentPeriodEnd: Timestamp.fromMillis(Date.now() - 30 * DAY) });
    await assertSucceeds(clear(OWNER));
  });

  test('someone who cannot see the task cannot', async () => {
    await assertFails(clear(DESK));
    await assertFails(clear(HK2));
  });

  test('you can only add yourself', async () => {
    await assertFails(updateDoc(doc(as(WORKER), T('t_done')), { clearedBy: arrayUnion(HK) }));
  });

  test('an open task cannot be cleared', async () => {
    await assertFails(updateDoc(doc(as(WORKER), T('t_open')), { clearedBy: arrayUnion(WORKER) }));
  });

  test('clearing cannot smuggle in other changes', async () => {
    await assertFails(updateDoc(doc(as(HK), T('t_done')), { clearedBy: arrayUnion(HK), title: 'x' }));
  });
});

/* ───────────────────────────── deleting ───────────────────────────── */

describe('deleting', () => {
  test('a housekeeper can withdraw their report while it is still a report', async () => {
    await assertSucceeds(deleteDoc(doc(as(HK), T('t_reported'))));
  });

  test('…but not once it has been worked on', async () => {
    await assertFails(deleteDoc(doc(as(HK), T('t_done'))));
  });

  test('owner and maintenance staff can delete', async () => {
    await assertSucceeds(deleteDoc(doc(as(MSTAFF), T('t_other'))));
    await assertSucceeds(deleteDoc(doc(as(OWNER), T('t_open'))));
  });

  test('photos can be deleted before the task (deleteTask order)', async () => {
    await assertSucceeds(deleteDoc(doc(as(OWNER), `${T('t_open')}/photos/p1`)));
  });
});

/* ───────────── photo cleanup, 30 days after finishing (5g) ───────────── */

describe('photo cleanup', () => {
  test('maintenance staff can delete the photos of a finished task', async () => {
    await assertSucceeds(deleteDoc(doc(as(MSTAFF), `${T('t_done')}/photos/p1`)));
  });

  test('…and mark the task as cleaned up', async () => {
    await assertSucceeds(updateDoc(doc(as(MSTAFF), T('t_done')), { photoCount: 0, photosPurgedAt: Date.now() }));
  });

  test('the owner can too', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), T('t_done')), { photoCount: 0, photosPurgedAt: Date.now() }));
  });

  test('a worker cannot mark photos as cleaned up', async () => {
    await assertFails(updateDoc(doc(as(WORKER), T('t_done')), { photoCount: 0, photosPurgedAt: Date.now() }));
  });

  test('a housekeeper cannot delete photos they did not take', async () => {
    await assertFails(deleteDoc(doc(as(HK2), `${T('t_done')}/photos/p1`)));
  });

  test('photosPurgedAt must be a number', async () => {
    await assertFails(updateDoc(doc(as(OWNER), T('t_done')), { photosPurgedAt: 'yesterday' }));
  });

  test('archiving records when (dismissedAt)', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), T('t_open')), { status: 'dismissed', dismissedAt: Date.now(), updatedAt: Date.now() }));
  });

  test('dismissedAt must be a number', async () => {
    await assertFails(updateDoc(doc(as(OWNER), T('t_open')), { status: 'dismissed', dismissedAt: 'now', updatedAt: Date.now() }));
  });

  test('restoring clears dismissedAt', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), T('t_dismissed')), { status: 'open', clearedBy: [], dismissedAt: null, updatedAt: Date.now() }));
  });
});

/* ─────────────────────── teams (users/{uid}.team) ─────────────────────── */

describe('moving people between Housekeeping and Maintenance', () => {
  test('owner can move a housekeeper to maintenance', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), `users/${HK}`), { team: 'maintenance' }));
  });

  test('owner can move them back by setting housekeeping (TeamSwitch.js)', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), `users/${WORKER}`), { team: 'housekeeping' }));
  });

  test('owner can move them back by removing the field (setMemberTeam, 5d)', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), `users/${WORKER}`), { team: deleteField() }));
  });

  test('staff with manageTeam can switch teams', async () => {
    await assertSucceeds(updateDoc(doc(as(LEAD), `users/${HK}`), { team: 'maintenance' }));
  });

  test('staff without manageTeam cannot', async () => {
    await assertFails(updateDoc(doc(as(DESK), `users/${HK}`), { team: 'maintenance' }));
  });

  test('nobody can change their own team', async () => {
    await assertFails(updateDoc(doc(as(WORKER), `users/${WORKER}`), { team: 'housekeeping' }));
    await assertFails(updateDoc(doc(as(HK), `users/${HK}`), { team: 'maintenance' }));
  });

  test('only the two real teams are accepted', async () => {
    await assertFails(updateDoc(doc(as(OWNER), `users/${HK}`), { team: 'boss' }));
  });

  test('a team switch cannot carry other changes', async () => {
    await assertFails(updateDoc(doc(as(OWNER), `users/${HK}`), { team: 'maintenance', role: 'staff' }));
  });

  test('a staff account cannot be given a team', async () => {
    await assertFails(updateDoc(doc(as(OWNER), `users/${DESK}`), { team: 'maintenance' }));
  });

  test('owner can create a maintenance worker (registerCleaner)', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'users/new-worker'), {
      username: 'nico', role: 'cleaner', hostelCode: PP,
      email: 'cleaner_x1_mnt234@keepclean.app', team: 'maintenance',
    }));
  });

  test('…but not with a made-up team', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'users/new-worker2'), {
      username: 'nina', role: 'cleaner', hostelCode: PP,
      email: 'cleaner_x2_mnt234@keepclean.app', team: 'boss',
    }));
  });
});