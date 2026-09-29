// src/screens/AccountScreen.js
//
// Account settings, including the in-app deletion flow required by App Store
// Review Guideline 5.1.1(v) and Google Play.
//
// STRUCTURE: this renders as one of the manager's tab screens, underneath the
// floating chrome — same as Rooms and Team. It no longer needs a back button,
// because the toolbar is always on screen. `bottomPad` keeps the last card
// clear of it.
//
// Reviewers look for account deletion to be easy to find; from the avatar menu
// it's two taps, which is what they expect.
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Linking, AppState, Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import BottomSheet from '../components/BottomSheet';
import { COLORS } from '../theme/colors';
import { FONTS, DISPLAY } from '../theme/typography';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { deleteOwnAccount } from '../utils/accountDeletion';

// Must point at your live policy — App Review checks that the in-app link and
// the App Store Connect metadata field resolve to the same page.
const PRIVACY_URLS = {
  en: 'https://app.hostelkeep.com/privacy',
  it: 'https://app.hostelkeep.com/privacy',
  es: 'https://app.hostelkeep.com/privacy',
};

const MIN_PASSWORD = 8;

/* ── A labelled read-only row ───────────────────────────────────── */
function InfoRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, mono && s.infoValueMono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/* ── A tappable settings row ────────────────────────────────────── */
function ActionRow({ icon, label, value, onPress, danger, iconBg }) {
  return (
    <TouchableOpacity
      style={s.actionRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={[s.actionIcon, iconBg && { backgroundColor: iconBg }]}>
        <Icon name={icon} size={20} color={danger ? COLORS.danger : COLORS.primary} />
      </View>
      <Text style={[s.actionLabel, danger && { color: COLORS.danger }]} numberOfLines={1}>
        {label}
      </Text>
      {!!value && <Text style={s.actionValue} numberOfLines={1}>{value}</Text>}
      <Icon name="chevron_right" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

/* ── Labelled input, matching every other form in the app ───────── */
function Field({ label, value, onChangeText, placeholder, secure, autoCapitalize = 'none' }) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secure && !reveal}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[s.input, focused && { borderColor: COLORS.accent }, secure && { paddingRight: 48 }]}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setReveal(v => !v)}
            style={s.eyeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name={reveal ? 'visibility_off' : 'visibility'} size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function AccountScreen({ bottomPad = 0 }) {
  const { t, i18n } = useTranslation();
  const { user, logout, changeOwnPassword } = useAuth();
  const { hostel, updateHostel } = useApp();

  const isManager = user?.role === 'manager';

  const privacyUrl = PRIVACY_URLS[(i18n.language || 'en').slice(0, 2)] || PRIVACY_URLS.en;

  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [showRename, setShowRename] = useState(false);
  const [hostelName, setHostelName] = useState(hostel?.name || '');
  const [savingName, setSavingName] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState('');

  // Permission state for the "Notifications are off" row. Null means we
  // haven't checked yet (or we're on web, where the row never renders).
  const [notifStatus, setNotifStatus] = useState(null);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const check = () => Notifications.getPermissionsAsync()
      .then((p) => setNotifStatus(p.status))
      .catch(() => {});
    check();
    // Re-check when they come back from Android settings. iOS re-prompts
    // are impossible after the first dismissal, so this matters most on
    // Android — but the listener is harmless on iOS and keeps the two
    // platforms symmetrical.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || newPassword.length < MIN_PASSWORD) {
      Alert.alert(t('passwordTooShort') || `Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setSavingPassword(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setShowPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert(t('passwordResetSuccess') || 'Password updated.');
    } catch (e) {
      Alert.alert(e.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRename = async () => {
    const name = hostelName.trim();
    if (!name) return;
    setSavingName(true);
    try {
      await updateHostel({ name });
      setShowRename(false);
    } catch (e) {
      Alert.alert(t('error') || 'Error', e.message);
    } finally {
      setSavingName(false);
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

  const initials = (user?.username || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Identity ── */}
        <View style={s.identityCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>{user?.username}</Text>
            <Text style={s.role} numberOfLines={1}>
              {isManager ? (t('manager.role') || 'Manager') : (t('cleaner') || 'Housekeeper')}
              {hostel?.name ? ` · ${hostel.name}` : ''}
            </Text>
          </View>
        </View>

        {/* ── Details ── */}
        <Text style={s.sectionLabel}>{t('account') || 'Account'}</Text>
        <View style={s.card}>
          <InfoRow label={t('username') || 'Username'} value={user?.username} />
          <InfoRow label={t('hostelCode') || 'Hostel code'} value={user?.hostelCode} mono />
          <InfoRow label={t('recoveryEmail') || 'Recovery email'} value={user?.recoveryEmail} />
        </View>

        {/* ── Settings ── */}
        <Text style={s.sectionLabel}>{t('settings') || 'Settings'}</Text>
        <View style={s.card}>
          {isManager && (
            <ActionRow
              icon="edit"
              label={t('manager.editPropertyName') || 'Hostel name'}
              value={hostel?.name}
              onPress={() => { setHostelName(hostel?.name || ''); setShowRename(true); }}
            />
          )}
          <ActionRow
            icon="key"
            label={t('changePassword') || 'Change password'}
            onPress={() => setShowPassword(true )}
          />
          {notifStatus && notifStatus !== 'granted' && (
            <ActionRow
              icon="notifications_off"
              label={t('notificationsOff', 'Notifications are off')}
              value={t('openSettings', 'Open settings')}
              onPress={() => Linking.openSettings()}
            />
          )}
          <ActionRow
            icon="shield_person"
            label={t('privacyPolicy') || 'Privacy Policy'}
            onPress={() => Linking.openURL(privacyUrl)}
          />
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity onPress={logout} style={s.signOutBtn} activeOpacity={0.8}>
          <Icon name="logout" size={21} color={COLORS.primary} />
          <Text style={s.signOutText}>{t('signOut') || 'Sign out'}</Text>
        </TouchableOpacity>

        {/* ── Danger zone ──
            Deliberately last, visually separated, and the only red on the
            screen — so it can't be mistaken for a routine setting. */}
        <Text style={[s.sectionLabel, { color: COLORS.danger }]}>
          {t('dangerZone') || 'Danger zone'}
        </Text>
        <View style={[s.card, s.dangerCard]}>
          <Text style={s.dangerBody}>
            {isManager
              ? 'Permanently deletes your hostel, all of its rooms and cleaning '
                + 'history, and every cleaner account in it.'
              : 'Permanently deletes your account and all of your personal data.'}
            {' This cannot be undone.'}
          </Text>
          <TouchableOpacity
            onPress={() => setShowDelete(true)}
            style={s.dangerBtn}
            activeOpacity={0.8}
          >
            <Icon name="delete" size={20} color={COLORS.danger} />
            <Text style={s.dangerBtnText}>{t('deleteAccount') || 'Delete account'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Rename hostel ── */}
      <BottomSheet
        visible={showRename}
        onClose={() => setShowRename(false)}
        maxHeightRatio={0.55}
      >
        <Text style={s.sheetTitle}>{t('manager.editPropertyName') || 'Hostel name'}</Text>
        <Text style={s.sheetSub}>
          {t('manager.renameHint')
            || 'This is what your housekeepers see when they sign in.'}
        </Text>
        <Field
          label={t('propertyName') || 'Name'}
          value={hostelName}
          onChangeText={setHostelName}
          placeholder={t('setup.propertyNamePlaceholder') || 'e.g. Sunset Hostel'}
          autoCapitalize="words"
        />
        <View style={s.sheetActions}>
          <TouchableOpacity
            onPress={() => setShowRename(false)}
            style={[s.halfBtn, s.halfBtnGhost]}
            activeOpacity={0.8}
          >
            <Text style={s.halfBtnGhostText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRename}
            disabled={savingName || !hostelName.trim()}
            style={[s.halfBtn, s.halfBtnPrimary, (savingName || !hostelName.trim()) && s.halfBtnDisabled]}
            activeOpacity={0.85}
          >
            {savingName
              ? <ActivityIndicator color={COLORS.onPrimary} />
              : <Text style={s.halfBtnText}>{t('save')}</Text>}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Change password ── */}
      <BottomSheet
        visible={showPassword}
        onClose={() => setShowPassword(false)}
        maxHeightRatio={0.7}
        scrollable
      >
        <Text style={s.sheetTitle}>{t('changePassword') || 'Change password'}</Text>
        <View style={{ gap: 12 }}>
          <Field
            label={t('currentPassword') || 'Current password'}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            secure
          />
          <Field
            label={t('newPassword') || 'New password'}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            secure
          />
          <Text style={s.hint}>
            {t('passwordHint') || `At least ${MIN_PASSWORD} characters.`}
          </Text>
        </View>
        <View style={s.sheetActions}>
          <TouchableOpacity
            onPress={() => setShowPassword(false)}
            style={[s.halfBtn, s.halfBtnGhost]}
            activeOpacity={0.8}
          >
            <Text style={s.halfBtnGhostText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={savingPassword || !currentPassword || newPassword.length < MIN_PASSWORD}
            style={[
              s.halfBtn, s.halfBtnPrimary,
              (savingPassword || !currentPassword || newPassword.length < MIN_PASSWORD) && s.halfBtnDisabled,
            ]}
            activeOpacity={0.85}
          >
            {savingPassword
              ? <ActivityIndicator color={COLORS.onPrimary} />
              : <Text style={s.halfBtnText}>{t('save')}</Text>}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Delete account ── */}
      <BottomSheet
        visible={showDelete}
        onClose={() => !deleting && setShowDelete(false)}
        maxHeightRatio={0.7}
        scrollable
      >
        {deleting ? (
          <View style={s.deletingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={s.hint}>{progress || 'Deleting…'}</Text>
          </View>
        ) : (
          <>
            <Text style={s.sheetTitle}>
              {isManager ? 'Delete hostel and account' : 'Delete account'}
            </Text>
            <Text style={s.sheetSub}>
              {isManager
                ? 'Your hostel, every room, all cleaning history and every cleaner '
                  + 'account will be removed. This is permanent.'
                : 'Your account and all of your personal data will be removed. '
                  + 'This is permanent.'}
            </Text>
            <Field
              label={t('password') || 'Password'}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="••••••••"
              secure
            />
            <View style={s.sheetActions}>
              <TouchableOpacity
                onPress={() => { setShowDelete(false); setDeletePassword(''); }}
                style={[s.halfBtn, s.halfBtnGhost]}
                activeOpacity={0.8}
              >
                <Text style={s.halfBtnGhostText}>{t('cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                disabled={!deletePassword}
                style={[s.halfBtn, { backgroundColor: COLORS.danger }, !deletePassword && s.halfBtnDisabled]}
                activeOpacity={0.85}
              >
                <Text style={s.halfBtnText}>{t('delete') || 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 8 },

  identityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 20, padding: 18,
    marginBottom: 8,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2, borderColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: DISPLAY.semiBold, fontSize: 22, color: COLORS.accent },
  name: { fontFamily: DISPLAY.semiBold, fontSize: 22, color: '#FFFFFF' },
  role: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.onNavyMuted, marginTop: 2 },

  sectionLabel: {
    fontFamily: FONTS.semiBold, fontSize: 13,
    letterSpacing: 1, textTransform: 'uppercase',
    color: COLORS.textTertiary,
    marginTop: 20, marginBottom: 8,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16,
  },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 52,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoLabel: { flex: 1, fontFamily: FONTS.medium, fontSize: 15, color: COLORS.textTertiary },
  infoValue: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.text, maxWidth: '55%' },
  infoValueMono: { fontFamily: DISPLAY.semiBold, fontSize: 17, letterSpacing: 2, color: COLORS.primary },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 60,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  actionIcon: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { flex: 1, fontFamily: FONTS.medium, fontSize: 16, color: COLORS.text },
  actionValue: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textTertiary, maxWidth: '40%' },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    minHeight: 54, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    marginTop: 20,
  },
  signOutText: { fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.primary },

  dangerCard: { borderColor: COLORS.dangerBorder, paddingVertical: 16 },
  dangerBody: {
    fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20,
    color: COLORS.textSecondary, marginBottom: 14,
  },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 52, borderRadius: 16,
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1.5, borderColor: COLORS.dangerBorder,
  },
  dangerBtnText: { fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.danger },

  /* Sheets */
  sheetTitle: { fontFamily: DISPLAY.semiBold, fontSize: 25, color: COLORS.primary, marginBottom: 2 },
  sheetSub: {
    fontFamily: FONTS.regular, fontSize: 15, lineHeight: 21,
    color: COLORS.textSecondary, marginBottom: 10,
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },

  fieldLabel: { fontFamily: FONTS.medium, fontSize: 15, color: '#334155' },
  input: {
    height: 52, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 14,
    fontFamily: FONTS.medium, fontSize: 17, color: COLORS.text,
  },
  eyeBtn: {
    position: 'absolute', right: 6,
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },

  deletingBox: { alignItems: 'center', gap: 14, paddingVertical: 32 },

  halfBtn: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  halfBtnGhost: { backgroundColor: COLORS.surfaceMuted },
  halfBtnGhostText: { fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.text },
  halfBtnPrimary: { backgroundColor: COLORS.primary },
  halfBtnDisabled: { backgroundColor: COLORS.disabledBg },
  halfBtnText: { fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.onPrimary },
});