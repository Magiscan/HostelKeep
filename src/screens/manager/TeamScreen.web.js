import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import * as XLSX from 'xlsx';
import Icon from '../../components/Icon';
import { COLORS, FONTS, RADIUS, SPACING, SHADOW } from '../../theme';
import { Button, EmptyState } from '../../components/UI';  // Input/Label no longer used
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { buildCleanerColors } from '../../utils/cleanerColor';
import { BRAND, NEUTRAL, STATUS, ACCENT } from '../../theme/tokens';
import { Drawer, FieldLabel, ConfirmDialog, drawerStyles as d } from '../../components/Dashboard/Drawer.web';

// ─── Excel helpers (same as before) ────────────────────────────
const EXTRA_BLANK_ROWS = 5;
function formatDateIT(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}
function sanitizeSheetName(name) {
  const cleaned = (name || 'Cleaner').replace(/[:\\/?*[\]]/g, '').trim();
  return cleaned.slice(0, 31) || 'Cleaner';
}

export default function TeamScreen({ onReady }) {
  const { t } = useTranslation();
  const {
    cleaners, rooms, roomStatus, deleteCleaner, can,
  } = useApp();
  const { registerCleaner, resetCleanerPassword, user } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteModal, setDeleteModal] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState('');

  const [expandedCleaner, setExpandedCleaner] = useState(null);

  const colors = useMemo(() => buildCleanerColors(cleaners), [cleaners]);

  const canManageTeam = can('manageTeam');

  const closeForm = () => {
    setShowForm(false);
    setName('');
    setPassword('');
    setFormError('');
  };

  const handleAddCleaner = async () => {
    if (!name.trim() || !password.trim()) return;
    if (password.length < 8) {
      setFormError(t('passwordTooShort') || 'Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await registerCleaner(name.trim(), password, user.hostelCode);
      closeForm();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteCleaner(deleteModal.id);
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeleteModal(null);
    }
  };

  const openReset = (cleaner) => {
    setResetModal(cleaner);
    setNewPassword('');
    setResetError('');
  };

  const handleReset = async () => {
    if (!resetModal) return;
    if (newPassword.length < 8) {
      setResetError(t('passwordTooShort') || 'Password must be at least 8 characters.');
      return;
    }
    setResetSaving(true);
    setResetError('');
    try {
      await resetCleanerPassword(resetModal.id, newPassword, user.hostelCode);
      setResetModal(null);
      setNewPassword('');
    } catch (e) {
      setResetError(e.message);
    } finally {
      setResetSaving(false);
    }
  };

  // ── Excel export (memoized) ──────────────────────────────────
  const handleExportSheets = useCallback(() => {
    if (!cleaners.length) {
      Alert.alert(t('exportNoCleanersTitle'), t('exportNoCleanersBody'));
      return;
    }

    const wb = XLSX.utils.book_new();
    const dateStr = formatDateIT(new Date());
    const usedSheetNames = new Set();

    cleaners.forEach(cleaner => {
      const assignedRooms = rooms
        .filter(r => r.assignedTo === cleaner.id)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      const aoa = [];
      aoa.push([`${cleaner.username} – ${dateStr}`]);
      aoa.push(['Room', 'Beds', 'Done']);

      assignedRooms.forEach(room => {
        let beds = '';
        if (room.type === 'dorm' && room.beds?.length) {
          const assign = (roomStatus[room.id] || {}).assignmentBedStatus || {};
          beds = room.beds
            .filter(b => (assign[b.id]?.status || 'clean') !== 'noone')
            .map(b => b.name)
            .join('-');
        }
        aoa.push([room.name, beds, '']);
      });

      for (let i = 0; i < EXTRA_BLANK_ROWS; i++) aoa.push(['', '', '']);
      aoa.push([t('signatureLabel'), '', t('endTimeLabel')]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
      ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 14 }];

      let sheetName = sanitizeSheetName(cleaner.username);
      let unique = sheetName, n = 1;
      while (usedSheetNames.has(unique)) unique = `${sheetName.slice(0, 28)}_${n++}`;
      usedSheetNames.add(unique);

      XLSX.utils.book_append_sheet(wb, ws, unique);
    });

    const fileName = `team_sheets_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [cleaners, rooms, roomStatus]);

  useEffect(() => {
    if (!onReady) return;
    onReady({
      print: handleExportSheets,
      ...(canManageTeam ? { addCleaner: () => setShowForm(true) } : {}),
    });
  }, [onReady, handleExportSheets, canManageTeam]);

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.mainAreaContent}>
        {cleaners.length === 0 ? (
          <EmptyState icon="👤" title={t('noCleaners')} subtitle={t('addfirstCleaner')} />
        ) : (
          <View style={styles.cleanerGrid}>
            {cleaners.map((c) => {
              const color = colors[c.id];
              const assignedRooms = rooms.filter(r => r.assignedTo === c.id);
              const done = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
              const total = assignedRooms.length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              const isExpanded = expandedCleaner === c.id;

              return (
                <View key={c.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={[styles.avatar, { backgroundColor: color }]}>
                      <Text style={styles.avatarText}>
                        {c.username?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cleanerName} numberOfLines={1}>{c.username}</Text>
                      <Text style={styles.roomsLabel}>
                        {done}/{total} {t('rooms')}
                      </Text>
                    </View>
                   {canManageTeam && (
                    <View style={styles.cardBtns}>
                      <TouchableOpacity
                        onPress={() => openReset(c)}
                        style={styles.iconBtn}
                        activeOpacity={0.7}
                        accessibilityLabel={t('resetPassword') || 'Reset password'}
                      >
                        <Icon name="key" size={19} color={NEUTRAL.text3} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDeleteModal(c)}
                        style={styles.iconBtn}
                        activeOpacity={0.7}
                        accessibilityLabel={t('deleteCleaner') || 'Remove from team'}
                      >
                        <Icon name="delete" size={19} color="#B91C1C" />
                      </TouchableOpacity>
                    </View>
                    )}
                  </View>

                  <View style={styles.track}>
                    <View style={[styles.fill, {
                      width: `${pct}%`,
                      backgroundColor: pct === 100 && total ? ACCENT.complete : BRAND.yellow,
                    }]} />
                  </View>

                  <TouchableOpacity
                    onPress={() => setExpandedCleaner(isExpanded ? null : c.id)}
                    style={styles.expandToggle}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.expandToggleText}>
                      {isExpanded ? t('hideRooms') : t('showRooms')}
                    </Text>
                    <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={17} color={NEUTRAL.text3} />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.expanded}>
                      {assignedRooms.length === 0 ? (
                        <Text style={styles.emptyRooms}>
                          {t('noRoomsAssignedYet') || 'No rooms assigned yet.'}
                        </Text>
                      ) : (
                        assignedRooms.map(room => {
                          const cleaned = !!roomStatus[room.id]?.cleaned;
                          const s = cleaned ? STATUS.inspected : STATUS.dirty;
                          return (
                            <View key={room.id} style={styles.roomRow}>
                              <Text
                                style={[styles.roomName, cleaned && { color: STATUS.inspected.text }]}
                                numberOfLines={1}
                              >
                                {room.name}
                              </Text>
                              <View style={[styles.roomPill, { backgroundColor: s.bg, borderColor: s.border }]}>
                                <Text style={[styles.roomPillText, { color: s.text }]}>
                                  {cleaned ? (t('cleaned') || 'Cleaned') : (t('pending') || 'Pending')}
                                </Text>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Add Cleaner Drawer ── */}
      <Drawer
        visible={showForm}
        onClose={closeForm}
        width={460}
        title={t('addCleaner')}
        subtitle={t('addCleanerDrawerSub')}
        footer={
          <>
            <TouchableOpacity onPress={closeForm} style={d.btnGhost} activeOpacity={0.8}>
              <Text style={d.btnGhostText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={handleAddCleaner}
              disabled={saving || !name.trim() || !password.trim()}
              style={[d.btnPrimary, (saving || !name.trim() || !password.trim()) && { opacity: 0.5 }]}
              activeOpacity={0.9}
            >
              <Icon name="save" size={20} color={BRAND.yellow} />
              <Text style={d.btnPrimaryText}>{saving ? t('saving') : t('save')}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View>
          <FieldLabel>{t('cleanerName')}</FieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('cleanerName')}
            placeholderTextColor={NEUTRAL.text4}
            autoCapitalize="none"
            style={d.textInput}
          />
        </View>
        <View>
          <FieldLabel>{t('cleanerPassword')}</FieldLabel>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={NEUTRAL.text4}
            secureTextEntry
            style={d.textInput}
          />
          {!!formError && <Text style={styles.errorText}>{formError}</Text>}
        </View>
      </Drawer>

      {/* ── Reset Password Drawer ── */}
      <Drawer
        visible={!!resetModal}
        onClose={() => setResetModal(null)}
        width={460}
        title={t('resetPassword') || 'Reset password'}
        subtitle={t('resetPasswordFor', { name: resetModal?.username || '' })}
        footer={
          <>
            <TouchableOpacity onPress={() => setResetModal(null)} style={d.btnGhost} activeOpacity={0.8}>
              <Text style={d.btnGhostText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={handleReset}
              disabled={resetSaving || !newPassword.trim()}
              style={[d.btnPrimary, (resetSaving || !newPassword.trim()) && { opacity: 0.5 }]}
              activeOpacity={0.9}
            >
              <Icon name="save" size={20} color={BRAND.yellow} />
              <Text style={d.btnPrimaryText}>{resetSaving ? t('saving') : t('save')}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View>
          <FieldLabel>{t('newPassword') || 'New password'}</FieldLabel>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            placeholderTextColor={NEUTRAL.text4}
            secureTextEntry
            style={d.textInput}
          />
          {!!resetError && <Text style={styles.errorText}>{resetError}</Text>}
        </View>
      </Drawer>

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        visible={!!deleteModal}
        title={t('deleteCleaner') || 'Delete cleaner'}
        message={t('deleteCleanerConfirmation', { name: deleteModal?.username || '' })}
        confirmLabel={t('delete')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NEUTRAL.appBg, position: 'relative' },
  mainAreaContent: { paddingTop: 24, paddingHorizontal: 28, paddingBottom: 40 },

  cleanerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: {
    flexGrow: 1, flexBasis: 340, minWidth: 340, maxWidth: '100%',
    padding: 18, borderRadius: 22,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: {
    width: 40, height: 40, borderRadius: 999, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 16, color: '#FFFFFF',
  },
  cleanerName: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 17, color: NEUTRAL.text,
  },
  roomsLabel: {
    marginTop: 2, fontFamily: FONTS.regular, fontSize: 12.5,
    color: NEUTRAL.text3, fontVariant: ['tabular-nums'],
  },

  cardBtns: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 11,
    borderWidth: 1, borderColor: 'transparent', backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Gold while in progress, green once the whole list is done */
  track: {
    height: 7, borderRadius: 999, marginTop: 15,
    backgroundColor: NEUTRAL.slateChip, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999 },

  expandToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingTop: 11, paddingBottom: 4,
  },
  expandToggleText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13, color: NEUTRAL.text3,
  },

  expanded: {
    borderTopWidth: 1, borderTopColor: '#EEF2F7',
    marginTop: 6, paddingTop: 4,
  },
  emptyRooms: {
    fontFamily: FONTS.regular, fontSize: 13.5, color: NEUTRAL.text3, paddingVertical: 10,
  },
  roomRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, paddingVertical: 9,
  },
  roomName: {
    flexShrink: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13.5, color: NEUTRAL.text,
  },
  roomPill: {
    height: 26, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  roomPillText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12 },

  errorText: { marginTop: 8, fontFamily: FONTS.medium, fontSize: 13, color: '#B91C1C' },
});