import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView,
  TextInput, Platform, Image, KeyboardAvoidingView, 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { usePushRegistration } from '../../hooks/usePushRegistration';
import SetupScreen from './SetupScreen';
import TeamScreen from './TeamScreen';
import AssignScreen from './AssignScreen';
import ExtraRequestsScreen from './ExtraRequestsScreen';
import AccountScreen from '../AccountScreen';
import ReportsScreen from './ReportsScreen';
import { COLORS } from '../../theme/colors';
import { FONTS, DISPLAY, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { RADIUS } from '../../theme/radius';
import { SHADOW } from '../../theme/shadows';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ProSheet, ProfileMenu, SetupSheet } from '../../components/brand/Sheets';
import { ToastHost, useToast } from '../../components/brand';
import { useAvatarPicker } from '../../hooks/useAvatarPicker';
import { AvatarPickerSheet, LanguageSheet } from '../../components/brand/Pickers';
import WelcomeSheet from '../../components/brand/WelcomeSheet';

/**
 * HostelKeep 2.0 manager shell.
 *
 * STRUCTURAL CHANGE from the previous version: the chrome now FLOATS over the
 * content rather than sandwiching it.
 *
 *  • Top bar: wordmark (opens Pro), notifications, avatar — all floating
 *    "glass" pills over the scrolling content.
 *  • Bottom: a floating pill tab bar with the hostel-setup button beside it,
 *    not a full-width docked bar.
 *
 * Because the chrome floats, every child screen must add bottom padding or
 * its last row hides behind the tab bar. That's what CONTENT_BOTTOM_PAD is
 * for — it's passed down so screens don't each guess at the number.
 */

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

// Tab bar height + its bottom offset + breathing room.
export const CONTENT_BOTTOM_PAD = 122;

