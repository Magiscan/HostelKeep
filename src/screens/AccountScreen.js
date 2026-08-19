import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable,
  Alert, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING, SHADOW } from '../theme';
import { Button, Card, Label, Input, SectionTitle } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { deleteOwnAccount } from '../utils/accountDeletion';

// Must point at your live policy — App Review checks that the in-app link and
// the App Store Connect metadata field resolve to the same page.
const PRIVACY_URL = 'https://keepclean-hostel.web.app/privacy.html';

/**
 * Account settings, including the in-app account deletion flow required by
 * App Store Review Guideline 5.1.1(v) and Google Play.
 *
 * Reviewers look for this to be EASY TO FIND. It's reached from the avatar
 * menu (Account item, alongside Language and Hostel Code) rather than a top
 * -level tab — keep it no more than two taps from the main screen.
 *
 * @param {function} [onBack] - if provided, shows a back button that calls
 *   this instead of a tab. Used when this screen is shown as a full-screen
 *   overlay rather than as one of the bottom tabs.
 */
export default function AccountScreen({ onBack }) {
  const { t } = useTranslation();
  const { user, logout, changeOwnPassword } = useAuth();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState('');

  const isManager = user?.role === 'manager';

  const handleChangePassword = async () => {
    if (!currentPassword || newPassword.length < 8) {
      Alert.alert(t('passwordTooShort') || 'Password must be at least 8 characters.');
      return;
    }
    setSavingPassword(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert(t('passwordResetSuccess') || 'Password updated.');
    } catch (e) {
      Alert.alert(e.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePassword) {
      Alert.alert('Please enter your password to confirm.');
      return;
    }
    setDeleting(true);
    setProgress('Verifying…');
    try {
      await deleteOwnAccount(user, deletePassword, setProgress);
      // The auth listener in AuthContext handles navigation once the user is
      // gone. Nothing to do here.
    } catch (e) {
      setDeleting(false);
      setProgress('');
      Alert.alert('Could not delete account', e.message);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      isManager ? 'Delete hostel and account?' : 'Delete your account?',
      isManager
        ? 'This permanently deletes your hostel, all rooms, all cleaning history, '
          + 'and every cleaner account in it. This cannot be undone.'
        : 'This permanently deletes your account and removes you from your hostel. '
          + 'This cannot be undone.',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDelete },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={styles.backRow}
        >
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backText}>{t('back') || 'Back'}</Text>
        </TouchableOpacity>
      )}

      <SectionTitle
        title={t('account') || 'Account'}
        subtitle={user?.username}
      />

      {/* ── Details ── */}
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('username') || 'Username'}</Text>
          <Text style={styles.rowValue}>{user?.username}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('hostelCode') || 'Hostel code'}</Text>
          <Text style={styles.rowValue}>{user?.hostelCode}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('role') || 'Role'}</Text>
          <Text style={styles.rowValue}>{user?.role}</Text>
        </View>
        {user?.recoveryEmail ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('recoveryEmail') || 'Recovery email'}</Text>
            <Text style={styles.rowValue}>{user.recoveryEmail}</Text>
          </View>
        ) : null}
      </Card>

      {/* ── Change password ── */}
      <Card style={styles.card}>
        {!showPasswordForm ? (
          <Button
            title={t('changePassword') || 'Change password'}
            onPress={() => setShowPasswordForm(true)}
            variant="secondary"
          />
        ) : (
          <>
            <Label>{t('currentPassword') || 'Current password'}</Label>
            <Input
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="••••••••"
              secureTextEntry
              style={{ marginBottom: SPACING[3] }}
            />
            <Label>{t('newPassword') || 'New password'}</Label>
            <Input
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••••"
              secureTextEntry
              style={{ marginBottom: SPACING[4] }}
            />
            <View style={{ flexDirection: 'row', gap: SPACING[2] }}>
              <Button
                title={savingPassword ? (t('saving') || 'Saving…') : (t('save') || 'Save')}
                onPress={handleChangePassword}
                disabled={savingPassword}
                style={{ flex: 1 }}
              />
              <Button
                title={t('cancel') || 'Cancel'}
                onPress={() => setShowPasswordForm(false)}
                variant="secondary"
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </Card>

      {/* ── Privacy policy — reviewers check for an in-app link ── */}
      <Card style={styles.card}>
        <TouchableOpacity
          onPress={() => Linking.openURL(PRIVACY_URL)}
          activeOpacity={0.7}
          style={styles.linkRow}
        >
          <Text style={styles.linkText}>{t('privacyPolicy') || 'Privacy Policy'}</Text>
          <Text style={styles.linkChevron}>›</Text>
        </TouchableOpacity>
      </Card>

      {/* ── Sign out ── */}
      <Button
        title={t('signOut') || 'Sign out'}
        onPress={logout}
        variant="secondary"
        style={{ marginBottom: SPACING[6] }}
      />

      {/* ── Danger zone ── */}
      <Card style={[styles.card, styles.dangerCard]}>
        <Text style={styles.dangerTitle}>{t('deleteAccount') || 'Delete account'}</Text>
        <Text style={styles.dangerBody}>
          {isManager
            ? 'Permanently deletes your hostel, all of its rooms and cleaning '
              + 'history, and every cleaner account in it.'
            : 'Permanently deletes your account and all of your personal data.'}
          {' This cannot be undone.'}
        </Text>
        <Button
          title={t('deleteAccount') || 'Delete account'}
          onPress={() => setShowDelete(true)}
          variant="danger"
        />
      </Card>

      {/* ── Delete confirmation ── */}
      <Modal visible={showDelete} transparent animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !deleting && setShowDelete(false)}
        >
          <Pressable onPress={() => {}} style={styles.modalCard}>
            {deleting ? (
              <View style={{ alignItems: 'center', paddingVertical: SPACING[6] }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={[styles.dangerBody, { marginTop: SPACING[4] }]}>
                  {progress || 'Deleting…'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>
                  {isManager ? 'Delete hostel and account' : 'Delete account'}
                </Text>
                <Text style={styles.dangerBody}>
                  Enter your password to confirm. This is permanent.
                </Text>
                <Label>{t('password') || 'Password'}</Label>
                <Input
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  placeholder="••••••••"
                  secureTextEntry
                  style={{ marginBottom: SPACING[4] }}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={() => { setShowDelete(false); setDeletePassword(''); }}
                    style={[styles.modalBtn, styles.modalBtnCancel]}
                  >
                    <Text style={styles.modalBtnText}>{t('cancel') || 'Cancel'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmDelete}
                    style={[styles.modalBtn, { backgroundColor: COLORS.danger }]}
                  >
                    <Text style={[styles.modalBtnText, { color: COLORS.white }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING[4] },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING[3],
    alignSelf: 'flex-start',
    paddingVertical: SPACING[1],
    paddingRight: SPACING[2],
  },
  backChevron: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xl,
    color: COLORS.primary,
    marginRight: 4,
  },
  backText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
  },
  card: { padding: SPACING[4], marginBottom: SPACING[4] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING[2],
  },
  rowLabel: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  rowValue: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING[2],
  },
  linkText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
  },
  linkChevron: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xl,
    color: COLORS.textMuted,
  },
  dangerCard: {
    borderColor: COLORS.danger,
    borderWidth: 1,
  },
  dangerTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.danger,
    marginBottom: SPACING[2],
  },
  dangerBody: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING[4],
    lineHeight: 20,
  },
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
});