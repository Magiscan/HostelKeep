import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING, SHADOW } from '../../theme';
import { Button, Card, Label, Input, SectionTitle, EmptyState, Badge } from '../../components/UI';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

export default function TeamScreen() {
  const { t } = useTranslation();
  const { cleaners, rooms, roomStatus, deleteCleaner } = useApp();
  const { registerCleaner, user } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [expandedCleaner, setExpandedCleaner] = useState(null);

  const handleAddCleaner = async () => {
    if (!name.trim() || !password.trim()) return;
    if (password.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await registerCleaner(name.trim(), password, user.hostelCode);
      setShowForm(false);
      setName('');
      setPassword('');
    } catch (e) {
      alert(e.message);
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

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <SectionTitle
          title={t('team')}
          subtitle={`${cleaners.length} cleaner${cleaners.length !== 1 ? 's' : ''}`}
        />
        <Button title={t('addCleaner')} onPress={() => setShowForm(true)} size="sm" />
      </View>

      {showForm && (
        <Card style={styles.formCard}>
          <Label>{t('cleanerName')}</Label>
          <Input value={name} onChangeText={setName} placeholder={t('cleanerName')} autoCapitalize="none" style={{ marginBottom: SPACING[3] }} />
          <Label>{t('cleanerPassword')}</Label>
          <Input value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry style={{ marginBottom: SPACING[4] }} />
          <View style={{ flexDirection: 'row', gap: SPACING[2] }}>
            <Button title={saving ? t('saving') : t('save')} onPress={handleAddCleaner} disabled={saving} style={{ flex: 1 }} />
            <Button title={t('cancel')} onPress={() => setShowForm(false)} variant="secondary" style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {/* ── Cleaner Summary Section ── */}
      {cleaners.length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Workload Summary</Text>
          {cleaners.map(c => {
            const assignedRooms = rooms.filter(r => r.assignedTo === c.id);
            const done = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
            const total = assignedRooms.length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const isExpanded = expandedCleaner === c.id;

            return (
              <Card key={c.id} style={styles.cleanerCard}>
                <TouchableOpacity
                  style={styles.cleanerSummaryRow}
                  onPress={() => setExpandedCleaner(isExpanded ? null : c.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{c.username?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cleanerName}>{c.username}</Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.progressText}>{done}/{total} rooms</Text>
                  <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.expandedSection}>
                    {assignedRooms.length === 0 ? (
                      <Text style={styles.emptyRooms}>No rooms assigned yet.</Text>
                    ) : (
                      assignedRooms.map(room => {
                        const status = roomStatus[room.id] || {};
                        const cleaned = status.cleaned || false;
                        return (
                          <View key={room.id} style={styles.roomRow}>
                            <Text style={[styles.roomName, cleaned && { color: COLORS.success }]}>
                              {room.name}
                            </Text>
                            <Badge label={cleaned ? 'Cleaned' : 'Pending'} type={cleaned ? 'clean' : 'extra'} />
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      {/* ── Cleaner Management (existing) ── */}
      {cleaners.length === 0 && !showForm && (
        <EmptyState icon="👤" title={t('noCleaners')} subtitle={t('addfirstCleaner')} />
      )}

      {/* ── Modals (delete & reset) ── */}
      {/* (keep your existing delete and reset modals here) */}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING[4] },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING[2] },
  formCard: { padding: SPACING[4], marginBottom: SPACING[4] },
  summarySection: { marginTop: SPACING[4] },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    marginBottom: SPACING[2],
  },
  cleanerCard: { marginBottom: SPACING[2], padding: 0 },
  cleanerSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING[3],
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING[3],
  },
  avatarText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.primary },
  cleanerName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text, flex: 1 },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginTop: 6,
    flex: 1,
    marginRight: SPACING[2],
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  progressText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginRight: SPACING[2],
  },
  chevron: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    paddingLeft: SPACING[2],
  },
  expandedSection: {
    paddingHorizontal: SPACING[3],
    paddingBottom: SPACING[3],
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING[2],
  },
  emptyRooms: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    paddingVertical: SPACING[2],
  },
  roomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING[1],
  },
  roomName: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text },
});