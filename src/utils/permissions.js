// src/utils/permissions.js
//
// The permission vocabulary, in one place. RolesScreen renders from it,
// Sidebar filters on it, AppContext evaluates it, and firestore.rules enforces
// it. If you add a key here you must also add it to firestore.rules — this
// file alone secures nothing.
//
// SHAPE ON DISK — hostels/{code}/config/roles:
//
//   {
//     roles: {
//       owner: { name: 'Hostel manager', sections: [...], perms: [...] },
//       hk:    { name: 'Housekeeping manager', sections: [...], perms: [...] },
//     }
//   }
//
// A MAP keyed by role id, not an array. Firestore rules can index a map by a
// variable (`roles[me().roleId]`) but cannot search an array, so an array here
// would make server-side enforcement impossible.

export const OWNER_ROLE_ID = 'owner';

/* Section keys match ManagerLayout's SECTIONS and Sidebar's nav keys — that's
   what lets Sidebar filter on role.sections without a mapping table.

   'roles' and 'account' are deliberately absent: Roles & access is owner-only
   and never togglable, and Account must stay reachable by everyone because the
   stores require in-app account deletion. */
export const SECTION_LIST = [
  { key: 'dashboard',     label: 'Dashboard',       icon: 'dashboard' },
  { key: 'rooms',         label: 'Rooms',           icon: 'bed' },
  { key: 'assign',        label: 'Assign',          icon: 'swap_horiz' },
  { key: 'team',          label: 'Team',            icon: 'group' },
  { key: 'extraRequests', label: 'Extra requests',  icon: 'flag' },
  { key: 'maintenance',   label: 'Maintenance',     icon: 'build' },
  { key: 'reports',       label: 'Live activities', icon: 'description' },
  { key: 'history',       label: 'History',         icon: 'calendar_month' },
];

/* Every key here is checked in firestore.rules. The `enforced` note is what
   the rules actually do with it — worth keeping accurate, because the screen
   shows it to the person handing out access. */
export const PERM_LIST = [
  {
    key: 'assign',
    label: 'Assign rooms',
    hint: 'Hand rooms to housekeepers and change bed states.',
    enforced: 'Writes to room assignment and cleaning status.',
  },
  {
    key: 'approve',
    label: 'Approve extra requests',
    hint: 'Accept or reject extra rooms asked for during the shift.',
    enforced: 'Writes to extra requests.',
  },
  {
    key: 'editRooms',
    label: 'Add and edit rooms',
    hint: 'Change the property structure, floors and beds. Also allows renaming the property.',
    enforced: 'Writes to rooms, floors and the hostel document.',
  },
  {
    key: 'manageTeam',
    label: 'Manage housekeepers',
    hint: 'Add and remove housekeeper accounts.',
    enforced: 'Creating and deleting cleaner accounts.',
  },
  {
    key: 'export',
    label: 'Save and export reports',
    hint: 'Save the day and download history logs.',
    enforced: 'Writes to daily logs.',
  },
  {
    key: 'maintenance',
    label: 'Manage maintenance',
    hint: 'Review reports, create and assign repair tasks.',
    enforced: 'Writes to maintenance tasks.',
  },
];

export const SECTION_KEYS = SECTION_LIST.map(s => s.key);
export const PERM_KEYS = PERM_LIST.map(p => p.key);

/* The owner role is seeded with everything and can't be deleted or narrowed.
   It is also never assignable to a staff member — the rules reject
   roleId == 'owner' on create and update, so nothing here can hand it out. */
export const DEFAULT_ROLES = {
  [OWNER_ROLE_ID]: {
    name: 'Hostel manager',
    sections: [...SECTION_KEYS],
    perms: [...PERM_KEYS],
  },
  hk: {
    name: 'Housekeeping manager',
    sections: ['dashboard', 'rooms', 'assign', 'team', 'extraRequests', 'history'],
    perms: ['assign', 'approve', 'export'],
  },
  desk: {
    name: 'Reception',
    sections: ['dashboard', 'rooms'],
    perms: [],
  },
  maint: {
    name: 'Maintenance manager',
    sections: ['dashboard', 'rooms', 'maintenance'],
    perms: ['maintenance'],
  },
};

export const genRoleId = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

/**
 * Coerce whatever is on disk into a well-formed map, dropping unknown keys.
 * An older document, a hand-edit in the Firestore console, or a half-written
 * role should degrade to "less access", never to "more".
 */
export function normaliseRoles(raw) {
  const source = (raw && typeof raw === 'object' && raw.roles) || {};
  const out = {};

  Object.keys(source).forEach((id) => {
    const r = source[id] || {};
    out[id] = {
      name: typeof r.name === 'string' && r.name.trim() ? r.name : 'Untitled role',
      sections: Array.isArray(r.sections)
        ? r.sections.filter(k => SECTION_KEYS.includes(k))
        : [],
      perms: Array.isArray(r.perms)
        ? r.perms.filter(k => PERM_KEYS.includes(k))
        : [],
    };
  });

  // The owner role is not optional and is not editable. Re-seed it on every
  // read so a bad write can never lock the owner out of their own hostel.
  out[OWNER_ROLE_ID] = { ...DEFAULT_ROLES[OWNER_ROLE_ID] };

  return out;
}

/** Ordered list for rendering — owner first, then alphabetical. */
export function rolesToList(roles) {
  const ids = Object.keys(roles || {}).filter(id => id !== OWNER_ROLE_ID);
  ids.sort((a, b) => (roles[a].name || '').localeCompare(roles[b].name || ''));
  return [OWNER_ROLE_ID, ...ids]
    .filter(id => roles?.[id])
    .map(id => ({ id, locked: id === OWNER_ROLE_ID, ...roles[id] }));
}

/**
 * What this user may DO. Mirrors `can()` in firestore.rules.
 *
 * This is a courtesy layer: it decides what to render, not what is allowed.
 * The rules are the boundary. If these two ever disagree, the rules win and
 * the user sees a permission-denied error — which is the correct failure.
 */
export function canDo(user, roles, perm) {
  if (!user) return false;
  if (user.role === 'manager') return true;
  if (user.role !== 'staff') return false;
  const role = roles?.[user.roleId];
  return !!role && role.perms.includes(perm);
}

/** Which sidebar sections this user may see. Mirrors `canSee()` in the rules. */
export function visibleSections(user, roles) {
  if (!user) return [];
  if (user.role === 'manager') return [...SECTION_KEYS];
  if (user.role !== 'staff') return [];
  const role = roles?.[user.roleId];
  return role ? role.sections.filter(k => SECTION_KEYS.includes(k)) : [];
}

/** True for the one account that can edit roles and create staff. */
export const isOwner = (user) => user?.role === 'manager';

/** True for any manager-side account — owner or staff. */
export const isManagerSide = (user) =>
  user?.role === 'manager' || user?.role === 'staff';