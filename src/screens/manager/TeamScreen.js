import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Modal,
} from 'react-native';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, SPACING } from '../../theme';
import {
  Button, Card, Label, Input, SectionTitle, EmptyState,
} from '../../components/UI';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

// ─── Confirmation modal (works on web + mobile) ────────────────
function ConfirmModal({ visible, title, message, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button title="Delete" variant="danger" onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function TeamScreen() {
  const { cleaners, deleteCleaner } = useApp();
  const { registerCleaner, user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);   // stores the cleaner object to delete

  const handleAddCleaner = async () => {
    if (!name.trim() || !password.trim()) return;
    if (!user || !user.hostelCode) {
      // This shouldn't happen, but just in case
      return;
    }
    setSaving(true);
    try {
      await registerCleaner(name.trim(), password, user.hostelCode);
      setShowForm(false);
      setName('');
      setPassword('');
    } catch (e) {
      // Show the error from Firebase
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
        <SectionTitle title="Team" subtitle={`${cleaners.length} cleaner${cleaners.length !== 1 ? 's' : ''}`} />
        <Button title="+ Add" onPress={() => setShowForm(true)} size="sm" />
      </View>

      {showForm && (
        <Card style={styles.formCard}>
          <Label>Name</Label>
          <Input value={name} onChangeText={setName} placeholder="Cleaner username" autoCapitalize="none" style={{ marginBottom: SPACING[3] }} />
          <Label>Password (min. 6 characters)</Label>
          <Input value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry style={{ marginBottom: SPACING[4] }} />
          <View style={{ flexDirection: 'row', gap: SPACING[2] }}>
            <Button
              title={saving ? 'Saving…' : 'Save'}
              onPress={handleAddCleaner}
              disabled={saving}
              style={{ flex: 1 }}
            />
            <Button title="Cancel" onPress={() => setShowForm(false)} variant="secondary" style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {cleaners.length === 0 && !showForm && (
        <EmptyState icon="👤" title="No cleaners yet" subtitle="Add your first cleaner" />
      )}

      {cleaners.map(c => (
        <Card key={c.id} style={styles.cleanerCard}>
          <View style={styles.cleanerRow}>
            <Text style={styles.cleanerName}>{c.username}</Text>
            <Button
              title="Delete"
              onPress={() => setDeleteModal(c)}
              variant="danger"
              size="sm"
            />
          </View>
        </Card>
      ))}

      {/* Custom confirmation modal for delete */}
      <ConfirmModal
        visible={!!deleteModal}
        title="Delete cleaner"
        message={`Are you sure you want to remove ${deleteModal?.username}?`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING[4] },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: SPACING[2],
  },
  formCard: { padding: SPACING[4], marginBottom: SPACING[4] },
  cleanerCard: { padding: SPACING[3], marginBottom: SPACING[2] },
  cleanerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cleanerName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text },
  // Modal styles
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
  modalActions: {
    flexDirection: 'row',
    gap: SPACING[2],
  },
});