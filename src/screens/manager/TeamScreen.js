import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable, Alert,
} from 'react-native';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING, SHADOW } from '../../theme';
import { Button, Card, Label, Input, SectionTitle, EmptyState } from '../../components/UI';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

export default function TeamScreen() {
  const { t } = useTranslation();
  const { cleaners, deleteCleaner } = useApp();
  // FIXED: `user` is no longer needed — the server reads the hostel from the
  // caller's own profile. `resetCleanerPassword` is new.
  const { registerCleaner, resetCleanerPassword, user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleAddCleaner = async () => {
    if (!name.trim() || !password.trim()) return;
    // Raised from 6 to match MIN_PASSWORD_LENGTH on the server. When these
    // disagree the UI accepts passwords the callable then rejects.
    if (password.length < 8) {
      Alert.alert(t('passwordTooShort') || 'Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await registerCleaner(name.trim(), password, user.hostelCode);
      setShowForm(false);
      setName('');
      setPassword('');
    } catch (e) {
      Alert.alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteCleaner(deleteModal.id);
    } catch (e) {
      Alert.alert(e.message);
    } finally {
      setDeleteModal(null);
    }
  };

  const confirmReset = async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert(t('passwordTooShort') || 'Password must be at least 8 characters.');
      return;
    }
    setResetting(true);
    try {
      // On Spark the client SDK cannot change another user's password, so
      // this recreates the account — but unlike the old code it MIGRATES the
      // cleaner's room assignments to the new uid instead of orphaning them,
      // and it frees the old login lookup so the name can be reused.
      await resetCleanerPassword(resetModal.id, newPassword, user.hostelCode);
      setResetModal(null);
      setNewPassword('');
      Alert.alert(t('passwordResetSuccess') || 'Password updated.');
    } catch (e) {
      Alert.alert(e.message);
    } finally {
      setResetting(false);
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
          <Input
            value={name}
            onChangeText={setName}
            placeholder={t('cleanerName')}
            autoCapitalize="none"
            style={{ marginBottom: SPACING[3] }}
          />
          <Label>{t('cleanerPassword')}</Label>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            style={{ marginBottom: SPACING[4] }}
          />
          <View style={{ flexDirection: 'row', gap: SPACING[2] }}>
            <Button
              title={saving ? t('saving') : t('save')}
              onPress={handleAddCleaner}
              disabled={saving}
              style={{ flex: 1 }}
            />
            <Button
              title={t('cancel')}
              onPress={() => setShowForm(false)}
              variant="secondary"
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}

      {cleaners.length === 0 && !showForm && (
        <EmptyState icon="👤" title={t('noCleaners')} subtitle={t('addfirstCleaner')} />
      )}

      {cleaners.map(c => (
        <Card key={c.id} style={styles.cleanerCard}>
          <View style={styles.cleanerRow}>
            <Text style={styles.cleanerName} numberOfLines={2}>{c.username}</Text>
            <View style={styles.buttonGroup}>
              <Button
                title={t('resetPassword')}
                onPress={() => setResetModal(c)}
                variant="secondary"
                size="sm"
              />
              <Button
                title={t('delete')}
                onPress={() => setDeleteModal(c)}
                variant="danger"
                size="sm"
              />
            </View>
          </View>
        </Card>
      ))}

      {/* Delete confirmation modal */}
      <Modal visible={!!deleteModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setDeleteModal(null)}>
          <Pressable onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('deleteCleaner')}</Text>
            <Text style={styles.modalMessage}>{t('deleteCleanerMsg')}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setDeleteModal(null)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={[styles.modalBtn, { backgroundColor: COLORS.danger }]}
              >
                <Text style={[styles.modalBtnText, { color: COLORS.white }]}>{t('delete')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Password reset modal */}
      <Modal visible={!!resetModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setResetModal(null)}>
          {/* Inner Pressable stops the backdrop from closing the card on tap */}
          <Pressable onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {t('resetPassword')} {resetModal?.username}
            </Text>
            <Label>{t('newPassword')}</Label>
            <Input
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••••"
              secureTextEntry
              style={{ marginBottom: SPACING[4] }}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setResetModal(null)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmReset}
                disabled={resetting}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <Text style={[styles.modalBtnText, { color: COLORS.white }]}>
                  {resetting ? t('saving') : t('reset')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING[4] },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING[2],
  },
  formCard: { padding: SPACING[4], marginBottom: SPACING[4] },
  cleanerCard: { padding: SPACING[3], marginBottom: SPACING[2] },
  cleanerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING[2],
  },
  cleanerName: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING[2],
  },
  buttonGroup: { flexDirection: 'row', gap: SPACING[2], flexShrink: 0 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[6],
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[5],
    width: '100%',
    maxWidth: 400,
    ...SHADOW.md,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xl,
    color: COLORS.text,
    marginBottom: SPACING[3],
  },
  modalMessage: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING[5],
  },
  modalActions: { flexDirection: 'row', gap: SPACING[2] },
  modalBtn: {
    flex: 1,
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  modalBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.primary },
  modalBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});