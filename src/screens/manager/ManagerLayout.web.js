// src/screens/manager/ManagerLayout.web.js
//
// REDESIGN — the desktop shell from the KohCiao handoff prototype.
//
// Changes from the previous version:
//   • A PageHeader sits above the active screen, carrying that section's title
//     and subtitle (copy lifted verbatim from the prototype's TITLES map).
//   • The notification Modal is now an anchored glass dropdown at top-right,
//     not a centered dialog. It's still a Modal underneath so it escapes any
//     ancestor stacking context — only the positioning changed.
//   • 'notifications' is no longer a nav route. handleNavigate still accepts
//     it, because DashboardScreen's own header may still emit it, but the
//     sidebar doesn't offer it any more.
//
// ownsHeader — the migration seam:
// every screen currently renders its own toolbar with its own <Text
// styles.title>. Showing PageHeader on top of that gives you the title twice.
// So each section declares whether it still owns its heading. Screens marked
// true keep their toolbar and PageHeader stays hidden; as each screen is
// redesigned and its title block deleted, flip the flag to false and the
// header takes over. Nothing has to move in lockstep.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView, Platform,
} from 'react-native';
import DashboardScreen from './DashboardScreen.web';
import SetupScreen from './SetupScreen';
import TeamScreen from './TeamScreen';
import AssignScreen from './AssignScreen';
import Sidebar from '../../components/Dashboard/Sidebar';
import PageHeader from '../../components/Dashboard/PageHeader.web';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useApp } from '../../contexts/AppContext';
import Icon from '../../components/Icon';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL, STATUS, GLASS } from '../../theme/tokens';
import ExtraRequestsScreen from './ExtraRequestsScreen.web';
import ReportsScreen from './ReportsScreen.web';
import HistoryScreen from './HistoryScreen.web';
import RolesScreen from './RolesScreen.web';
import AccountScreen from './AccountScreen.web';
import { isOwner as ownerOf } from '../../utils/permissions';
import { SubscriptionGate, SubscriptionBanner } from './PaywallScreen.web';

/* Section metadata. Titles and subtitles are the prototype's, unchanged. */
const buildSections = (t) => ({
  dashboard: {
    title: t('secDashboardTitle'),
    subtitle: t('secDashboardSub'),
    ownsHeader: false,
  },
  rooms: {
    title: t('secRoomsTitle'),
    subtitle: t('secRoomsSub'),
    ownsHeader: false,
  },
  assign: {
    title: t('secAssignTitle'),
    subtitle: t('secAssignSub'),
    ownsHeader: false,
  },
  team: {
    title: t('secTeamTitle'),
    subtitle: t('secTeamSub'),
    ownsHeader: false,
  },
  extraRequests: {
    title: t('secExtraTitle'),
    subtitle: t('secExtraSub'),
    ownsHeader: false,
  },
  history: {
    title: t('secHistoryTitle'),
    subtitle: t('secHistorySub'),
    ownsHeader: false,
  },
  reports: {
    title: t('secReportsTitle'),
    subtitle: t('secReportsSub'),
    ownsHeader: false,
  },
  roles: {
    title: t('secRolesTitle'),
    subtitle: t('secRolesSub'),
    ownsHeader: false,
  },
  account: {
    title: t('secAccountTitle'),
    subtitle: t('secAccountSub'),
    ownsHeader: false,
  },
});

/* Notification type → icon + chip colours, matching the prototype's panel. */
function notifLook(type) {
  switch (type) {
    case 'room_cleaned':   return { icon: 'verified', ...STATUS.inspected };
    case 'extra_request':  return { icon: 'flag', ...STATUS.dirty };
    case 'issue':          return { icon: 'build', ...STATUS.late };
    default:               return { icon: 'schedule', bg: NEUTRAL.slateChip, text: NEUTRAL.text2 };
  }
}

