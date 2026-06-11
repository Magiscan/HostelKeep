import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { useTranslation } from 'react-i18next';
import { COLORS, RADIUS, FONTS, FONT_SIZE, SPACING, SHADOW } from '../../theme';
import { Avatar, Button } from '../../components/UI';
import DashboardScreen from './DashboardScreen';
import SetupScreen from './SetupScreen';
import TeamScreen from './TeamScreen';
import AssignScreen from './AssignScreen';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

export default function ManagerApp() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { hostel, updateHostel, hostelCode } = useApp();
  const [tab, setTab] = useState('dashboard');

  // Dynamic tab list with translated labels
  const TABS = useMemo(() => [
    { key: 'dashboard', label: t('manager.tabDashboard'), icon: 'grid-outline', iconActive: 'grid' },
    { key: 'setup',     label: t('manager.tabSetup'),     icon: 'construct-outline', iconActive: 'construct' },
    { key: 'team',      label: t('manager.tabTeam'),      icon: 'people-outline', iconActive: 'people' },
    { key: 'assign',    label: t('manager.tabAssign'),    icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal' },
  ], [t]);

  // Edit hostel name modal
  const [editVisible, setEditVisible] = useState(false);
  const [newName, setNewName] = useState(hostel.name || '');

  // Hostel code modal
  const [showCodeModal, setShowCodeModal] = useState(false);

  // User menu modal
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Language menu modal
  const [showLangMenu, setShowLangMenu] = useState(false);

  const saveName = () => {
    if (newName.trim()) updateHostel({ name: newName.trim() });
    setEditVisible(false);
  };

  const openEdit = () => {
    setNewName(hostel.name);
    setEditVisible(true);
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = 'KeepClean';
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>{t('appName')}</Text>
          {hostel.name ? (
            <TouchableOpacity onPress={openEdit} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.hostelName}>· {hostel.name}</Text>
                <Icon name="pencil" size={14} color={COLORS.textMuted} />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.headerRight}>
          {/* Language switcher */}
          <TouchableOpacity onPress={() => setShowLangMenu(true)} style={styles.iconBtn}>
            <Icon name="globe-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>

          {/* Hostel code */}
          <TouchableOpacity onPress={() => setShowCodeModal(true)} style={styles.codeBtn} activeOpacity={0.7}>
            <Icon name="key-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          {/* Avatar */}
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
        {TABS.map(tabItem => {
          const isActive = tab === tabItem.key;
          return (
            <TouchableOpacity
              key={tabItem.key}
              style={styles.tabItem}
              onPress={() => setTab(tabItem.key)}
              activeOpacity={0.75}
            >
              <Icon
                name={isActive ? tabItem.iconActive : tabItem.icon}
                size={22}
                color={isActive ? COLORS.primary : COLORS.textMuted}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tabItem.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Edit Hostel Name Modal ── */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('manager.editPropertyName')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('manager.propertyNamePlaceholder')}
              autoCapitalize="words"
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[4] }}>
              {/* Cancel button – secondary outline style */}
              <TouchableOpacity
                onPress={() => setEditVisible(false)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  backgroundColor: COLORS.surface,
                  borderRadius: RADIUS.sm,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  paddingVertical: SPACING[3],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{
                  fontFamily: FONTS.bold,
                  fontSize: FONT_SIZE.md,
                  color: COLORS.primary,
                }}>
                  {t('cancel')}
                </Text>
              </TouchableOpacity>

              {/* Save button – primary filled style, disabled if empty */}
              <TouchableOpacity
                onPress={saveName}
                disabled={!newName.trim()}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: !newName.trim() ? '#E2E8F0' : COLORS.primary,
                  borderRadius: RADIUS.sm,
                  borderWidth: 1,
                  borderColor: !newName.trim() ? COLORS.border : COLORS.primary,
                  paddingVertical: SPACING[3],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{
                  fontFamily: FONTS.bold,
                  fontSize: FONT_SIZE.md,
                  color: !newName.trim() ? COLORS.textMuted : COLORS.white,
                }}>
                  {t('save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Hostel Code Modal ── */}
      <Modal visible={showCodeModal} transparent animationType="fade" onRequestClose={() => setShowCodeModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('manager.yourHostelCode')}</Text>
            <Text style={styles.codeText}>{hostel.code || hostelCode || 'N/A'}</Text>
            <Text style={styles.codeHint}>{t('manager.hostelCodeHint')}</Text>
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
                {t('close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── User Menu Modal (sign out) ── */}
      <Modal visible={showUserMenu} transparent animationType="fade" onRequestClose={() => setShowUserMenu(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowUserMenu(false)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>{user.username}</Text>
            <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: SPACING[2] }} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowUserMenu(false); logout(); }}
              activeOpacity={0.7}
            >
              <Icon name="log-out-outline" size={18} color={COLORS.danger} style={{ marginRight: SPACING[2] }} />
              <Text style={[styles.menuItemText, { color: COLORS.danger }]}>{t('signOut')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Language Menu Modal ── */}
      <Modal visible={showLangMenu} transparent animationType="fade" onRequestClose={() => setShowLangMenu(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLangMenu(false)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>{t('manager.language')}</Text>
            <View style={{ gap: SPACING[2] }}>
              {LANGS.map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.menuItem, i18n.language === lang.code && styles.menuItemActive]}
                  onPress={() => { i18n.changeLanguage(lang.code); setShowLangMenu(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.menuItemText, i18n.language === lang.code && styles.menuItemTextActive]}>
                    {lang.label}
                  </Text>
                  {i18n.language === lang.code && (
                    <Icon name="checkmark-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: SPACING[2] }} />
            <TouchableOpacity
              onPress={() => setShowLangMenu(false)}
              style={[styles.menuItem, { justifyContent: 'center' }]}
              activeOpacity={0.7}
            >
              <Icon name="close-circle-outline" size={18} color={COLORS.danger} style={{ marginRight: SPACING[1] }} />
              <Text style={[styles.menuItemText, { color: COLORS.danger }]}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
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
  iconBtn: { padding: 6 },
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
  codeText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xxxl, color: COLORS.primary, textAlign: 'center', marginBottom: SPACING[2] },
  codeHint: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center' },
  // Menus
  menuCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    width: 240,
    ...SHADOW.md,
  },
  menuTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    marginBottom: SPACING[3],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[2],
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.md,
  },
  menuItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  menuItemText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  menuItemTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
});