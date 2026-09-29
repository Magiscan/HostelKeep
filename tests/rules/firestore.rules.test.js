/**
 * Firestore security rules tests. They run against the LOCAL emulator, so they
 * cost nothing, touch no real data and work on the Spark plan.
 *
 *   npm run test:rules
 *
 * They load ./firestore.rules from the repo root, i.e. exactly what
 * `firebase deploy --only firestore:rules` would upload.
 *
 * Seed data mirrors what the app writes. If a "can …" test fails, compare the
 * seed with what the app really writes; if they match, the same action is
 * being denied in production. If a "cannot …" test fails, the rules allow
 * something they must not.
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
  collection, Timestamp,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-hostelkeep';   // "demo-" = emulator only, no real project
const DAY = 24 * 60 * 60 * 1000;

const PAID = 'ABC234';      // hostel with an active subscription
const UNPAID = 'XYZ789';    // hostel with no billing document
const SPARE = 'NEW567';     // code reserved by OWNER, no hostel yet (addHostel mid-flight)

const OWNER = 'owner-uid';          // owner of PAID
const CLEANER = 'cleaner-uid';      // housekeeper in PAID, room101 assigned
const CLEANER2 = 'cleaner2-uid';    // housekeeper in PAID
const FRONTDESK = 'frontdesk-uid';  // staff in PAID: assign only
const SUPERVISOR = 'super-uid';     // staff in PAID: assign, approve, editRooms, manageTeam, export
const OUTSIDER = 'outsider-uid';    // owner of UNPAID, stranger to PAID

const CLEANER_EMAIL = 'cleaner_luca_abc234@keepclean.app';

const ROLES = {
  frontdesk: {
    name: 'Front desk',
    perms: ['assign'],
    sections: ['dashboard', 'assign'],
  },
  supervisor: {
    name: 'Supervisor',
    perms: ['assign', 'approve', 'editRooms', 'manageTeam', 'export'],
    sections: ['dashboard', 'assign', 'rooms', 'team', 'extraRequests', 'history'],
  },
};

let testEnv;

const as = (uid, email) => testEnv.authenticatedContext(uid, email ? { email } : {}).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

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
    await put(`users/${OWNER}`, {
      username: 'Maria', role: 'manager', hostelCode: PAID, hostelCodes: [PAID],
      email: 'maria@example.com', recoveryEmail: 'maria@example.com',
      pushToken: 'ExponentPushToken[owner]',
    });
    await put(`users/${CLEANER}`, {
      username: 'luca', role: 'cleaner', hostelCode: PAID, email: CLEANER_EMAIL,
      pushToken: 'ExponentPushToken[luca]',
    });
    await put(`users/${CLEANER2}`, {
      username: 'sara', role: 'cleaner', hostelCode: PAID,
      email: 'cleaner_sara_abc234@keepclean.app',
    });
    await put(`users/${FRONTDESK}`, {
      username: 'Gio', role: 'staff', roleId: 'frontdesk', hostelCode: PAID, email: 'gio@example.com',
    });
    await put(`users/${SUPERVISOR}`, {
      username: 'Ana', role: 'staff', roleId: 'supervisor', hostelCode: PAID, email: 'ana@example.com',
    });
    await put(`users/${OUTSIDER}`, {
      username: 'Otto', role: 'manager', hostelCode: UNPAID, hostelCodes: [UNPAID],
      email: 'otto@example.com',
    });

    // ── hostels ──
    for (const [code, uid, name] of [[PAID, OWNER, 'Paid Hostel'], [UNPAID, OUTSIDER, 'Free Hostel']]) {
      await put(`hostelCodes/${code}`, { uid, createdAt: now });
      await put(`hostels/${code}`, { name, code, roomAttributes: [], createdAt: now });
      await put(`hostels/${code}/config/roles`, { roles: ROLES, updatedAt: now });
    }
    await put(`hostelCodes/${SPARE}`, { uid: OWNER, createdAt: now });

    await put(`hostels/${PAID}/rooms/room101`, { name: '101', floorId: 'f1', assignedTo: CLEANER });
    await put(`hostels/${PAID}/rooms/room102`, { name: '102', floorId: 'f1', assignedTo: null });
    await put(`hostels/${PAID}/roomStatus/room101`, {
      cleaned: false,
      managerNotes: 'Check the window latch',
      assignmentBedStatus: { A: 'clean', B: 'stayover' },
      updatedAt: Date.now(),
    });

    await put(`hostels/${PAID}/extraRequests/room102`, {
      cleanerId: CLEANER, roomId: 'room102', status: 'pending', imageBase64: null, timestamp: now,
    });

    // ── billing ──
    await put(`billing/${PAID}`, {
      status: 'active',
      currentPeriodEnd: Timestamp.fromMillis(Date.now() + 20 * DAY),
    });

    // ── login lookup ──
    await put(`loginLookup/${PAID}_luca`, { email: CLEANER_EMAIL, hostelCode: PAID });
  });
});

/* ─────────────────── hostel takeover (round 4 fix) ─────────────────── */

