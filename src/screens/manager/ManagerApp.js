import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONTS, FONT_SIZE, SPACING, SHADOW } from '../../theme';
import { Avatar, Button } from '../../components/UI';
import DashboardScreen from './DashboardScreen';
import SetupScreen from './SetupScreen';
import TeamScreen from './TeamScreen';
import AssignScreen from './AssignScreen';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline', iconActive: 'grid' },
  { key: 'setup',     label: 'Setup',     icon: 'construct-outline', iconActive: 'construct' },
  { key: 'team',      label: 'Team',      icon: 'people-outline', iconActive: 'people' },
  { key: 'assign',    label: 'Assign',    icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal' },
];

export default function ManagerApp() {
  const { user, logout } = useAuth();
  const { hostel, updateHostel, hostelCode } = useApp();
  const [tab, setTab] = useState('dashboard');
  const [editVisible, setEditVisible] = useState(false);
  const [newName, setNewName] = useState(hostel.name || '');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const saveName = () => {
    if (newName.trim()) updateHostel({ name: newName.trim() });
    setEditVisible(false);
  };

  const openEdit = () => {
    setNewName(hostel.name);
    setEditVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>KeepClean</Text>
          {hostel.name ? (
            <TouchableOpacity onPress={openEdit} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.hostelName}>· {hostel.name}</Text>
                <Ionicons name="pencil" size={14} color={COLORS.textMuted} />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowCodeModal(true)} style={styles.codeBtn} activeOpacity={0.7}>
            <Ionicons name="key-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowUserMenu(true)} activeOpacity={0.7}>
            <Avatar name={user.username} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>
        {tab === 'dashboard' && <DashboardScreen />}
        {tab === 'setup' && <SetupScreen />}
        {tab === 'team' && <TeamScreen />}
        {tab === 'assign' && <AssignScreen />}
      </View>

      {/* ── Bottom Tabs ── */}
      <View style={styles.tabBar}>
        {TABS.map(t => {
          const isActive = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)} activeOpacity={0.75}>
              <Ionicons name={isActive ? t.iconActive : t.icon} size={22} color={isActive ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Edit Hostel Name Modal ── */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit property name</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Property name"
              autoCapitalize="words"
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[4] }}>
              <TouchableOpacity
                onPress={() => setEditVisible(false)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveName}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                disabled={!newName.trim()}
              >
                <Text style={[styles.modalBtnText, { color: COLORS.white }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Hostel Code Modal (buttons fixed) ── */}
      <Modal visible={showCodeModal} transparent animationType="fade" onRequestClose={() => setShowCodeModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Your Hostel Code</Text>
            <Text style={styles.codeText}>{hostel.code || hostelCode || 'N/A'}</Text>
            <Text style={styles.codeHint}>Share this code with your cleaners so they can log in.</Text>
            <TouchableOpacity
              onPress={() => setShowCodeModal(false)}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: RADIUS.sm,
                paddingVertical: SPACING[3],
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: SPACING[4],
              }}
            >
              <Text style={{ fontFamily: 'System', fontWeight: '600', fontSize: 16, color: COLORS.white }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── User Menu Modal ── */}
      <Modal visible={showUserMenu} transparent animationType="fade" onRequestClose={() => setShowUserMenu(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowUserMenu(false)}>
          <Pressable style={styles.menuCard}>
            <Text style={styles.menuTitle}>{user.username}</Text>
            <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: SPACING[2] }} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowUserMenu(false);
                logout();
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
              <Text style={styles.menuItemText}>Sign out</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING[4], paddingVertical: SPACING[3],
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2] },
  logo: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.primary, letterSpacing: -0.3 },
  hostelName: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2] },
  codeBtn: { padding: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryLight },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: SPACING[2], paddingBottom: Platform.OS === 'ios' ? 20 : SPACING[2],
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: SPACING[1] },
  tabLabel: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  tabLabelActive: { color: COLORS.primary, fontFamily: FONTS.bold },
  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: SPACING[6] },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING[5], width: '100%', maxWidth: 400, ...SHADOW.md },
  modalTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: SPACING[4] },
  modalInput: {
    fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.text, backgroundColor: COLORS.background,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[3],
  },
  modalBtn: {
    flex: 1,
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalBtnCancel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  modalBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modalBtnText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    color: COLORS.primary,
  },
  codeText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xxxl, color: COLORS.primary, textAlign: 'center', marginBottom: SPACING[2] },
  codeHint: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center' },
  // User menu
  menuCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING[4], width: 200, ...SHADOW.md },
  menuTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text, marginBottom: SPACING[1] },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2], paddingVertical: SPACING[2] },
  menuItemText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.danger },
});