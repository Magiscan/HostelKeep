// src/screens/manager/RolesScreen.web.js
//
// Transcribed from the prototype's `isSettings` branch: a 280px role list on
// the left, an editor on the right, capped at 1100px.
//
// ─────────────────────────────────────────────────────────────────────────────
// READ THIS BEFORE SHIPPING
//
// This screen EDITS a permission model. It does not ENFORCE one. Nothing here
// stops anyone doing anything — the sidebar still shows every section and every
// button still works, whoever is signed in. Enforcement needs three things this
// file deliberately does not do:
//
//   1. Persistence — roles live in Firestore at hostels/{code}/config/roles,
//      loaded through AppContext like rooms and floors are.
//   2. Client gating — Sidebar filters NAV_SECTIONS by the signed-in user's
//      role.sections; screens hide actions by role.perms.
//   3. Firestore rules — the only part that actually secures anything. Client
//      gating is a courtesy; a determined user can call the SDK directly.
//
// Until (3) exists, treat this as a way to organise intent, not a security
// boundary. Shipping it as-is would be worse than not having it, because the
// interface implies a guarantee the backend isn't making.
//
// The props below are shaped so that wiring (1) is a small change: pass `roles`
// and `onChange` from AppContext and delete the local-state fallback.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
} from 'react-native';
import Icon from '../../components/Icon';
import { ConfirmDialog, drawerStyles as d } from '../../components/Dashboard/Drawer.web';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';

const SUNKEN = '#F8FAFC';
const HAIRLINE = '#EEF2F7';
const DANGER = '#B91C1C';

/* Section keys match ManagerLayout's SECTIONS and Sidebar's nav keys — that's
   what lets Sidebar filter on role.sections later without a mapping table. */
const SECTION_LIST = [
  { key: 'dashboard',     label: 'Dashboard',      icon: 'dashboard' },
  { key: 'rooms',         label: 'Rooms',          icon: 'bed' },
  { key: 'assign',        label: 'Assign',         icon: 'swap_horiz' },
  { key: 'team',          label: 'Team',           icon: 'group' },
  { key: 'extraRequests', label: 'Extra requests', icon: 'flag' },
  { key: 'reports',       label: 'Live activities', icon: 'description' },
  { key: 'history',       label: 'History',        icon: 'calendar_month' },
  { key: 'roles',         label: 'Roles & access', icon: 'shield_person' },
];

const PERM_LIST = [
  { key: 'assign',     label: 'Assign rooms',           hint: 'Hand rooms to housekeepers and change bed states.' },
  { key: 'approve',    label: 'Approve extra requests', hint: 'Accept or reject extra rooms asked for during the shift.' },
  { key: 'editRooms',  label: 'Add and edit rooms',     hint: 'Change the property structure, floors and beds.' },
  { key: 'manageTeam', label: 'Manage the team',        hint: 'Invite, remove and set who is on shift.' },
  { key: 'export',     label: 'Export reports',         hint: 'Download the daily Excel and history logs.' },
  { key: 'roles',      label: 'Manage roles',           hint: 'Create roles and decide what each one can do.' },
];

/* The owner role is seeded with everything and can't be deleted or narrowed —
   locking yourself out of Roles & access would need a Firestore console trip to
   undo, which is not a mistake the interface should allow. */
const DEFAULT_ROLES = [
  {
    id: 'owner',
    name: 'Hostel manager',
    locked: true,
    sections: SECTION_LIST.map(s => s.key),
    perms: PERM_LIST.map(p => p.key),
  },
  {
    id: 'hk',
    name: 'Housekeeping manager',
    sections: ['dashboard', 'rooms', 'assign', 'team', 'extraRequests', 'history'],
    perms: ['assign', 'approve', 'export'],
  },
  {
    id: 'desk',
    name: 'Reception',
    sections: ['dashboard', 'rooms'],
    perms: [],
  },
];

const genId = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