describe('nobody can join or take over a hostel by knowing its code', () => {
  test('an owner cannot add someone else\'s hostel code to their account', async () => {
    await assertFails(updateDoc(doc(as(OUTSIDER), `users/${OUTSIDER}`), {
      hostelCodes: [UNPAID, PAID],
    }));
  });

  test('…not even by hiding it in the middle of the list', async () => {
    await assertFails(updateDoc(doc(as(OWNER), `users/${OWNER}`), {
      hostelCodes: [UNPAID, PAID],   // UNPAID is not OWNER's; PAID is theirs
    }));
  });

  test('a housekeeper cannot give themselves a hostelCodes list', async () => {
    await assertFails(updateDoc(doc(as(CLEANER), `users/${CLEANER}`), {
      hostelCodes: [PAID],
    }));
  });

  test('a housekeeper cannot switch hostel', async () => {
    await assertFails(updateDoc(doc(as(CLEANER), `users/${CLEANER}`), { hostelCode: UNPAID }));
  });

  test('a staff member cannot switch hostel', async () => {
    await assertFails(updateDoc(doc(as(FRONTDESK), `users/${FRONTDESK}`), { hostelCode: UNPAID }));
  });

  test('a new sign-up cannot claim a code someone else reserved', async () => {
    await assertFails(setDoc(doc(as('newcomer-uid'), 'users/newcomer-uid'), {
      username: 'Eve', role: 'manager', hostelCode: SPARE, hostelCodes: [SPARE], email: 'eve@example.com',
    }));
  });
});

describe('the legitimate paths still work', () => {
  test('addHostel: owner appends a code they reserved', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), `users/${OWNER}`), {
      hostelCodes: [PAID, SPARE],
    }));
  });

  test('addHostel: owner creates the hostel for a code they reserved', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), `users/${OWNER}`), { hostelCodes: [PAID, SPARE] });
    });
    await assertSucceeds(setDoc(doc(as(OWNER), `hostels/${SPARE}`), {
      name: 'Second Hostel', code: SPARE, roomAttributes: [], createdAt: new Date().toISOString(),
    }));
  });

  test('owner switches between their own hostels', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), `users/${OWNER}`), { hostelCodes: [PAID, SPARE] });
    });
    await assertSucceeds(updateDoc(doc(as(OWNER), `users/${OWNER}`), { hostelCode: SPARE }));
  });

  test('createHostel: a new sign-up reserves a code, then claims it', async () => {
    const uid = 'newowner-uid';
    const db = as(uid, 'new@example.com');
    await assertSucceeds(setDoc(doc(db, 'hostelCodes/FRESH9'), {
      uid, createdAt: new Date().toISOString(),
    }));
    await assertSucceeds(setDoc(doc(db, `users/${uid}`), {
      username: 'Nina', role: 'manager', hostelCode: 'FRESH9', hostelCodes: ['FRESH9'],
      email: 'new@example.com', recoveryEmail: 'new@example.com',
    }));
    await assertSucceeds(setDoc(doc(db, 'hostels/FRESH9'), {
      name: 'Fresh Hostel', code: 'FRESH9', roomAttributes: [], createdAt: new Date().toISOString(),
    }));
  });
});

