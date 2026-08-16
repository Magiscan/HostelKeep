import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import * as XLSX from 'xlsx';
import Icon from '../../components/Icon';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING, SHADOW } from '../../theme';
import { Button, Label, Input, SectionTitle, EmptyState, Badge } from '../../components/UI';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

// ─── Excel helpers (same as AssignScreen.web.js) ────────────────
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

// ─── Generic centered overlay/dialog ───────────────────────────
function Overlay({ visible, onClose, children, maxWidth = 420 }) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={[styles.overlayCard, { maxWidth }]}>
        {children}
      </View>
    </View>
  );
}

export default function TeamScreen() {
  const { t } = useTranslation();
  const {
    cleaners, rooms, roomStatus, deleteCleaner,
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

  // ── Excel export (same as Assign screen) ────────────────────
  const handleExportSheets = () => {
    if (!cleaners.length) {
      Alert.alert('No cleaners', 'Add cleaners before exporting.');
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
      aoa.push(['Signature', '', 'End Time:']);

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
  };

  return (
    <View style={styles.safe}>
      {/* ── Toolbar ── */}
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.title}>{t('team')}</Text>
          <Text style={styles.subtitle}>
            {cleaners.length} {t('cleaner')}{cleaners.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.toolbarActions}>
          <TouchableOpacity onPress={handleExportSheets} style={styles.toolBtn} activeOpacity={0.7}>
            <Icon name="print-outline" size={16} color={COLORS.primary} />
            <Text style={styles.toolBtnText}>{t('printSheets') || 'Print Sheets'}</Text>
          </TouchableOpacity>
          <Button title={t('addCleaner')} onPress={() => setShowForm(true)} size="sm" icon="person-add-outline" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.mainAreaContent}>
        {cleaners.length === 0 ? (
          <EmptyState icon="👤" title={t('noCleaners')} subtitle={t('addfirstCleaner')} />
        ) : (
          <View style={styles.cleanerGrid}>
            {cleaners.map(c => {
              const assignedRooms = rooms.filter(r => r.assignedTo === c.id);
              const done = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
              const total = assignedRooms.length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              const isExpanded = expandedCleaner === c.id;

              return (
                <View key={c.id} style={styles.cleanerCard}>
                  <View style={styles.cleanerCardTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{c.username?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cleanerName}>{c.username}</Text>
                      <Text style={styles.progressCount}>{done}/{total} {t('rooms')}</Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity onPress={() => openReset(c)} style={styles.cardActionBtn}>
                        <Icon name="key-outline" size={16} color={COLORS.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setDeleteModal(c)} style={styles.cardActionBtn}>
                        <Icon name="trash-outline" size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>

                  <TouchableOpacity
                    onPress={() => setExpandedCleaner(isExpanded ? null : c.id)}
                    style={styles.expandToggle}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.expandToggleText}>
                      {isExpanded ? t('hideRooms') || 'Hide rooms' : t('showRooms') || 'Show rooms'}
                    </Text>
                    <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.expandedSection}>
                      {assignedRooms.length === 0 ? (
                        <Text style={styles.emptyRooms}>{t('noRoomsAssignedYet') || 'No rooms assigned yet.'}</Text>
                      ) : (
                        assignedRooms.map(room => {
                          const status = roomStatus[room.id] || {};
                          const cleaned = status.cleaned || false;
                          return (
                            <View key={room.id} style={styles.roomRow}>
                              <Text style={[styles.roomName, cleaned && { color: COLORS.success }]}>
                                {room.name}
                              </Text>
                              <Badge label={cleaned ? t('cleaned') || 'Cleaned' : t('pending') || 'Pending'} type={cleaned ? 'clean' : 'extra'} />
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

      {/* ── Add Cleaner dialog ── */}
      <Overlay visible={showForm} onClose={closeForm}>
        <View style={styles.dialogHeaderRow}>
          <Text style={styles.modalTitle}>{t('addCleaner')}</Text>
          <TouchableOpacity onPress={closeForm}>
            <Icon name="close" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        <Label>{t('cleanerName')}</Label>
        <Input value={name} onChangeText={setName} placeholder={t('cleanerName')} autoCapitalize="none" style={{ marginBottom: SPACING[3] }} />
        <Label>{t('cleanerPassword')}</Label>
        <Input value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry style={{ marginBottom: SPACING[2] }} />
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[3] }}>
          <TouchableOpacity onPress={closeForm} style={[styles.modalBtn, styles.modalBtnCancel]}>
            <Text style={styles.modalBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAddCleaner}
            disabled={saving || !name.trim() || !password.trim()}
            style={[styles.modalBtn, styles.modalBtnPrimary, (saving || !name.trim() || !password.trim()) && { opacity: 0.5 }]}
          >
            <Text style={[styles.modalBtnText, { color: COLORS.white }]}>
              {saving ? t('saving') : t('save')}
            </Text>
          </TouchableOpacity>
        </View>
      </Overlay>

      {/* ── Reset password dialog ── */}
      <Overlay visible={!!resetModal} onClose={() => setResetModal(null)}>
        <View style={styles.dialogHeaderRow}>
          <Text style={styles.modalTitle}>{t('resetPassword') || 'Reset password'}</Text>
          <TouchableOpacity onPress={() => setResetModal(null)}>
            <Icon name="close" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.dialogDescription}>
          {(t('resetPasswordFor') || 'Set a new password for {{name}}.').replace('{{name}}', resetModal?.username || '')}
        </Text>
        <Label>{t('newPassword') || 'New password'}</Label>
        <Input value={newPassword} onChangeText={setNewPassword} placeholder="••••••••" secureTextEntry style={{ marginBottom: SPACING[2] }} />
        {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
        <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[3] }}>
          <TouchableOpacity onPress={() => setResetModal(null)} style={[styles.modalBtn, styles.modalBtnCancel]}>
            <Text style={styles.modalBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleReset}
            disabled={resetSaving || !newPassword.trim()}
            style={[styles.modalBtn, styles.modalBtnPrimary, (resetSaving || !newPassword.trim()) && { opacity: 0.5 }]}
          >
            <Text style={[styles.modalBtnText, { color: COLORS.white }]}>
              {resetSaving ? t('saving') : t('save')}
            </Text>
          </TouchableOpacity>
        </View>
      </Overlay>

      {/* ── Delete confirmation ── */}
      <Overlay visible={!!deleteModal} onClose={() => setDeleteModal(null)} maxWidth={400}>
        <Text style={styles.modalTitle}>{t('deleteCleaner') || 'Delete cleaner'}</Text>
        <Text style={styles.modalMessage}>
          {(t('deleteCleanerConfirmation') || 'Remove {{name}} from your team? This cannot be undone.').replace('{{name}}', deleteModal?.username || '')}
        </Text>
        <View style={styles.modalActions}>
          <TouchableOpacity onPress={() => setDeleteModal(null)} style={[styles.modalBtn, styles.modalBtnCancel]}>
            <Text style={styles.modalBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmDelete} style={[styles.modalBtn, { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]}>
            <Text style={[styles.modalBtnText, { color: COLORS.white }]}>{t('delete')}</Text>
          </TouchableOpacity>
        </View>
      </Overlay>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background, position: 'relative' },

  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: SPACING[3],
    paddingHorizontal: SPACING[6], paddingVertical: SPACING[4],
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  subtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING[3] },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  toolBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.primary },

  mainAreaContent: { padding: SPACING[6] },

  cleanerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[4] },
  cleanerCard: {
    width: 320,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING[4], ...SHADOW.sm,
  },
  cleanerCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING[3] },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING[3],
  },
  avatarText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.primary },
  cleanerName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text },
  progressCount: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 4 },
  cardActionBtn: { padding: 6, borderRadius: 6 },

  progressBar: { height: 6, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.primary },

  expandToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: SPACING[2], marginTop: SPACING[2],
  },
  expandToggleText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  expandedSection: {
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: SPACING[2], marginTop: SPACING[1],
  },
  emptyRooms: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, paddingVertical: SPACING[2] },
  roomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING[1] },
  roomName: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text },

  /* centered overlay/dialog */
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    padding: SPACING[6], zIndex: 50,
  },
  overlayCard: {
    width: '100%',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING[5], ...SHADOW.md,
  },
  dialogHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING[3] },
  dialogDescription: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING[3] },
  modalTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  modalMessage: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING[2], marginBottom: SPACING[5] },
  modalActions: { flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[4] },
  modalBtn: { flex: 1, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  modalBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  modalBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },
  errorText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.danger, marginTop: 4 },
});