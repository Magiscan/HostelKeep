import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView, Platform,
} from 'react-native';
import DashboardScreen from './DashboardScreen.web';
import SetupScreen from './SetupScreen';
import TeamScreen from './TeamScreen';
import AssignScreen from './AssignScreen';
import Sidebar from '../../components/Dashboard/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useApp } from '../../contexts/AppContext';
import Icon from '../../components/Icon';
import { COLORS, FONTS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '../../theme';
import ExtraRequestsScreen from './ExtraRequestsScreen.web';
import ReportsScreen from './ReportsScreen.web';
import HistoryScreen from './HistoryScreen.web';

export default function ManagerLayout() {
  const [tab, setTab] = useState('dashboard');
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

  const handleNavigate = (key) => {
    setTab(key);
    if (key === 'notifications') {
      setShowNotifications(true);
    }
  };

  const renderScreen = () => {
    const dashboardProps = {
      highlightRoomId,
      onRoomOpened: () => setHighlightRoomId(null),
      onNavigate: handleNavigate,
    };

    switch (tab) {
      case 'dashboard':
        return <DashboardScreen {...dashboardProps} />;
      case 'rooms':
        return <SetupScreen />;
      case 'assign':
        return <AssignScreen />;
      case 'team':
        return <TeamScreen />;
      case 'extraRequests':
        return <ExtraRequestsScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'history':
        return <HistoryScreen />;
      default:
        return <DashboardScreen {...dashboardProps} />;
    }
  };

  return (
    <View style={styles.container}>
      <Sidebar
        activeRoute={tab}
        onNavigate={handleNavigate}
        badges={{
          notifications: unreadCount,
          extraRequests: extraRequests.filter(
            (r) => r.status === 'pending' || !r.status
          ).length,
        }}
        user={{ name: user.username, role: user.role }}
        onSignOut={logout}
      />

      <View style={styles.main}>{renderScreen()}</View>

      {/* ── Notification Modal ── */}
      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowNotifications(false)}
        >
          <View style={styles.notifCard}>
            <View style={styles.notifHeaderRow}>
              <Text style={styles.menuTitle}>Notifications</Text>
              <View style={{ flexDirection: 'row', gap: SPACING[2] }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={clearAll}>
                    <Text
                      style={{
                        fontFamily: FONTS.medium,
                        fontSize: FONT_SIZE.sm,
                        color: COLORS.primary,
                      }}
                    >
                      Mark all read
                    </Text>
                  </TouchableOpacity>
                )}
                {notifications.length > 0 && (
                  <TouchableOpacity onPress={deleteAllNotifications}>
                    <Text
                      style={{
                        fontFamily: FONTS.medium,
                        fontSize: FONT_SIZE.sm,
                        color: COLORS.danger,
                      }}
                    >
                      Delete all
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {notifications.length === 0 ? (
                <Text
                  style={{
                    fontFamily: FONTS.regular,
                    fontSize: FONT_SIZE.sm,
                    color: COLORS.textSecondary,
                    textAlign: 'center',
                    marginTop: 20,
                  }}
                >
                  No notifications yet.
                </Text>
              ) : (
                notifications.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.notifItem,
                      item.read && { opacity: 0.6 },
                    ]}
                    onPress={() => {
                      markAsRead(item.id);
                      setShowNotifications(false);
                      setTab('dashboard');
                      setHighlightRoomId(item.roomId);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.notifMessage,
                          item.read && { color: COLORS.textMuted },
                        ]}
                      >
                        {item.message}
                      </Text>
                      <Text style={styles.notifTime}>
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    {!item.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowNotifications(false)}
              style={{
                marginTop: SPACING[3],
                alignSelf: 'center',
                padding: SPACING[2],
              }}
            >
              <Text
                style={{
                  fontFamily: FONTS.medium,
                  fontSize: FONT_SIZE.md,
                  color: COLORS.primary,
                }}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    height: '100vh',
  },
  main: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    width: 400,
    maxHeight: 500,
    ...SHADOW.md,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[3],
  },
  menuTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING[2],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  notifMessage: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    flex: 1,
  },
  notifTime: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING[2],
  },
});