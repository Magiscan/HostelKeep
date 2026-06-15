import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DashboardScreen from './DashboardScreen';
import SetupScreen from './SetupScreen';
import TeamScreen from './TeamScreen';
import AssignScreen from './AssignScreen';
import { COLORS, FONTS, FONT_SIZE, SPACING } from '../../theme';
import Icon from '../../components/Icon';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'setup',     label: 'Setup',     icon: 'construct-outline' },
  { key: 'team',      label: 'Team',      icon: 'people-outline' },
  { key: 'assign',    label: 'Assign',    icon: 'swap-horizontal-outline' },
];

export default function ManagerLayout() {
  const [tab, setTab] = useState('dashboard');
  const { logout } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'web') {
        document.title = 'KeepClean';
    }
    }, []);

  const renderScreen = () => {
    switch (tab) {
      case 'dashboard': return <DashboardScreen />;
      case 'setup':     return <SetupScreen />;
      case 'team':      return <TeamScreen />;
      case 'assign':    return <AssignScreen />;
      default:          return <DashboardScreen />;
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
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Icon name="log-out-outline" size={18} color={COLORS.danger} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <View style={styles.main}>{renderScreen()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', height: '100vh' },
  sidebar: {
    width: 220,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingTop: SPACING[6],
    paddingHorizontal: SPACING[4],
    justifyContent: 'space-between',
  },
  logo: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.primary, marginBottom: SPACING[6] },
  nav: { flex: 1, gap: SPACING[2] },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[2],
    paddingVertical: SPACING[2],
    paddingHorizontal: SPACING[3],
    borderRadius: 8,
  },
  navItemActive: { backgroundColor: COLORS.primaryLight },
  navLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, flex: 1 },
  navLabelActive: { color: COLORS.primary, fontFamily: FONTS.bold },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2], paddingVertical: SPACING[3] },
  logoutText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.danger },
  main: { flex: 1, backgroundColor: COLORS.background },
});