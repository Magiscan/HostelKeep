// src/screens/manager/AccountScreen.web.js
//
// The web equivalent of the mobile AccountScreen. Until now the desktop app had
// no account area at all: the hostel code was only visible on the one-time
// screen shown just after sign-up, and there was no way to delete anything.
//
// TWO DESTRUCTIVE ACTIONS, deliberately separate:
//
//   Delete this hostel  — wipes one property and keeps the account. Only shown
//                         to an owner with more than one hostel. The last
//                         hostel cannot be deleted on its own: a manager
//                         profile pointing at no hostel can neither read nor
//                         write anything and has no route back, so that case is
//                         account deletion wearing a different label.
//
//   Delete account      — the store-required flow. For an owner this takes
//                         every hostel with it.
//
// Staff and cleaners only ever see the second one, and it only removes them.
import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import {
  Drawer, FieldLabel, ConfirmDialog, drawerStyles as d,
} from '../../components/Dashboard/Drawer.web';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { deleteOwnAccount, deleteHostel } from '../../utils/accountDeletion';
import { canDo, isOwner } from '../../utils/permissions';

const PRIVACY_URLS = {
  en: 'https://hostelkeep.com/privacy',
  it: 'https://hostelkeep.com/it/privacy',
  es: 'https://hostelkeep.com/es/privacy',
};
const MIN_PASSWORD = 8;
const DANGER = '#B91C1C';