/* ───────────────────────────── users ───────────────────────────── */

describe('users', () => {
  test('owner can mark the welcome sheet as seen (audit 4.1)', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), `users/${OWNER}`), {
      tutorialSeenAt: new Date().toISOString(),
    }));
  });

  test('user can delete their own pushToken on sign-out', async () => {
    await assertSucceeds(updateDoc(doc(as(CLEANER), `users/${CLEANER}`), {
      pushToken: deleteField(),
    }));
  });

  test('user can store a new pushToken', async () => {
    await assertSucceeds(setDoc(doc(as(CLEANER2), `users/${CLEANER2}`), {
      pushToken: 'ExponentPushToken[sara]',
    }, { merge: true }));
  });

  test('housekeeper cannot promote themselves', async () => {
    await assertFails(updateDoc(doc(as(CLEANER), `users/${CLEANER}`), { role: 'manager' }));
  });

  test('staff cannot change their own role', async () => {
    await assertFails(updateDoc(doc(as(FRONTDESK), `users/${FRONTDESK}`), { roleId: 'supervisor' }));
  });

  test('owner can move staff to another role', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), `users/${FRONTDESK}`), { roleId: 'supervisor' }));
  });

  test('owner of a paid hostel can create a staff account', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'users/newstaff-uid'), {
      username: 'Leo', role: 'staff', roleId: 'frontdesk', hostelCode: PAID, email: 'leo@example.com',
    }));
  });

  test('owner of an unpaid hostel cannot create staff', async () => {
    await assertFails(setDoc(doc(as(OUTSIDER), 'users/newstaff2-uid'), {
      username: 'Kim', role: 'staff', roleId: 'frontdesk', hostelCode: UNPAID, email: 'kim@example.com',
    }));
  });

  test('nobody can read a user in another hostel', async () => {
    await assertFails(getDoc(doc(as(OUTSIDER), `users/${CLEANER}`)));
  });
});

/* ───────────────────────── login lookup ───────────────────────── */

describe('loginLookup', () => {
  test('sign-in lookup works by exact ID before sign-in', async () => {
    await assertSucceeds(getDoc(doc(anon(), `loginLookup/${PAID}_luca`)));
  });

  test('the collection cannot be listed', async () => {
    await assertFails(getDocs(collection(anon(), 'loginLookup')));
  });

  test('a housekeeper can delete their own row (account deletion)', async () => {
    await assertSucceeds(deleteDoc(doc(as(CLEANER, CLEANER_EMAIL), `loginLookup/${PAID}_luca`)));
  });

  test('a housekeeper cannot rewrite their own row (round 4)', async () => {
    await assertFails(updateDoc(doc(as(CLEANER, CLEANER_EMAIL), `loginLookup/${PAID}_luca`), {
      hostelCode: UNPAID,
    }));
  });
});

/* ───────────────────────────── rooms ───────────────────────────── */

