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
import React, { useState, useEffect, useCallback } from 'react';
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

/* Section metadata. Titles and subtitles are the prototype's, unchanged. */
const SECTIONS = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Where the shift stands right now.',
    ownsHeader: false,     // still renders <Header> with Save day / Daily report
  },
  rooms: {
    title: 'Rooms',
    subtitle: 'The property structure — floors, rooms and beds.',
    ownsHeader: false,
  },
  assign: {
    title: 'Assign',
    subtitle: 'Set the bed states, then hand the rooms to a housekeeper.',
    ownsHeader: false,
  },
  team: {
    title: 'Team',
    subtitle: 'Who is on shift and how their day is going.',
    ownsHeader: false,
  },
  extraRequests: {
    title: 'Extra room requests',
    subtitle: 'Review and manage housekeeper requests.',
    ownsHeader: false,
  },
  history: {
    title: 'Daily history',
    subtitle: 'Review completed cleaning work and room activity.',
    ownsHeader: false,
  },
  reports: {
    title: 'Live activities',
    subtitle: 'Overview of cleaning performance right now.',
    ownsHeader: false,
  },
  roles: {
    title: 'Roles & access',
    subtitle: 'Create roles and decide what each one can see and do.',
    ownsHeader: false,
  },
};

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
  const { user, logout } = useAuth();
  const {
    notifications,
    unreadCount,
    markAsRead,
    clearAll,
    deleteAllNotifications,
  } = useNotifications();
  const { extraRequests } = useApp();
  const [highlightRoomId, setHighlightRoomId] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

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
      case 'roles':         return <RolesScreen />;
      default:              return <DashboardScreen {...dashboardProps} />;
    }
  };

  return (
    <View style={styles.container}>
      <Sidebar
        activeRoute={tab}
        onNavigate={handleNavigate}
        badges={{
          extraRequests: extraRequests.filter(
            (r) => r.status === 'pending' || !r.status
          ).length,
        }}
        user={{ name: user.username, role: user.role }}
        onSignOut={logout}
        collapsed={navCollapsed}
        onToggleCollapse={toggleNav}
      />

      <View style={styles.main}>
        {!section.ownsHeader && (
          <PageHeader
            title={section.title}
            subtitle={section.subtitle}
            unreadCount={unreadCount}
            onOpenNotifications={() => setShowNotifications(true)}
            actions={ (tab === 'rooms' && roomsAction) ? [
              { key: 'floors', label: 'Manage floors', icon: 'layers', onPress: roomsAction.openFloors },
              { key: 'attrs',  label: 'Attributes',    icon: 'tune',   onPress: roomsAction.openAttrs },
              { key: 'add',    label: 'Add room',      icon: 'add', variant: 'primary', onPress: roomsAction.addRoom },
            ] :
            (tab === 'team' && teamAction) ? [
              { key: 'print', label: 'Print sheets',   icon: 'print',      onPress: teamAction.print },
              { key: 'add',   label: 'Add housekeeper', icon: 'person_add', variant: 'primary', onPress: teamAction.addCleaner },
            ] : 
            tab === 'history' && historyAction ? [
              { key: 'export', label: 'Download report', icon: 'download',
                variant: 'primary', disabled: !historyAction.canExport,
                onPress: historyAction.exportReport },
            ] : 
            tab === 'dashboard' && dashAction ? [
              { key: 'save', label: dashAction.saveDaySuccess ? 'Saved' : 'Save day',
                icon: dashAction.saveDaySuccess ? 'check' : 'save', onPress: dashAction.saveDay },
              { key: 'report', label: 'Daily report', icon: 'download',
                variant: 'primary', onPress: dashAction.dailyReport },
            ] : 
            tab === 'assign' && assignAction ? [
              { key: 'print', label: 'Print sheets', icon: 'print', variant: 'primary', onPress: assignAction.print },
              { key: 'clear', label: 'Clear all', icon: 'cancel', variant: 'danger', onPress: assignAction.clearAll },
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
            accessibilityLabel="Close notifications"
          />

          <View style={styles.notifPanel}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>Notifications</Text>
              <View style={styles.notifHeaderActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={clearAll} activeOpacity={0.7}>
                    <Text style={styles.notifLink}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                {notifications.length > 0 && (
                  <TouchableOpacity onPress={deleteAllNotifications} activeOpacity={0.7}>
                    <Text style={[styles.notifLink, { color: '#B91C1C' }]}>Delete all</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.notifList} contentContainerStyle={styles.notifListContent}>
              {notifications.length === 0 ? (
                <View style={styles.notifEmpty}>
                  <Icon name="notifications_off" size={28} color={NEUTRAL.text4} />
                  <Text style={styles.notifEmptyText}>No notifications yet.</Text>
                </View>
              ) : (
                notifications.map((item) => {
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