function InfoRow({ label, value, mono, action }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.infoValueMono]} numberOfLines={1}>
        {value}
      </Text>
      {action}
    </View>
  );
}

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const {
    user, logout, changeOwnPassword, switchHostel,
  } = useAuth();
  const { hostel, updateHostel, roles, subscription } = useApp();

  const privacyUrl = PRIVACY_URLS[(i18n.language || 'en').slice(0, 2)] || PRIVACY_URLS.en;

  const owner = isOwner(user);
  const canRename = canDo(user, roles, 'editRooms') && subscription.active;
  const hostelCodes = user?.hostelCodes || [];
  const canDeleteHostelOnly = owner && hostelCodes.length > 1;

  const [copied, setCopied] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  const [showRename, setShowRename] = useState(false);
  const [hostelName, setHostelName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [renameError, setRenameError] = useState('');

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [confirmHostelDelete, setConfirmHostelDelete] = useState(false);
  const [hostelDeleting, setHostelDeleting] = useState(false);

  const roleLabel = useMemo(() => {
    if (owner) return t('roleOwner');
    if (user?.role === 'staff') return roles?.[user.roleId]?.name || t('roleNoRole');
    return t('roleHousekeeper');
  }, [owner, user, roles, t]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(user?.hostelCode || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is blocked in some embedded contexts. The code is selectable
      // on screen either way, so this failing is not worth an error message.
    }
  };

  const handleChangePassword = async () => {
    setSavingPassword(true);
    setPasswordMsg('');
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setShowPassword(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (e) {
      setPasswordMsg(e.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRename = async () => {
    const name = hostelName.trim();
    if (!name) return;
    setSavingName(true);
    setRenameError('');
    try {
      await updateHostel({ name });
      setShowRename(false);
    } catch (e) {
      setRenameError(e.message);
    } finally {
      setSavingName(false);
    }
  };

  const handleDeleteHostel = async () => {
    setConfirmHostelDelete(false);
    setHostelDeleting(true);
    setProgress('Starting…');
    setDeleteError('');
    try {
      await deleteHostel(user, user.hostelCode, switchHostel, setProgress);
      setProgress('');
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setHostelDeleting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    setProgress('Verifying…');
    try {
      await deleteOwnAccount(user, deletePassword, setProgress);
      // The auth listener in AuthContext handles navigation once the user is
      // gone. Nothing to do here.
    } catch (e) {
      setDeleting(false);
      setProgress('');
      setDeleteError(e.message);
    }
  };

  const initials = (user?.username || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>

        {/* ── Identity ── */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{user?.username}</Text>
            <Text style={styles.role} numberOfLines={1}>
              {roleLabel}{hostel?.name ? ` · ${hostel.name}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.signOutBtn} activeOpacity={0.8}>
            <Icon name="logout" size={19} color="#FFFFFF" />
            <Text style={styles.signOutText}>{t('signOut') || 'Sign out'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.split}>
          {/* ── Details ── */}
          <View style={styles.panel}>
           <Text style={d.overline}>{t('account')}</Text>
            <View style={styles.card}>
              <InfoRow label={t('username') || 'Name'} value={user?.username} />
              <InfoRow label={t('email')} value={user?.email} />
              <InfoRow
                label={t('hostelCode') || 'Hostel code'}
                value={user?.hostelCode}
                mono
                action={(
                  <TouchableOpacity
                    onPress={copyCode}
                    style={styles.copyBtn}
                    activeOpacity={0.7}
                    accessibilityLabel={t('copyHostelCode')}
                  >
                    <Icon
                      name={copied ? 'check' : 'content_copy'}
                      size={17}
                      color={copied ? BRAND.navy : NEUTRAL.text3}
                    />
                    <Text style={styles.copyBtnText}>{copied ? t('copied') : t('copy')}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
            <Text style={styles.hint}>{t('hostelCodeSignInHint')}</Text>
          </View>

          {/* ── Settings ── */}
          <View style={styles.panel}>
            <Text style={d.overline}>{t('settings')}</Text>
            <View style={{ gap: 8 }}>
              {canRename && (
                <TouchableOpacity
                  onPress={() => {
                    setHostelName(hostel?.name || '');
                    setRenameError('');
                    setShowRename(true);
                  }}
                  style={d.listRow}
                  activeOpacity={0.8}
                >
                  <View style={d.listRowIcon}>
                    <Icon name="edit" size={18} color={NEUTRAL.text2} />
                  </View>
                  <Text style={d.listRowLabel}>{t('hostelNameLabel')}</Text>
                  <Text style={styles.rowValue} numberOfLines={1}>{hostel?.name}</Text>
                  <Icon name="chevron_right" size={19} color={NEUTRAL.text4} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => { setPasswordMsg(''); setShowPassword(true); }}
                style={d.listRow}
                activeOpacity={0.8}
              >
                <View style={d.listRowIcon}>
                  <Icon name="key" size={18} color={NEUTRAL.text2} />
                </View>
                <Text style={d.listRowLabel}>{t('changePassword') || 'Change password'}</Text>
                <Icon name="chevron_right" size={19} color={NEUTRAL.text4} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => Linking.openURL(privacyUrl)}
                style={d.listRow}
                activeOpacity={0.8}
              >
                <View style={d.listRowIcon}>
                  <Icon name="shield_person" size={18} color={NEUTRAL.text2} />
                </View>
                <Text style={d.listRowLabel}>{t('privacyPolicy') || 'Privacy policy'}</Text>
                <Icon name="open_in_new" size={17} color={NEUTRAL.text4} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Danger zone ──
            Last, visually separated, and the only red on the screen — so it
            can't be mistaken for a routine setting. */}
        <Text style={[d.overline, { color: DANGER, marginTop: 8 }]}>{t('dangerZone')}</Text>

        {!!deleteError && (
          <View style={styles.errorBanner}>
            <Icon name="error" size={19} color={DANGER} />
            <Text style={styles.errorBannerText}>{deleteError}</Text>
          </View>
        )}

        <View style={styles.dangerStack}>
          {canDeleteHostelOnly && (
            <View style={styles.dangerCard}>
              <Text style={styles.dangerTitle}>{t('deleteThisHostel')}</Text>
              <Text style={styles.dangerBody}>
                {t('deleteThisHostelBody', {
                  name: hostel?.name || t('noProperty'),
                  count: hostelCodes.length - 1,
                })}
              </Text>
              <TouchableOpacity
                onPress={() => setConfirmHostelDelete(true)}
                disabled={hostelDeleting}
                style={[styles.dangerBtn, hostelDeleting && { opacity: 0.5 }]}
                activeOpacity={0.8}
              >
                {hostelDeleting ? (
                  <>
                    <ActivityIndicator color={DANGER} />
                    <Text style={styles.dangerBtnText}>{progress || t('deletingShort')}</Text>
                  </>
                ) : (
                  <>
                    <Icon name="delete" size={19} color={DANGER} />
                    <Text style={styles.dangerBtnText}>{t('deleteThisHostel')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.dangerCard}>
            <Text style={styles.dangerTitle}>{t('deleteAccountTitle')}</Text>
            <Text style={styles.dangerBody}>
              {owner
                ? t('deleteAccountOwnerBody', { hostelCount: hostelCodes.length })
                : t('deleteAccountStaffBody')}
              {' ' + t('cannotBeUndone')}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setDeletePassword('');
                setDeleteError('');
                setShowDeleteAccount(true);
              }}
              style={styles.dangerBtn}
              activeOpacity={0.8}
            >
              <Icon name="delete_forever" size={19} color={DANGER} />
              <Text style={styles.dangerBtnText}>{t('deleteAccount') || 'Delete account'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ── Rename ── */}
      <Drawer
        visible={showRename}
        onClose={() => setShowRename(false)}
        width={460}
        title={t('hostelNameLabel')}
        subtitle={t('manager.renameHint')}
        footer={(
          <>
            <TouchableOpacity onPress={() => setShowRename(false)} style={d.btnGhost} activeOpacity={0.8}>
              <Text style={d.btnGhostText}>{t('cancel') || 'Cancel'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={handleRename}
              disabled={savingName || !hostelName.trim()}
              style={[d.btnPrimary, (savingName || !hostelName.trim()) && { opacity: 0.5 }]}
              activeOpacity={0.9}
            >
              <Icon name="save" size={20} color={BRAND.yellow} />
              <Text style={d.btnPrimaryText}>{savingName ? t('savingShort') : t('save')}</Text>
            </TouchableOpacity>
          </>
        )}
      >
        <View>
          <FieldLabel>{t('name')}</FieldLabel>
          <TextInput
            value={hostelName}
            onChangeText={setHostelName}
            placeholder="e.g. Sunset Hostel"
            placeholderTextColor={NEUTRAL.text4}
            style={d.textInput}
          />
          {!!renameError && <Text style={styles.errorText}>{renameError}</Text>}
        </View>
      </Drawer>

      {/* ── Change password ── */}
      <Drawer
        visible={showPassword}
        onClose={() => setShowPassword(false)}
        width={460}
        title={t('changePassword') || 'Change password'}
        footer={(
          <>
            <TouchableOpacity onPress={() => setShowPassword(false)} style={d.btnGhost} activeOpacity={0.8}>
              <Text style={d.btnGhostText}>{t('cancel') || 'Cancel'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={handleChangePassword}
              disabled={savingPassword || !currentPassword || newPassword.length < MIN_PASSWORD}
              style={[
                d.btnPrimary,
                (savingPassword || !currentPassword || newPassword.length < MIN_PASSWORD)
                  && { opacity: 0.5 },
              ]}
              activeOpacity={0.9}
            >
              <Icon name="save" size={20} color={BRAND.yellow} />
              <Text style={d.btnPrimaryText}>{savingPassword ? t('savingShort') : t('save')}</Text>
            </TouchableOpacity>
          </>
        )}
      >
        <View>
          <FieldLabel>{t('currentPassword')}</FieldLabel>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            placeholderTextColor={NEUTRAL.text4}
            secureTextEntry
            style={d.textInput}
          />
        </View>
        <View>
          <FieldLabel>{t('newPassword')}</FieldLabel>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            placeholderTextColor={NEUTRAL.text4}
            secureTextEntry
            style={d.textInput}
          />
          <Text style={styles.hint}>{t('passwordMinChars', { min: MIN_PASSWORD })}</Text>
          {!!passwordMsg && <Text style={styles.errorText}>{passwordMsg}</Text>}
        </View>
      </Drawer>

      {/* ── Delete account ── */}
      <Drawer
        visible={showDeleteAccount}
        onClose={() => !deleting && setShowDeleteAccount(false)}
        width={460}
        title={owner ? t('deleteHostelAndAccountTitle') : t('deleteAccountTitle')}
        subtitle={owner ? t('deleteEverythingWarning') : t('deletePersonalDataWarning')}
        footer={deleting ? null : (
          <>
            <TouchableOpacity
              onPress={() => setShowDeleteAccount(false)}
              style={d.btnGhost}
              activeOpacity={0.8}
            >
              <Text style={d.btnGhostText}>{t('cancel') || 'Cancel'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={handleDeleteAccount}
              disabled={!deletePassword}
              style={[
                d.btnPrimary,
                { backgroundColor: DANGER },
                !deletePassword && { opacity: 0.5 },
              ]}
              activeOpacity={0.9}
            >
              <Text style={d.btnPrimaryText}>{t('delete') || 'Delete'}</Text>
            </TouchableOpacity>
          </>
        )}
      >
        {deleting ? (
          <View style={styles.deletingBox}>
            <ActivityIndicator size="large" color={BRAND.navy} />
            <Text style={styles.hint}>{progress || t('deletingShort')}</Text>
            <Text style={styles.hint}>{t('keepThisTabOpen')}</Text>
          </View>
        ) : (
          <View>
            <FieldLabel>{t('confirmWithPassword')}</FieldLabel>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="••••••••"
              placeholderTextColor={NEUTRAL.text4}
              secureTextEntry
              style={d.textInput}
            />
            {!!deleteError && <Text style={styles.errorText}>{deleteError}</Text>}
          </View>
        )}
      </Drawer>

      <ConfirmDialog
        visible={confirmHostelDelete}
        title={t('confirmHostelDeleteTitle', { name: hostel?.name || t('noProperty') })}
        message={t('confirmHostelDeleteBody')}
        confirmLabel={t('deleteHostelAction')}
        onConfirm={handleDeleteHostel}
        onCancel={() => setConfirmHostelDelete(false)}
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

  identityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: BRAND.navy, borderRadius: 22, padding: 20,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 999, flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2, borderColor: BRAND.yellow,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 21, color: BRAND.yellow,
  },
  name: { fontFamily: FONTS.display, fontWeight: '600', fontSize: 21, color: '#FFFFFF' },
  role: { marginTop: 2, fontFamily: FONTS.regular, fontSize: 13.5, color: '#A9BCD5' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0,
    height: 42, paddingHorizontal: 16, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  signOutText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 14, color: '#FFFFFF',
  },

  split: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' },
  panel: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 320 },

  card: {
    borderRadius: 20, paddingHorizontal: 16,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56,
    borderBottomWidth: 1, borderBottomColor: '#EEF2F7',
  },
  infoLabel: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14, color: NEUTRAL.text3,
  },
  infoValue: {
    flexShrink: 1, maxWidth: '55%',
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14.5, color: NEUTRAL.text,
  },
  infoValueMono: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 18,
    letterSpacing: 2, color: BRAND.navy,
  },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0,
    height: 32, paddingHorizontal: 11, borderRadius: 10,
    borderWidth: 1, borderColor: NEUTRAL.border,
  },
  copyBtnText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13, color: NEUTRAL.text2,
  },
  rowValue: {
    flexShrink: 1, maxWidth: '45%',
    fontFamily: FONTS.regular, fontSize: 13.5, color: NEUTRAL.text3,
  },

  hint: {
    marginTop: 10,
    fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: NEUTRAL.text3,
  },
  errorText: { marginTop: 8, fontFamily: FONTS.medium, fontSize: 13, color: DANGER },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  errorBannerText: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontSize: 13.5, lineHeight: 19, color: DANGER,
  },

  dangerStack: { gap: 14 },
  dangerCard: {
    padding: 20, borderRadius: 22,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: NEUTRAL.surface,
  },
  dangerTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 16, color: NEUTRAL.text,
  },
  dangerBody: {
    marginTop: 6, marginBottom: 16, maxWidth: 720,
    fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: NEUTRAL.text2,
  },
  dangerBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    height: 48, paddingHorizontal: 20, borderRadius: 15,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  dangerBtnText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 14.5, color: DANGER,
  },

  deletingBox: { alignItems: 'center', gap: 12, paddingVertical: 30 },
});