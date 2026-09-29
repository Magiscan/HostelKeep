// src/screens/manager/RolesScreen.web.js
//
// Transcribed from the prototype's `isSettings` branch: a 280px role list on
// the left, an editor on the right, capped at 1100px. A People panel was added
// underneath, because a permission model with nobody on it does nothing.
//
// This screen now EDITS and ENFORCES. Roles persist to
// hostels/{code}/config/roles, Sidebar filters on role.sections, and
// firestore.rules checks role.perms on every manager-side write. The notice
// banner that used to sit at the top has been removed along with the caveat it
// carried.
//
// OWNER ONLY, deliberately. Anyone who can edit roles can grant themselves
// every other permission, so there is no 'manage roles' permission to hand
// out — delegating it would make the rules decorative. ManagerLayout keeps the
// section out of the sidebar for staff; the guard below is the second line,
// and firestore.rules is the third.
//
// Edits are held locally until Save. Auto-saving a permission model means a
// half-built role is briefly live, and "briefly live" is how someone ends up
// with access they were never meant to keep.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from '../../components/Icon';
import {
  Drawer, FieldLabel, ConfirmDialog, drawerStyles as d,
} from '../../components/Dashboard/Drawer.web';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  SECTION_LIST, PERM_LIST, OWNER_ROLE_ID, genRoleId, rolesToList, isOwner,
} from '../../utils/permissions';
import { useTranslation } from 'react-i18next';

const SUNKEN = '#F8FAFC';
const HAIRLINE = '#EEF2F7';
const DANGER = '#B91C1C';