function Toggle({ on }) {
  return (
    <View style={[styles.track, on && styles.trackOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

export default function RolesScreen({ roles: rolesProp, onChange, onReady }) {
  // Local fallback so the screen works before AppContext is wired. Once roles
  // come from Firestore, drop this and read rolesProp directly.
  const [localRoles, setLocalRoles] = useState(DEFAULT_ROLES);
  const roles = rolesProp || localRoles;
  const setRoles = onChange || setLocalRoles;

  const [selectedId, setSelectedId] = useState(roles[0]?.id);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const selected = useMemo(
    () => roles.find(r => r.id === selectedId) || roles[0],
    [roles, selectedId]
  );

  const patch = (changes) =>
    setRoles(roles.map(r => (r.id === selected.id ? { ...r, ...changes } : r)));

  const toggleSection = (key) => {
    if (selected.locked) return;
    const has = selected.sections.includes(key);
    patch({
      sections: has
        ? selected.sections.filter(s => s !== key)
        : [...selected.sections, key],
    });
  };

  const togglePerm = (key) => {
    if (selected.locked) return;
    const has = selected.perms.includes(key);
    patch({
      perms: has ? selected.perms.filter(p => p !== key) : [...selected.perms, key],
    });
  };

  const addRole = () => {
    const role = { id: genId(), name: 'New role', sections: ['dashboard'], perms: [] };
    setRoles([...roles, role]);
    setSelectedId(role.id);
  };

  const deleteRole = () => {
    const next = roles.filter(r => r.id !== selected.id);
    setRoles(next);
    setSelectedId(next[0]?.id);
    setConfirmDelete(null);
  };

  if (!selected) return null;

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>
        <View style={styles.notice}>
          <Icon name="info" size={19} color={NEUTRAL.text2} />
          <Text style={styles.noticeText}>
            Roles are recorded here but not yet enforced. Everyone still sees every
            section until access rules are switched on.
          </Text>
        </View>

        <View style={styles.split}>
          {/* ── Role list ── */}
          <View style={styles.listPanel}>
            <View style={styles.listHead}>
              <Text style={styles.panelTitle}>Roles</Text>
              <TouchableOpacity onPress={addRole} style={styles.addBtn} activeOpacity={0.7}>
                <Icon name="add" size={19} color={NEUTRAL.text2} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8 }}>
              {roles.map(role => {
                const on = role.id === selected.id;
                return (
                  <TouchableOpacity
                    key={role.id}
                    onPress={() => setSelectedId(role.id)}
                    style={[styles.roleRow, on && styles.roleRowOn]}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[styles.roleName, on && { color: '#FFFFFF' }]}
                        numberOfLines={1}
                      >
                        {role.name}
                      </Text>
                      <Text style={[styles.roleMeta, on && { color: '#FFFFFF', opacity: 0.7 }]}>
                        {role.sections.length} sections · {role.perms.length} actions
                      </Text>
                    </View>
                    <Icon
                      name="chevron_right"
                      size={19}
                      color={on ? '#FFFFFF' : NEUTRAL.text4}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Editor ── */}
          <View style={styles.editorPanel}>
            <View>
              <Text style={d.overline}>Role name</Text>
              <TextInput
                value={selected.name}
                onChangeText={v => patch({ name: v })}
                editable={!selected.locked}
                placeholderTextColor={NEUTRAL.text4}
                style={[styles.nameInput, selected.locked && styles.inputLocked]}
              />
              {selected.locked && (
                <Text style={styles.lockedHint}>
                  The owner role always keeps full access, so it can't be edited or removed.
                </Text>
              )}
            </View>

            <View>
              <Text style={[d.overline, { marginBottom: 4 }]}>Sections this role can see</Text>
              <Text style={styles.sectionHint}>Unchecked sections are hidden from the sidebar.</Text>
              <View style={styles.sectionGrid}>
                {SECTION_LIST.map(sec => {
                  const on = selected.sections.includes(sec.key);
                  return (
                    <TouchableOpacity
                      key={sec.key}
                      onPress={() => toggleSection(sec.key)}
                      disabled={selected.locked}
                      style={[
                        styles.sectionCard,
                        on && styles.sectionCardOn,
                        selected.locked && { opacity: 0.6 },
                      ]}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on && <Icon name="check" size={14} color="#FFFFFF" />}
                      </View>
                      <Icon
                        name={sec.icon}
                        size={18}
                        color={on ? BRAND.navy : NEUTRAL.text3}
                      />
                      <Text
                        style={[styles.sectionLabel, on && { color: BRAND.navy }]}
                        numberOfLines={1}
                      >
                        {sec.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={[d.overline, { marginBottom: 4 }]}>Actions this role can perform</Text>
              <Text style={styles.sectionHint}>Everything else stays read-only.</Text>
              <View style={styles.permTable}>
                {PERM_LIST.map((perm, i) => {
                  const on = selected.perms.includes(perm.key);
                  const last = i === PERM_LIST.length - 1;
                  return (
                    <TouchableOpacity
                      key={perm.key}
                      onPress={() => togglePerm(perm.key)}
                      disabled={selected.locked}
                      style={[
                        styles.permRow,
                        last && { borderBottomWidth: 0 },
                        selected.locked && { opacity: 0.6 },
                      ]}
                      activeOpacity={0.7}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: on }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.permLabel}>{perm.label}</Text>
                        <Text style={styles.permHint}>{perm.hint}</Text>
                      </View>
                      <Toggle on={on} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {!selected.locked && (
              <View style={styles.editorActions}>
                <TouchableOpacity
                  onPress={() => setConfirmDelete(selected)}
                  style={styles.deleteBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteText}>Delete role</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={!!confirmDelete}
        title="Delete this role?"
        message={`"${confirmDelete?.name}" will be removed. Anyone currently on it falls back to no access until you give them another role.`}
        confirmLabel="Delete"
        onConfirm={deleteRole}
        onCancel={() => setConfirmDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NEUTRAL.appBg },
  page: {
    paddingTop: 24, paddingHorizontal: 28, paddingBottom: 40,
    maxWidth: 1156, gap: 20,
  },

  /* The prototype has no banner — it's added here because the screen would
     otherwise imply an enforcement that doesn't exist yet. Delete it the day
     Firestore rules land. */
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: SUNKEN,
  },
  noticeText: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.regular, fontSize: 13.5, lineHeight: 19, color: NEUTRAL.text2,
  },

  split: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' },

  listPanel: {
    flexGrow: 0, flexShrink: 1, flexBasis: 280, minWidth: 240,
    padding: 18, borderRadius: 22,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  listHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, marginBottom: 14,
  },
  panelTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 17, color: NEUTRAL.text,
  },
  addBtn: {
    width: 34, height: 34, borderRadius: 11,
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  roleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 15,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  roleRowOn: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  roleName: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 15, color: NEUTRAL.text,
  },
  roleMeta: {
    marginTop: 2, fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text3,
  },

  editorPanel: {
    flexGrow: 1, flexShrink: 1, flexBasis: 480, minWidth: 320,
    padding: 22, borderRadius: 22, gap: 24,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  nameInput: {
    width: '100%', maxWidth: 420, height: 48,
    paddingHorizontal: 16, borderRadius: 15,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
    fontFamily: FONTS.regular, fontSize: 15, color: NEUTRAL.text,
    outlineStyle: 'none',
  },
  inputLocked: { backgroundColor: NEUTRAL.slateChip, color: NEUTRAL.text3 },
  lockedHint: {
    marginTop: 8, fontFamily: FONTS.regular, fontSize: 13, color: NEUTRAL.text4,
  },
  sectionHint: {
    marginBottom: 12, fontFamily: FONTS.regular, fontSize: 13, color: NEUTRAL.text3,
  },

  sectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionCard: {
    flexGrow: 1, flexBasis: 200, minWidth: 180,
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 15,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  sectionCardOn: { backgroundColor: NEUTRAL.slateChip, borderColor: BRAND.navy },
  sectionLabel: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14, color: NEUTRAL.text2,
  },
  checkbox: {
    width: 20, height: 20, flexShrink: 0, borderRadius: 6,
    borderWidth: 1.5, borderColor: NEUTRAL.border, backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },

  permTable: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: NEUTRAL.border,
  },
  permRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: HAIRLINE,
    backgroundColor: NEUTRAL.surface,
  },
  permLabel: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14.5, color: NEUTRAL.text,
  },
  permHint: {
    marginTop: 2, fontFamily: FONTS.regular, fontSize: 13,
    lineHeight: 18, color: NEUTRAL.text3,
  },

  track: {
    width: 46, height: 26, borderRadius: 999, flexShrink: 0,
    backgroundColor: '#CBD5E1', justifyContent: 'center',
  },
  trackOn: { backgroundColor: BRAND.navy },
  knob: {
    position: 'absolute', top: 3, left: 3,
    width: 20, height: 20, borderRadius: 999, backgroundColor: '#FFFFFF',
    shadowColor: BRAND.navy, shadowOpacity: 0.3,
    shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  knobOn: { left: 23 },

  editorActions: { flexDirection: 'row', gap: 10 },
  deleteBtn: {
    height: 50, paddingHorizontal: 22, borderRadius: 16,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 15, color: DANGER,
  },
});