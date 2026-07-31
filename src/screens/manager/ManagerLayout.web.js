import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Pressable, Platform,
} from 'react-native';
import DashboardScreen from './DashboardScreen';      // picks up .web.js automatically
import SetupScreen from './SetupScreen';
import TeamScreen from './TeamScreen';
import AssignScreen from './AssignScreen';
import { COLORS, FONTS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '../../theme';
import Icon from '../../components/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'setup',     label: 'Setup',     icon: 'construct-outline' },
  { key: 'team',      label: 'Team',      icon: 'people-outline' },
  { key: 'assign',    label: 'Assign',    icon: 'swap-horizontal-outline' },
];

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

export default function ManagerLayout() {
  const [tab, setTab] = useState('dashboard');
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, clearAll, deleteAllNotifications } = useNotifications();

  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightRoomId, setHighlightRoomId] = useState(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = 'KeepClean';
    }
  }, []);

  const handleNotificationPress = (item) => {
    markAsRead(item.id);
    setShowNotifications(false);
    setTab('dashboard');
    setHighlightRoomId(item.roomId);
  };

  const renderScreen = () => {
    switch (tab) {
      case 'dashboard':
        return <DashboardScreen highlightRoomId={highlightRoomId} onRoomOpened={() => setHighlightRoomId(null)} />;
      case 'setup':   return <SetupScreen />;
      case 'team':    return <TeamScreen />;
      case 'assign':  return <AssignScreen />;
      default:        return <DashboardScreen />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <Text style={styles.logo}>KeepClean</Text>
        <View style={styles.nav}>
          {NAV_ITEMS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, tab === item.key && styles.navItemActive]}
              onPress={() => setTab(item.key)}
            >
              <Icon name={item.icon} size={20} color={tab === item.key ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.navLabel, tab === item.key && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          {/* Notification bell */}
          <TouchableOpacity style={styles.sidebarBell} onPress={() => setShowNotifications(true)}>
            <Icon name="alarm-outline" size={20} color={COLORS.textSecondary} />
            {unreadCount > 0 && (
              <View style={styles.sidebarBadge}>
                <Text style={styles.sidebarBadgeText}>{unreadCount}</Text>
              </View>
            )}
            <Text style={[styles.navLabel, { marginLeft: SPACING[2] }]}>Notifications</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity onPress={() => setShowLangMenu(true)} style={styles.bottomBtn}>
            <Icon name="globe-outline" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.navLabel, { marginLeft: SPACING[2] }]}>{t('manager.language')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBtn} onPress={logout}>
            <Icon name="log-out-outline" size={18} color={COLORS.danger} />
            <Text style={[styles.navLabel, { marginLeft: SPACING[2], color: COLORS.danger }]}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer inside sidebar ── */}
        <View style={styles.sidebarFooter}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} KeepClean
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS === 'web') {
                window.open('/privacy.html', '_blank');
              }
            }}
          >
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.main}>{renderScreen()}</View>

      {/* Language modal */}
      <Modal visible={showLangMenu} transparent animationType="fade" onRequestClose={() => setShowLangMenu(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLangMenu(false)}>
          <View style={styles.langCard}>
            <Text style={styles.langTitle}>{t('manager.language')}</Text>
            <View style={{ gap: SPACING[2] }}>
              {LANGS.map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langItem, i18n.language === lang.code && styles.langItemActive]}
                  onPress={() => { i18n.changeLanguage(lang.code); setShowLangMenu(false); }}
                >
                  <Text style={[styles.langItemText, i18n.language === lang.code && styles.langItemTextActive]}>
                    {lang.label}
                  </Text>
                  {i18n.language === lang.code && <Icon name="checkmark-circle" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setShowLangMenu(false)} style={styles.langCloseBtn}>
              <Icon name="close-circle-outline" size={18} color={COLORS.danger} style={{ marginRight: SPACING[1] }} />
              <Text style={[styles.langItemText, { color: COLORS.danger }]}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Notification modal */}
      <Modal visible={showNotifications} transparent animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowNotifications(false)}>
          <View style={styles.notifCard}>
            <View style={styles.notifHeaderRow}>
              <Text style={styles.menuTitle}>Notifications</Text>
              <View style={{ flexDirection: 'row', gap: SPACING[2] }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={clearAll}>
                    <Text style={{ fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.primary }}>
                      Mark all read
                    </Text>
                  </TouchableOpacity>
                )}
                {notifications.length > 0 && (
                  <TouchableOpacity onPress={deleteAllNotifications}>
                    <Text style={{ fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.danger }}>
                      Delete all
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {notifications.length === 0 ? (
                <Text style={{ fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', marginTop: 20 }}>
                  No notifications yet.
                </Text>
              ) : (
                notifications.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.notifItem, item.read && { opacity: 0.6 }]}
                    onPress={() => handleNotificationPress(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.notifMessage, item.read && { color: COLORS.textMuted }]}>
                        {item.message}
                      </Text>
                      <Text style={styles.notifTime}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {!item.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowNotifications(false)} style={{ marginTop: SPACING[3], alignSelf: 'center', padding: SPACING[2] }}>
              <Text style={{ fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.primary }}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', height: '100vh' },
  sidebar: {
    width: 220, backgroundColor: COLORS.surface, borderRightWidth: 1,
    borderRightColor: COLORS.border, paddingTop: SPACING[6], paddingHorizontal: SPACING[4],
    justifyContent: 'space-between',
  },
  logo: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.primary, marginBottom: SPACING[6] },
  nav: { flex: 1, gap: SPACING[2] },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    paddingVertical: SPACING[2], paddingHorizontal: SPACING[3], borderRadius: 8,
  },
  navItemActive: { backgroundColor: COLORS.primaryLight },
  navLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, flex: 1 },
  navLabelActive: { color: COLORS.primary, fontFamily: FONTS.bold },
  sidebarBell: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING[2],
    paddingHorizontal: SPACING[3], borderRadius: 8, marginTop: SPACING[2],
  },
  sidebarBadge: {
    backgroundColor: COLORS.danger, borderRadius: 10, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', marginLeft: SPACING[1],
  },
  sidebarBadgeText: { fontFamily: FONTS.bold, fontSize: 10, color: COLORS.white },
  bottomSection: { paddingTop: SPACING[2], borderTopWidth: 1, borderTopColor: COLORS.border },
  bottomBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    paddingVertical: SPACING[2], paddingHorizontal: SPACING[3], borderRadius: 8,
  },
  main: { flex: 1, backgroundColor: COLORS.background },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  langCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING[4], width: 260, ...SHADOW.md },
  langTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: SPACING[3] },
  langItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING[3], paddingHorizontal: SPACING[3], borderRadius: RADIUS.md,
  },
  sidebarFooter: {
    marginTop: SPACING[4],
    paddingTop: SPACING[3],
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING[1],
  },
  footerText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  footerLink: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  langItemActive: { backgroundColor: COLORS.primaryLight },
  langItemText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  langItemTextActive: { color: COLORS.primary, fontFamily: FONTS.bold },
  langCloseBtn: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING[3], alignSelf: 'center' },
  notifCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING[4], width: 400, maxHeight: 500, ...SHADOW.md },
  notifHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[3] },
  menuTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text },
  notifItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING[2], borderBottomWidth: 1, borderBottomColor: COLORS.border },
  notifMessage: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text, flex: 1 },
  notifTime: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: SPACING[2] },
});