function Toggle({ on }) {
  return (
    <View style={[styles.track, on && styles.trackOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

export default function RolesScreen({ onReady }) {
  const { t } = useTranslation();
  const { roles: savedRoles, saveRoles, staff, rolesLoaded } = useApp();
  const { user, registerStaff, setStaffRole, deleteStaffAccount } = useAuth();

  const owner = isOwner(user);

  const [draft, setDraft] = useState(savedRoles);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [selectedId, setSelectedId] = useState(OWNER_ROLE_ID);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRoleId, setStaffRoleId] = useState('');
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [confirmRemoveStaff, setConfirmRemoveStaff] = useState(null);

  // Adopt the saved roles whenever they change on the server — unless there
  // are unsaved edits on screen, which must never be silently overwritten.
  useEffect(() => {
    if (!dirty) setDraft(savedRoles);
  }, [savedRoles, dirty]);

  const list = useMemo(() => rolesToList(draft), [draft]);
  const selected = useMemo(
    () => list.find(r => r.id === selectedId) || list[0],
    [list, selectedId],
  );

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await saveRoles(draft);
      setDirty(false);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!onReady) return;
    onReady({ save: handleSave, dirty, saving });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady, dirty, saving, draft]);

  const patch = (changes) => {
    if (!selected || selected.locked) return;
    setDraft(prev => ({
      ...prev,
      [selected.id]: { ...prev[selected.id], ...changes },
    }));
    setDirty(true);
  };

  const toggleSection = (key) => {
    if (!selected || selected.locked) return;
    const has = selected.sections.includes(key);
    patch({
      sections: has
        ? selected.sections.filter(s => s !== key)
        : [...selected.sections, key],
    });
  };

  const togglePerm = (key) => {
    if (!selected || selected.locked) return;
    const has = selected.perms.includes(key);
    patch({
      perms: has ? selected.perms.filter(p => p !== key) : [...selected.perms, key],
    });
  };

  const addRole = () => {
    const id = genRoleId();
    setDraft(prev => ({
      ...prev,
      [id]: { name: 'New role', sections: ['dashboard'], perms: [] },
    }));
    setSelectedId(id);
    setDirty(true);
  };

  const deleteRole = () => {
    const id = confirmDelete.id;
    setDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelectedId(OWNER_ROLE_ID);
    setDirty(true);
    setConfirmDelete(null);
  };

  /* ── Staff ─────────────────────────────────────────────────────────────── */

  const assignableRoles = list.filter(r => r.id !== OWNER_ROLE_ID);

  const openAddStaff = () => {
    setStaffName('');
    setStaffEmail('');
    setStaffPassword('');
    setStaffRoleId(assignableRoles[0]?.id || '');
    setStaffError('');
    setShowAddStaff(true);
  };

  const handleAddStaff = async () => {
    setStaffSaving(true);
    setStaffError('');
    try {
      await registerStaff({
        username: staffName,
        email: staffEmail,
        password: staffPassword,
        roleId: staffRoleId,
        hostelCode: user.hostelCode,
      });
      setShowAddStaff(false);
    } catch (e) {
      setStaffError(e.message);
    } finally {
      setStaffSaving(false);
    }
  };

  const handleChangeStaffRole = async (uid, roleId) => {
    try {
      await setStaffRole(uid, roleId);
    } catch (e) {
      setSaveError(e.message);
    }
  };

  const handleRemoveStaff = async () => {
    const member = confirmRemoveStaff;
    setConfirmRemoveStaff(null);
    try {
      await deleteStaffAccount(member.id);
    } catch (e) {
      setSaveError(e.message);
    }
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (!owner) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Icon name="shield_person" size={30} color={NEUTRAL.text4} />
        <Text style={styles.blockedTitle}>{t('ownerOnlyBlockTitle')}</Text>
        <Text style={styles.blockedBody}>{t('ownerOnlyBlockBody')}</Text>
      </View>
    );
  }

  if (!rolesLoaded) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={BRAND.navy} />
      </View>
    );
  }

  if (!selected) return null;

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>

        {!!saveError && (
          <View style={styles.errorBanner}>
            <Icon name="error" size={19} color={DANGER} />
            <Text style={styles.errorBannerText}>{saveError}</Text>
          </View>
        )}

        {dirty && (
          <View style={styles.notice}>
            <Icon name="edit" size={19} color={NEUTRAL.text2} />
            <Text style={styles.noticeText}>{t('unsavedChangesNotice')}</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveInline, saving && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              <Text style={styles.saveInlineText}>{saving ? t('savingShort') : t('saveChanges')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.split}>
          {/* ── Role list ── */}
          <View style={styles.listPanel}>
            <View style={styles.listHead}>
              <Text style={styles.panelTitle}>{t('rolesHeading')}</Text>
              <TouchableOpacity onPress={addRole} style={styles.addBtn} activeOpacity={0.7}>
                <Icon name="add" size={19} color={NEUTRAL.text2} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8 }}>
              {list.map((role) => {
                const on = role.id === selected.id;
                const count = staff.filter(s => s.roleId === role.id).length;
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
                        {role.locked
                          ? t('roleYouLabel')
                          : t('roleMetaCount', {
                              count,
                              person: count === 1 ? t('personSingular') : t('personPlural'),
                              perms: role.perms.length,
                            })}
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
              <Text style={d.overline}>{t('roleNameOverline')}</Text>
              <TextInput
                value={selected.name}
                onChangeText={v => patch({ name: v })}
                editable={!selected.locked}
                placeholderTextColor={NEUTRAL.text4}
                style={[styles.nameInput, selected.locked && styles.inputLocked]}
              />
              {selected.locked && (
                <Text style={styles.lockedHint}>{t('roleLockedHint')}</Text>
              )}
            </View>

            <View>
              <Text style={[d.overline, { marginBottom: 4 }]}>{t('sectionsOverline')}</Text>
              <Text style={styles.sectionHint}>{t('sectionsHint')}</Text>
              <View style={styles.sectionGrid}>
                {SECTION_LIST.map((sec) => {
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
                      <Icon name={sec.icon} size={18} color={on ? BRAND.navy : NEUTRAL.text3} />
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
              <Text style={[d.overline, { marginBottom: 4 }]}>{t('permsOverline')}</Text>
              <Text style={styles.sectionHint}>{t('permsHint')}</Text>
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
                  <Text style={styles.deleteText}>{t('deleteRoleAction')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── People ── */}
        <View style={styles.peoplePanel}>
          <View style={styles.listHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.panelTitle}>{t('peopleHeading')}</Text>
              <Text style={styles.sectionHint}>{t('peopleHint')}</Text>
            </View>
            <TouchableOpacity
              onPress={openAddStaff}
              disabled={assignableRoles.length === 0 || dirty}
              style={[
                d.btnPrimary,
                (assignableRoles.length === 0 || dirty) && { opacity: 0.5 },
              ]}
              activeOpacity={0.9}
            >
              <Icon name="person_add" size={20} color={BRAND.yellow} />
              <Text style={d.btnPrimaryText}>{t('addPersonBtn')}</Text>
            </TouchableOpacity>
          </View>

          {dirty && (
            <Text style={styles.sectionHint}>{t('saveBeforeAdding')}</Text>
          )}

          {staff.length === 0 ? (
            <Text style={d.emptyHint}>{t('noStaffYet')}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {staff.map((member) => (
                <View key={member.id} style={d.listRow}>
                  <View style={d.listRowIcon}>
                    <Text style={styles.staffInitial}>
                      {(member.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={d.listRowLabel} numberOfLines={1}>{member.username}</Text>
                    <Text style={styles.staffEmail} numberOfLines={1}>{member.email}</Text>
                  </View>

                  <View style={styles.rolePicker}>
                    {assignableRoles.map((role) => {
                      const on = member.roleId === role.id;
                      return (
                        <TouchableOpacity
                          key={role.id}
                          onPress={() => handleChangeStaffRole(member.id, role.id)}
                          style={[styles.rolePill, on && styles.rolePillOn]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.rolePillText, on && { color: '#FFFFFF' }]}>
                            {role.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={() => setConfirmRemoveStaff(member)}
                    style={styles.iconBtn}
                    activeOpacity={0.7}
                    accessibilityLabel={t('removeStaffLabel', { name: member.username })}
                  >
                    <Icon name="delete" size={19} color={DANGER} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Add staff ── */}
      <Drawer
        visible={showAddStaff}
        onClose={() => !staffSaving && setShowAddStaff(false)}
        width={460}
        title={t('addManagerAccessTitle')}
        subtitle={t('addManagerAccessSub')}
        footer={(
          <>
            <TouchableOpacity
              onPress={() => setShowAddStaff(false)}
              style={d.btnGhost}
              activeOpacity={0.8}
            >
              <Text style={d.btnGhostText}>{t('cancelAction')}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={handleAddStaff}
              disabled={staffSaving || !staffName.trim() || !staffEmail.trim() || !staffPassword || !staffRoleId}
              style={[
                d.btnPrimary,
                (staffSaving || !staffName.trim() || !staffEmail.trim() || !staffPassword || !staffRoleId)
                  && { opacity: 0.5 },
              ]}
              activeOpacity={0.9}
            >
              <Icon name="save" size={20} color={BRAND.yellow} />
              <Text style={d.btnPrimaryText}>{staffSaving ? t('savingShort') : t('createAccountBtn')}</Text>
            </TouchableOpacity>
          </>
        )}
      >
        <View>
          <FieldLabel>{t('name')}</FieldLabel>
          <TextInput
            value={staffName}
            onChangeText={setStaffName}
            placeholder="e.g. Marta"
            placeholderTextColor={NEUTRAL.text4}
            style={d.textInput}
          />
        </View>
        <View>
          <FieldLabel>{t('fieldEmail')}</FieldLabel>
          <TextInput
            value={staffEmail}
            onChangeText={setStaffEmail}
            placeholder="marta@example.com"
            placeholderTextColor={NEUTRAL.text4}
            autoCapitalize="none"
            style={d.textInput}
          />
        </View>
        <View>
          <FieldLabel>{t('fieldTemporaryPassword')}</FieldLabel>
          <TextInput
            value={staffPassword}
            onChangeText={setStaffPassword}
            placeholder="••••••••"
            placeholderTextColor={NEUTRAL.text4}
            secureTextEntry
            style={d.textInput}
          />
          <Text style={styles.sectionHint}>{t('tempPasswordHint')}</Text>
        </View>
        <View>
          <FieldLabel>{t('fieldRole')}</FieldLabel>
          <View style={styles.rolePickerWide}>
            {assignableRoles.map((role) => {
              const on = staffRoleId === role.id;
              return (
                <TouchableOpacity
                  key={role.id}
                  onPress={() => setStaffRoleId(role.id)}
                  style={[styles.rolePill, on && styles.rolePillOn]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.rolePillText, on && { color: '#FFFFFF' }]}>
                    {role.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!!staffError && <Text style={styles.errorText}>{staffError}</Text>}
        </View>
      </Drawer>

      <ConfirmDialog
        visible={!!confirmDelete}
        title={t('deleteRoleConfirmTitle')}
        message={t('deleteRoleConfirmBody', { name: confirmDelete?.name })}
        confirmLabel={t('deleteAction')}
        onConfirm={deleteRole}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        visible={!!confirmRemoveStaff}
        title={t('removeStaffConfirmTitle')}
        message={t('removeStaffConfirmBody', { name: confirmRemoveStaff?.username })}
        confirmLabel={t('remove')}
        onConfirm={handleRemoveStaff}
        onCancel={() => setConfirmRemoveStaff(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NEUTRAL.appBg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  blockedTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 18, color: NEUTRAL.text,
  },
  blockedBody: {
    maxWidth: 420, textAlign: 'center',
    fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: NEUTRAL.text3,
  },

  page: {
    paddingTop: 24, paddingHorizontal: 28, paddingBottom: 40,
    maxWidth: 1156, gap: 20,
  },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: SUNKEN,
  },
  noticeText: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.regular, fontSize: 13.5, lineHeight: 19, color: NEUTRAL.text2,
  },
  saveInline: {
    height: 38, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: BRAND.navy, alignItems: 'center', justifyContent: 'center',
  },
  saveInlineText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 14, color: '#FFFFFF',
  },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  errorBannerText: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontSize: 13.5, lineHeight: 19, color: DANGER,
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
    marginTop: 2, marginBottom: 12,
    fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: NEUTRAL.text3,
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

  /* People */
  peoplePanel: {
    padding: 22, borderRadius: 22,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  staffInitial: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 15, color: BRAND.navy,
  },
  staffEmail: {
    marginTop: 2, fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text3,
  },
  rolePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexShrink: 0 },
  rolePickerWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rolePill: {
    height: 32, paddingHorizontal: 13, borderRadius: 11,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  rolePillOn: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  rolePillText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13, color: NEUTRAL.text2,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 11, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },

  errorText: { marginTop: 8, fontFamily: FONTS.medium, fontSize: 13, color: DANGER },
});