export default function ManagerApp() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateProfile } = useAuth();
  const { hostel, updateHostel, hostelCode, extraRequests, subscription } = useApp();
  const { notifications, unreadCount, markAsRead, clearAll } =
    useNotifications();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState('assign');
  const [highlightRoomId, setHighlightRoomId] = useState(null);
  const [scrollTopSignal, setScrollTopSignal] = useState(0);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSetupSheet, setShowSetupSheet] = useState(false);
  const [showPro, setShowPro] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [newName, setNewName] = useState(hostel.name || '');
  const [showLang, setShowLang] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const toast = useToast();
  const avatar = useAvatarPicker();

  usePushRegistration(user);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'HostelKeep';
    }
  }, []);

  const safeExtraRequests = Array.isArray(extraRequests) ? extraRequests : [];
  const pendingRequestCount = safeExtraRequests.filter(
    r => r && (r.status === 'pending' || !r.status),
  ).length;

  const pickHostelLogo = () => avatar.open({
    canRemove: !!hostel.logoUri,
    onPicked:  (uri) => updateHostel({ logoUri: uri }),
    onRemove:  ()    => updateHostel({ logoUri: null }),
  });

  const removeHostelLogo = () => updateHostel({ logoUri: null });

  // Manager's own photo → the user document.
  const pickProfilePhoto = () => avatar.open({
    canRemove: !!user.photoUri,
    onPicked:  (uri) => updateProfile({ photoUri: uri }),
    onRemove:  ()    => updateProfile({ photoUri: null }),
  });

  const isPro = !!subscription?.active;

  // If the subscription lapses while Live is open, fall back to Assign.
  useEffect(() => {
    if (tab === 'live' && !isPro) setTab('assign');
  }, [tab, isPro]);

  // Managers only. Cleaners run a different app, and staff are desktop-only.
  useEffect(() => {
    if (user?.role === 'manager' && !user?.tutorialSeenAt) setShowWelcome(true);
  }, [user?.role, user?.tutorialSeenAt]);

  // Tapping a push notification jumps to the room it names. Registered once for
  // the life of the app — no dependency on user or tab, since the callbacks
  // only set state via setters that are already stable.
  //
  // Web has no push to respond to: expo-notifications' response listener is a
  // native-only API, and registering it on web returns a broken subscription.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      if (data.roomId) {
        setTab('assign');
        setHighlightRoomId(data.roomId);
      }
    });
    return () => sub.remove();
  }, []);

  // "Clear all" hides notifications from this panel only — Live activities reads
  // the same documents, so they must stay.
  const notifTime = (n) => n.timestampMs
    ?? (typeof n.timestamp?.toMillis === 'function' ? n.timestamp.toMillis() : new Date(n.timestamp).getTime());
  const clearedAt = user?.notificationsClearedAt?.[hostelCode] || 0;
  const panelNotifications = useMemo(
    () => notifications.filter(n => notifTime(n) > clearedAt),
    [notifications, clearedAt],
  );
  const panelUnread = panelNotifications.filter(n => !n.read).length;

  const clearPanel = async () => {
    const newest = Math.max(Date.now(), ...panelNotifications.map(notifTime));
    clearAll();
    try {
      await updateProfile({
        notificationsClearedAt: { ...(user?.notificationsClearedAt || {}), [hostelCode]: newest },
      });
    } catch (e) {
      console.warn('Could not clear notifications:', e.message);
    }
  };

  // Four primary tabs. Rooms/Setup moved to the hostel button beside the tab
  // bar — it's configuration, not daily workflow, and this keeps the bar from
  // getting crowded at the small pill width.
  const TABS = useMemo(() => [
    { key: 'assign', label: t('manager.tabAssign'), icon: 'swap_horiz' },
    {
      key: 'extraRequests',
      label: t('extraRequestsFooter') || 'Extra',
      icon: 'flag',
      badge: pendingRequestCount,
    },
    { key: 'live', label: t('manager.tabLive') || 'Live', icon: 'monitoring', pro: !isPro },
  ], [t, pendingRequestCount, isPro]);

  const initials = (user.username || '?').trim().charAt(0).toUpperCase();
  const hostelInitials = (hostel.name || 'H')
    .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const saveName = () => {
    if (newName.trim()) updateHostel({ name: newName.trim() });
    setEditVisible(false);
  };

  const renderTab = () => {
    switch (tab) {
      case 'assign':        return <AssignScreen bottomPad={CONTENT_BOTTOM_PAD} scrollTopSignal={scrollTopSignal} />;
      case 'extraRequests': return <ExtraRequestsScreen bottomPad={CONTENT_BOTTOM_PAD} scrollTopSignal={scrollTopSignal} />;
      case 'setup':         return <SetupScreen bottomPad={CONTENT_BOTTOM_PAD} />;
      case 'team':          return <TeamScreen bottomPad={CONTENT_BOTTOM_PAD} />;
      case 'account':       return <AccountScreen bottomPad={CONTENT_BOTTOM_PAD} />;
      case 'live':          return <ReportsScreen bottomPad={CONTENT_BOTTOM_PAD} scrollTopSignal={scrollTopSignal} />;
      default:              return <AssignScreen bottomPad={CONTENT_BOTTOM_PAD} />;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AvatarPickerSheet
        controller={avatar}
        title={t('profilePhoto') || 'Photo'}
        labels={{
          camera:  t('takePhoto')     || 'Take a photo',
          gallery: t('chooseFromGallery') || 'Choose from gallery',
          remove:  t('removePhoto')   || 'Remove photo',
          close:   t('close'),
        }}
      />

      <LanguageSheet
        visible={showLang}
        onClose={() => setShowLang(false)}
        languages={LANGS}
        current={i18n.language}
        onSelect={(code) => i18n.changeLanguage(code)}
        title={t('manager.language')}
      />
      {/* ── Floating top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => setShowPro(true)}
          style={styles.glassPill}
          activeOpacity={0.8}
        >
          <Text style={styles.wordmark}>
            Hostel<Text style={styles.wordmarkAccent}>Keep</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowNotifications(true)}
          style={styles.glassCircle}
          activeOpacity={0.8}
        >
          <Icon name="notifications" size={24} color={COLORS.primary} />
          {panelUnread > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {panelUnread > 99 ? '99+' : panelUnread}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowProfile(true)}
          style={styles.avatarBtn}
          activeOpacity={0.8}
        >
          <View style={styles.avatarInner}>
            {user.photoUri
              ? <Image source={{ uri: user.photoUri }} style={styles.avatarImage} />
              : <Text style={styles.avatarText}>{initials}</Text>}
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Content (scrolls beneath the chrome) ── */}
      <View style={styles.content}>{renderTab()}</View>

      {/* ── Floating tab bar + hostel setup ── */}
      <View style={[styles.tabBarWrap, { bottom: Math.max(insets.bottom, 12) + 18 }]}>
        <View style={styles.tabBar}>
          {TABS.map(item => {
            const active = !item.pro && tab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => {
                  if (item.pro) { setShowPro(true); return; }
                  if (tab === item.key) setScrollTopSignal(n => n + 1);
                  else setTab(item.key);
                }}
                activeOpacity={0.8}
              >
                <View>
                  <Icon
                    name={item.icon}
                    size={23}
                    filled={active}
                    color={active ? COLORS.text : '#8A93A2'}
                  />
                  {!!item.badge && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>
                        {item.badge > 9 ? '9+' : item.badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.tabLabel, active && styles.tabLabelActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => setShowSetupSheet(true)}
          style={styles.hostelBtn}
          activeOpacity={0.85}
          accessibilityLabel={t('manager.tabSetup')}
        >
          <View style={styles.hostelInner}>
            {hostel.logoUri
              ? <Image source={{ uri: hostel.logoUri }} style={styles.hostelLogo} />
              : <Text style={styles.hostelBtnText}>{hostelInitials}</Text>}
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Hostel setup sheet ── */}
      <SetupSheet
        visible={showSetupSheet}
        onClose={() => setShowSetupSheet(false)}
        title={t('manager.setupTitle') || 'Hostel setup'}
        subtitle={t('manager.setupSub')}
        hostelName={hostel.name}
        hostelLogoUri={hostel.logoUri}
        onPickLogo={pickHostelLogo}
        onRemoveLogo={hostel.logoUri ? removeHostelLogo : undefined}
        links={[
          {
            icon: 'bed',
            title: t('rooms'),
            sub: t('manager.roomsSub') || 'Floors, rooms and beds',
            onPress: () => { setShowSetupSheet(false); setTab('setup'); },
          },
          {
            icon: 'group',
            title: t('manager.tabTeam'),
            sub: t('manager.teamSub') || 'Housekeepers and access',
            onPress: () => { setShowSetupSheet(false); setTab('team'); },
          },
        ]}
        proLabel={isPro ? t('manager.proActive', 'HostelKeep Pro · active') : 'HostelKeep Pro'}
        onPro={() => { setShowSetupSheet(false); setShowPro(true); }}
        feedbackLabel={t('manager.feedback') || 'Send feedback'}
        onFeedback={() => Linking.openURL('mailto:kohciaostudio@gmail.com')}
        closeLabel={t('close')}
      />

      {/* ── Edit hostel name ── */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.centerBackdrop} onPress={() => setEditVisible(false)}>
            <Pressable onPress={() => {}} style={styles.dialog}>
              <Text style={styles.sheetTitle}>{t('manager.editPropertyName')}</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder={t('manager.propertyNamePlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
              />
              <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
                <TouchableOpacity
                  onPress={() => setEditVisible(false)}
                  style={[styles.halfBtn, styles.halfBtnGhost]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.halfBtnGhostText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveName}
                  disabled={!newName.trim()}
                  style={[styles.halfBtn, !newName.trim() && { backgroundColor: COLORS.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.halfBtnText, !newName.trim() && { color: COLORS.textMuted }]}>
                    {t('save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Notifications ── */}
      <Modal
        visible={showNotifications}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotifications(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowNotifications(false)}>
          <Pressable onPress={() => {}} style={[styles.sheet, { maxHeight: '80%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeadRow}>
              <Text style={[styles.sheetTitle, { flex: 1 }]}>
                {t('notifications') || 'Notifications'}
              </Text>
              {panelUnread > 0 && (
                <TouchableOpacity onPress={clearAll} activeOpacity={0.7}>
                  <Text style={styles.linkText}>{t('markAllRead') || 'Mark all read'}</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {panelNotifications.length === 0 ? (
                <Text style={styles.emptyHint}>
                  {t('noNotifications') || 'No notifications yet.'}
                </Text>
              ) : (
                panelNotifications.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.notifRow, item.read && { opacity: 0.55 }]}
                    onPress={() => {
                      markAsRead(item.id);
                      setShowNotifications(false);
                      setTab('assign');
                      setHighlightRoomId(item.roomId);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.notifText}>{item.message}</Text>
                      <Text style={styles.notifTime}>
                        {new Date(item.timestampMs ?? item.timestamp)
                          .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {!item.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {panelNotifications.length > 0 && (
              <TouchableOpacity
                onPress={clearPanel}
                style={styles.outlineBtn}
                activeOpacity={0.8}
              >
                <Icon name="visibility_off" size={22} color={COLORS.primary} />
                <Text style={styles.outlineBtnText}>
                  {t('notifClearAll')}
                </Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Profile: language, account, sign out ── */}
      <ProfileMenu
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        name={user.username}
        hostelName={hostel.name}
        photoUri={user.photoUri}
        onChangePhoto={pickProfilePhoto}
        langLabel={(LANGS.find(l => l.code === i18n.language) || LANGS[0]).label}
        onLanguage={() => { setShowProfile(false); setShowLang(true); }}
        // onChangePassword={() => { setShowProfile(false); setShowPassword(true); }}
        onAccount={() => { setShowProfile(false); setTab('account'); }}
        onSignOut={() => { setShowProfile(false); logout(); }}
        labels={{
          language: t('manager.language'),
          changePassword: t('changePassword') || 'Change password',
          account: t('account') || 'Account & privacy',
          signOut: t('signOut'),
        }}
      />

      {/* ── Pro — read-only status. Purchase is arranged off-app. ── */}
      <ProSheet
        visible={showPro}
        onClose={() => setShowPro(false)}
        title={isPro ? t('pro.activeTitle') : t('pro.lockedTitle')}
        subtitle={isPro ? t('pro.activeSub') : t('pro.lockedSub')}
        features={[
          { icon: 'monitoring',      title: t('pro.f1'), sub: t('pro.f1sub') },
          { icon: 'desktop_windows', title: t('pro.f2'), sub: t('pro.f2sub') },
          { icon: 'bar_chart',       title: t('pro.f3'), sub: t('pro.f3sub') },
          { icon: 'shield_person',   title: t('pro.f4'), sub: t('pro.f4sub') },
        ]}
        notifyLabel={isPro ? t('pro.openLive') : undefined}
        onNotify={isPro ? () => { setShowPro(false); setTab('live'); } : undefined}
        note={isPro ? undefined : t('pro.whereToGet')}
        closeLabel={t('close')}
      />

      <WelcomeSheet
        visible={showWelcome}
        hostelCode={hostelCode}
        t={t}
        onDone={() => {
          setShowWelcome(false);
          // Skip counts as seen. Someone who dismissed it has decided; showing
          // it again every launch is a nag. `optimistic` local state means the
          // sheet closes instantly even if the write is slow or fails.
          updateProfile({ tutorialSeenAt: new Date().toISOString() }).catch(() => {});
        }}
      />
      <ToastHost toast={toast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1 },

  /* Sub-header for full-takeover screens */
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderTitle: {
    fontFamily: DISPLAY.semiBold,
    fontSize: FONT_SIZE.xxl,
    color: COLORS.primary,
  },

  /* Floating top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },
  // React Native has no backdrop-filter, so the prototype's frosted glass is
  // approximated with a near-opaque surface + soft shadow. Visually close.
  glassPill: {
    flexShrink: 0,
    marginRight: 'auto',
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    ...SHADOW.md,
  },
  wordmark: {
    fontFamily: DISPLAY.semiBold,
    fontSize: FONT_SIZE.xl,
    color: COLORS.primary,
  },
  wordmarkAccent: { color: COLORS.accent },
  glassCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.md,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.onAccent,
  },
  avatarBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  avatarText: { fontFamily: DISPLAY.semiBold, fontSize: 20, color: COLORS.accent },
  avatarInner: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',          
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',     
  },

  /* Floating tab bar */
  tabBarWrap: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  tabBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 7,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    ...SHADOW.lg,
  },
  tabItem: {
    flex: 1,
    minHeight: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 7,
    paddingHorizontal: 2,
  },
  tabItemActive: { backgroundColor: 'rgba(15,23,42,0.10)' },
  tabLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  tabLabelActive: { color: COLORS.text },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontFamily: FONTS.bold, fontSize: 10, color: COLORS.onAccent },

  hostelBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    padding: 7,
  },
  hostelInner: {
    flex: 1, borderRadius: 28,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',          // ← without this the square image escapes the circle
  },
  hostelLogo: { width: '100%', height: '100%' },
  hostelBtnText: { fontFamily: DISPLAY.semiBold, fontSize: 19, color: COLORS.accent },

  /* Sheets */
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,58,0.45)', justifyContent: 'flex-end' },
  centerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.45)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.xs,
    ...SHADOW.lg,
  },
  dialog: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    gap: SPACING.xs,
    ...SHADOW.lg,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.xs,
  },
  sheetHeadRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  sheetTitle: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.xxl, color: COLORS.primary },
  sheetSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  sheetCloseBtn: {
    height: 52,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  sheetCloseText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.lg, color: COLORS.onPrimary },

  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
  },

  halfBtn: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfBtnGhost: { backgroundColor: COLORS.surfaceMuted },
  halfBtnGhostText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.lg, color: COLORS.primary },
  halfBtnText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.lg, color: COLORS.onPrimary },

  outlineBtn: {
    height: 52,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  outlineBtnText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.lg, color: COLORS.primary },

  linkText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.primary },
  emptyHint: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  notifText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.primary },
  notifTime: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.accent },

});