describe('rooms', () => {
  test('front desk (assign) can hand a room to a housekeeper', async () => {
    await assertSucceeds(updateDoc(doc(as(FRONTDESK), `hostels/${PAID}/rooms/room102`), {
      assignedTo: CLEANER2,
    }));
  });

  test('front desk (no editRooms) cannot rename a room', async () => {
    await assertFails(updateDoc(doc(as(FRONTDESK), `hostels/${PAID}/rooms/room102`), { name: 'Attic' }));
  });

  test('a housekeeper cannot self-assign an unassigned room (round 4)', async () => {
    await assertFails(updateDoc(doc(as(CLEANER2), `hostels/${PAID}/rooms/room102`), {
      assignedTo: CLEANER2,
    }));
  });

  test('a housekeeper can hand back their own room (account deletion)', async () => {
    await assertSucceeds(updateDoc(doc(as(CLEANER), `hostels/${PAID}/rooms/room101`), {
      assignedTo: null,
    }));
  });

  test('another hostel\'s owner cannot read or assign your rooms', async () => {
    await assertFails(getDocs(collection(as(OUTSIDER), `hostels/${PAID}/rooms`)));
    await assertFails(updateDoc(doc(as(OUTSIDER), `hostels/${PAID}/rooms/room102`), {
      assignedTo: OUTSIDER,
    }));
  });
});

/* ─────────────────────────── roomStatus ─────────────────────────── */

describe('roomStatus', () => {
  test('housekeeper updates their room without sending manager fields (audit 4.2 fix)', async () => {
    await assertSucceeds(updateDoc(doc(as(CLEANER), `hostels/${PAID}/roomStatus/room101`), {
      cleaned: true,
      updatedAt: Date.now(),
    }));
  });

  test('housekeeper cannot overwrite the manager note', async () => {
    await assertFails(updateDoc(doc(as(CLEANER), `hostels/${PAID}/roomStatus/room101`), {
      managerNotes: 'changed by housekeeper',
    }));
  });

  test('a full overwrite that drops manager fields is denied (why the 4.2 fix matters)', async () => {
    await assertFails(setDoc(doc(as(CLEANER), `hostels/${PAID}/roomStatus/room101`), {
      cleaned: true,
      updatedAt: Date.now(),
    }));
  });

  test('housekeeper cannot write a room that is not theirs', async () => {
    await assertFails(setDoc(doc(as(CLEANER2), `hostels/${PAID}/roomStatus/room101`), {
      cleaned: true,
    }, { merge: true }));
  });
});

/* ───────────────────────── extraRequests ───────────────────────── */

describe('extraRequests', () => {
  const existing = `hostels/${PAID}/extraRequests/room102`;
  const fresh = `hostels/${PAID}/extraRequests/room999`;
  const request = (overrides = {}) => ({
    cleanerId: CLEANER2,
    roomId: 'room999',
    status: 'pending',
    imageBase64: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  test('housekeeper can request an extra room', async () => {
    await assertSucceeds(setDoc(doc(as(CLEANER2), fresh), request()));
  });

  test('a resized photo (~300 KB of base64) is accepted', async () => {
    await assertSucceeds(setDoc(doc(as(CLEANER2), fresh), request({ imageBase64: 'a'.repeat(300000) })));
  });

  test('an unresized photo is rejected (FIXES.md §4)', async () => {
    await assertFails(setDoc(doc(as(CLEANER2), fresh), request({ imageBase64: 'a'.repeat(700001) })));
  });

  test('housekeeper cannot file a request in someone else\'s name', async () => {
    await assertFails(setDoc(doc(as(CLEANER2), fresh), request({ cleanerId: CLEANER })));
  });

  test('housekeeper cannot approve their own request', async () => {
    await assertFails(updateDoc(doc(as(CLEANER), existing), { status: 'approved' }));
  });

  test('owner can reject it', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), existing), { status: 'rejected' }));
  });

  test('supervisor (approve) can approve it', async () => {
    await assertSucceeds(updateDoc(doc(as(SUPERVISOR), existing), { status: 'approved' }));
  });

  test('front desk (no approve) cannot approve it', async () => {
    await assertFails(updateDoc(doc(as(FRONTDESK), existing), { status: 'approved' }));
  });

  test('front desk (no extraRequests section) cannot see the photos', async () => {
    await assertFails(getDoc(doc(as(FRONTDESK), existing)));
  });

  test('housekeeper can dismiss (delete) their own request', async () => {
    await assertSucceeds(deleteDoc(doc(as(CLEANER), existing)));
  });

  test('another housekeeper cannot delete it', async () => {
    await assertFails(deleteDoc(doc(as(CLEANER2), existing)));
  });

  test('someone from another hostel cannot read it', async () => {
    await assertFails(getDoc(doc(as(OUTSIDER), existing)));
  });
});