export default function ManagerLayout() {
  const [tab, setTab] = useState('dashboard');
  const [roomsAction, setRoomsAction] = useState(null);
  const [teamAction, setTeamAction] = useState(null);
  const [dashAction, setDashAction] = useState(null);
  const [historyAction, setHistoryAction] = useState(null);
  const [assignAction, setAssignAction] = useState(null);
  // Persisted collapse preference
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem('hk.navCollapsed') === '1'; } catch { return false; }
  });

  // wrap toggleNav in useCallback
  const toggleNav = useCallback(() => setNavCollapsed(v => {
    const next = !v;
    try { localStorage.setItem('hk.navCollapsed', next ? '1' : '0'); } catch {}
    return next;
  }), []);
  const { t } = useTranslation();
  const SECTIONS = useMemo(() => buildSections(t), [t]);
  const { user, logout, updateProfile } = useAuth();
  const {
    notifications,
    unreadCount,   // no longer used below; harmless to keep
    markAsRead,
    clearAll,
  } = useNotifications();
  const { extraRequests, sections, roles, rolesLoaded, hostelCode } = useApp();
  const owner = ownerOf(user);
  const [rolesAction, setRolesAction] = useState(null);
  const [highlightRoomId, setHighlightRoomId] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // "Clear all" hides notifications from THIS panel only. The documents stay,
  // because Dashboard and Live activities read the same ones.
  const notifTime = (n) => (
    n.timestampMs
    ?? (typeof n.timestamp?.toMillis === 'function' ? n.timestamp.toMillis() : new Date(n.timestamp).getTime())
    ?? 0
  );
  const clearedAt = user?.notificationsClearedAt?.[hostelCode] || 0;
  const panelNotifications = useMemo(
    () => notifications.filter(n => notifTime(n) > clearedAt),
    [notifications, clearedAt],
  );
  const panelUnread = panelNotifications.filter(n => !n.read).length;

  const clearPanel = useCallback(async () => {
    // The newest notification's own time as well as the clock, so a device
    // clock running slow can't leave the latest one behind.
    const newest = Math.max(Date.now(), ...panelNotifications.map(notifTime));
    clearAll();   // mark them read too, so no unread count lingers anywhere else
    try {
      await updateProfile({
        notificationsClearedAt: { ...(user?.notificationsClearedAt || {}), [hostelCode]: newest },
      });
    } catch (e) {
      console.warn('Could not clear notifications:', e.message);
    }
  }, [panelNotifications, clearAll, updateProfile, user?.notificationsClearedAt, hostelCode]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = 'HostelKeep';
    }
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + \
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleNav();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleNav]);

  // Roles can change under a signed-in staff member at any moment. If the
  // active section stops being allowed, move somewhere they can actually be.
  useEffect(() => {
    if (!rolesLoaded || owner) return;
    if (tab === 'account') return;                 // always reachable
    if (tab === 'roles' && !owner) { setTab('account'); return; }
    if (sections && !sections.includes(tab)) {
      setTab(sections[0] || 'account');
    }
  }, [tab, sections, rolesLoaded, owner]);

  const handleNavigate = (key) => {
    if (key === 'notifications') {
      setShowNotifications(true);
      return;
    }
    setTab(key);
  };

  const section = SECTIONS[tab] || SECTIONS.dashboard;

  const renderScreen = () => {
    const dashboardProps = {
      highlightRoomId,
      onRoomOpened: () => setHighlightRoomId(null),
      onNavigate: handleNavigate,
    };

    switch (tab) {
      case 'dashboard':     return <DashboardScreen {...dashboardProps}  onReady={setDashAction} />;
      case 'rooms':         return <SetupScreen onReady={setRoomsAction} />;
      case 'assign':        return <AssignScreen onReady={setAssignAction} />;
      case 'team':          return <TeamScreen onReady={setTeamAction} />;
      case 'extraRequests': return <ExtraRequestsScreen />;
      case 'reports':       return <ReportsScreen />;
      case 'history':       return <HistoryScreen onReady={setHistoryAction} />;
      case 'roles':         return owner ? <RolesScreen onReady={setRolesAction} /> : <AccountScreen />;
      case 'account':       return <AccountScreen />;
      default:              return <DashboardScreen {...dashboardProps} />;
    }
  };

    return (
    <SubscriptionGate>
      <View style={styles.container}>
        <Sidebar
          activeRoute={tab}
          onNavigate={handleNavigate}
          badges={{
            extraRequests: extraRequests.filter(
              (r) => r.status === 'pending' || !r.status
            ).length,
          }}
          user={{ name: user.username, role: owner ? 'Owner' : (roles?.[user.roleId]?.name || user.role) }}
          sections={owner ? null : sections}
          isOwner={owner}
          onSignOut={logout}
          collapsed={navCollapsed}
          onToggleCollapse={toggleNav}
        />

        <View style={styles.main}>
          <SubscriptionBanner />
          {!section.ownsHeader && (
          <PageHeader
            title={section.title}
            subtitle={section.subtitle}
            unreadCount={panelUnread}
            onOpenNotifications={() => setShowNotifications(true)}
            actions={ (tab === 'rooms' && roomsAction) ? [
              roomsAction.openFloors &&
              { key: 'floors', label: t('actionManageFloors'), icon: 'layers', onPress: roomsAction.openFloors },
              roomsAction.openAttrs &&
              { key: 'attrs',  label: t('actionAttributes'),   icon: 'tune',   onPress: roomsAction.openAttrs },
              roomsAction.addRoom &&
              { key: 'add',    label: t('actionAddRoom'),      icon: 'add', variant: 'primary', onPress: roomsAction.addRoom },
            ].filter(Boolean) :
            (tab === 'team' && teamAction) ? [
              teamAction.print &&
              { key: 'print', label: t('actionPrintSheets'),   icon: 'print',      onPress: teamAction.print },
              teamAction.addCleaner &&
              { key: 'add',   label: t('actionAddHousekeeper'), icon: 'person_add', variant: 'primary', onPress: teamAction.addCleaner },
            ].filter(Boolean) : 
            tab === 'history' && historyAction ? [
              { key: 'export', label: t('actionDownloadReport'), icon: 'download',
                variant: 'primary', disabled: !historyAction.canExport,
                onPress: historyAction.exportReport },
            ] : 
            tab === 'dashboard' && dashAction ? [
              dashAction.saveDay && 
              { key: 'save', label: dashAction.saveDaySuccess ? t('actionSaved') : t('actionSaveDay'),
                icon: dashAction.saveDaySuccess ? 'check' : 'save', onPress: dashAction.saveDay },
              dashAction.dailyReport &&
              { key: 'report', label: t('actionDailyReport'), icon: 'download',
                variant: 'primary', onPress: dashAction.dailyReport },
            ].filter(Boolean) : 
            tab === 'assign' && assignAction ? [
              assignAction.print &&
              { key: 'print', label: t('actionPrintSheets'), icon: 'print', variant: 'primary', onPress: assignAction.print },
              assignAction.clearAll &&
              { key: 'clear', label: t('actionClearAll'), icon: 'cancel', variant: 'danger', onPress: assignAction.clearAll },
            ].filter(Boolean) :
            (tab === 'roles' && rolesAction) ? [
              { key: 'saveRoles',
                label: rolesAction.saving ? t('savingShort') : t('saveChanges'),
                icon: 'save',
                variant: 'primary',
                disabled: !rolesAction.dirty || rolesAction.saving,
                onPress: rolesAction.save },
            ] : []}
          />
        )}
        <View style={styles.screen}>{renderScreen()}</View>
      </View>

      {/* ── Notifications — anchored dropdown ──
          Modal + a full-bleed scrim, with the panel absolutely positioned
          under where the header bell sits (top 78, right 28). */}
      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.notifRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowNotifications(false)}
            accessibilityLabel={t('notifCloseA11y')}
          />

          <View style={styles.notifPanel}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>{t('notifPanelTitle')}</Text>
              <View style={styles.notifHeaderActions}>
                {panelUnread > 0 && (
                  <TouchableOpacity onPress={clearAll} activeOpacity={0.7}>
                    <Text style={styles.notifLink}>{t('notifMarkAllRead')}</Text>
                  </TouchableOpacity>
                )}
                {panelNotifications.length > 0 && (
                  <TouchableOpacity onPress={clearPanel} activeOpacity={0.7}>
                    <Text style={[styles.notifLink, { color: NEUTRAL.text3 }]}>{t('notifClearAll')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.notifList} contentContainerStyle={styles.notifListContent}>
              {panelNotifications.length === 0 ? (
                <View style={styles.notifEmpty}>
                  <Icon name="notifications_off" size={28} color={NEUTRAL.text4} />
                  <Text style={styles.notifEmptyText}>{t('notifEmpty')}</Text>
                </View>
              ) : (
                panelNotifications.map((item) => {
                  const look = notifLook(item.type);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.notifItem, item.read && { opacity: 0.6 }]}
                      activeOpacity={0.7}
                      onPress={() => {
                        markAsRead(item.id);
                        setShowNotifications(false);
                        setTab('dashboard');
                        setHighlightRoomId(item.roomId);
                      }}
                    >
                      <View style={[styles.notifIcon, { backgroundColor: look.bg }]}>
                        <Icon name={look.icon} size={17} color={look.text} />
                      </View>
                      <View style={styles.notifBody}>
                        <Text style={styles.notifMessage}>{item.message}</Text>
                        <Text style={styles.notifTime}>
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      {!item.read && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      </View>
    </SubscriptionGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: NEUTRAL.appBg,
  },
  main: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    backgroundColor: NEUTRAL.appBg,
  },
  screen: { flex: 1, minHeight: 0 },

  /* Notifications dropdown */
  notifRoot: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.45)',
  },
  notifPanel: {
    position: 'absolute',
    top: 78,
    right: 28,
    width: 400,
    maxHeight: '70vh',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
    shadowColor: BRAND.navy,
    shadowOpacity: 0.28,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
    ...GLASS.webStyle,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
  },
  notifTitle: {
    fontFamily: FONTS.display,
    fontWeight: '600',
    fontSize: 17,
    color: NEUTRAL.text,
  },
  notifHeaderActions: { flexDirection: 'row', gap: 14 },
  notifLink: {
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
    fontSize: 13.5,
    color: BRAND.navy,
  },

  notifList: { flexGrow: 0 },
  notifListContent: { paddingTop: 6, paddingHorizontal: 20, paddingBottom: 16 },

  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  notifIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifBody: { flex: 1, minWidth: 0 },
  notifMessage: {
    fontFamily: FONTS.medium,
    fontWeight: '500',
    fontSize: 14,
    color: NEUTRAL.text,
  },
  notifTime: {
    marginTop: 3,
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: NEUTRAL.text4,
    fontVariant: ['tabular-nums'],
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: BRAND.yellow,
    marginTop: 6,
    flexShrink: 0,
  },

  notifEmpty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  notifEmptyText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: NEUTRAL.text3,
  },
});