/* ────────────────────────── notifications ────────────────────────── */

describe('notifications', () => {
  const nPath = `hostels/${PAID}/notifications/extra_request__102__2026-09-28__b1`;
  const notification = {
    type: 'extra_request',
    message: 'luca requested extra room 102',
    roomId: 'room102',
    read: false,
    timestamp: new Date().toISOString(),
  };

  test('housekeeper can create one with exactly the app\'s fields', async () => {
    await assertSucceeds(setDoc(doc(as(CLEANER), nPath), notification));
  });

  test('an extra field is refused', async () => {
    await assertFails(setDoc(doc(as(CLEANER), nPath), { ...notification, timestampMs: Date.now() }));
  });

  describe('once it exists', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), nPath), notification);
      });
    });

    test('a duplicate from a second device is refused (dedupe)', async () => {
      await assertFails(setDoc(doc(as(CLEANER2), nPath), notification));
    });

    test('owner can mark it read', async () => {
      await assertSucceeds(updateDoc(doc(as(OWNER), nPath), { read: true }));
    });

    test('nobody can rewrite its message', async () => {
      await assertFails(updateDoc(doc(as(OWNER), nPath), { message: 'edited' }));
    });

    test('housekeeper cannot delete it', async () => {
      await assertFails(deleteDoc(doc(as(CLEANER), nPath)));
    });
  });
});

/* ───────────────────────── billing and Pro ───────────────────────── */

describe('billing and the paid gate', () => {
  test('members can read their own hostel\'s subscription', async () => {
    await assertSucceeds(getDoc(doc(as(CLEANER), `billing/${PAID}`)));
  });

  test('outsiders cannot read it', async () => {
    await assertFails(getDoc(doc(as(OUTSIDER), `billing/${PAID}`)));
  });

  test('an owner cannot grant themselves Pro', async () => {
    await assertFails(setDoc(doc(as(OUTSIDER), `billing/${UNPAID}`), {
      status: 'active',
      currentPeriodEnd: Timestamp.fromMillis(Date.now() + 365 * DAY),
    }));
  });

  test('an owner cannot extend an existing subscription', async () => {
    await assertFails(updateDoc(doc(as(OWNER), `billing/${PAID}`), {
      currentPeriodEnd: Timestamp.fromMillis(Date.now() + 365 * DAY),
    }));
  });

  test('a paid hostel can save its daily history', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), `hostels/${PAID}/dailyLogs/2026-09-28`), {
      date: '2026-09-28', rooms: [],
    }));
  });

  test('an unpaid hostel cannot', async () => {
    await assertFails(setDoc(doc(as(OUTSIDER), `hostels/${UNPAID}/dailyLogs/2026-09-28`), {
      date: '2026-09-28', rooms: [],
    }));
  });

  test('supervisor (history section) can read history on a paid hostel', async () => {
    await assertSucceeds(getDocs(collection(as(SUPERVISOR), `hostels/${PAID}/dailyLogs`)));
  });

  test('front desk (no history section) cannot', async () => {
    await assertFails(getDocs(collection(as(FRONTDESK), `hostels/${PAID}/dailyLogs`)));
  });

  test('staff cannot edit roles', async () => {
    await assertFails(setDoc(doc(as(SUPERVISOR), `hostels/${PAID}/config/roles`), {
      roles: { ...ROLES, frontdesk: { ...ROLES.frontdesk, perms: ['assign', 'approve'] } },
    }));
  });

  test('signed-out visitors cannot read a hostel', async () => {
    await assertFails(getDoc(doc(anon(), `hostels/${PAID}`)));
  });
});