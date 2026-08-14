import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView, Image } from 'react-native';
import Icon from '../Icon';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { RADIUS } from '../../theme/radius';
import { useTranslation } from 'react-i18next';

const logo = require('../../../assets/logo.png');

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'rooms', label: 'Rooms', icon: 'bed-outline' },
      { key: 'assign', label: 'Assign', icon: 'swap-horizontal-outline' },
      { key: 'team', label: 'Team', icon: 'people-outline' },
      { key: 'extraRequests', label: 'Extra Requests', icon: 'flag-outline' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { key: 'reports', label: 'Live Activities', icon: 'document-text-outline' },
      { key: 'history', label: 'History', icon: 'calendar-outline' },
    ],
  },
  {
    label: 'Alerts',
    items: [
      { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', badgeKey: 'notifications' },
    ],
  },
];

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

export default function Sidebar({
  activeRoute = 'dashboard',
  onNavigate = () => {},
  badges = {},
  user = { name: 'test', role: 'Manager' },
  onSignOut = () => {},
}) {
  const { t, i18n } = useTranslation();
  const [showLangModal, setShowLangModal] = useState(false);

  const currentLang = LANGS.find(l => l.code === i18n.language) || LANGS[0];

  return (
    <View style={styles.sidebar}>
      {/* ── Logo ── */}
      <View style={styles.logoRow}>
          <Image source={logo} style={styles.logoMark} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.logoText} numberOfLines={1}>HostelKeep</Text>
          <Text style={styles.logoSubtext} numberOfLines={1}>Housekeeping Manager</Text>
        </View>
      </View>

      {/* ── Navigation (grouped into sections) ── */}
      <ScrollView style={styles.navScroll} contentContainerStyle={styles.navScrollContent} showsVerticalScrollIndicator={false}>
        {NAV_SECTIONS.map((section, idx) => (
          <View key={section.label} style={[styles.section, idx === 0 && { marginTop: 0 }]}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            <View style={{ gap: 2 }}>
              {section.items.map(item => {
                const active = item.key === activeRoute;
                const badge = badges[item.badgeKey || item.key];

                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => onNavigate(item.key)}
                    activeOpacity={0.7}
                  >
                    {active && <View style={styles.activeBar} />}
                    <View style={styles.iconWrap}>
                      <Icon
                        name={item.icon}
                        size={18}
                        color={active ? COLORS.primary : COLORS.textSecondary}
                      />
                    </View>
                    <Text style={[styles.rowLabel, active && styles.rowLabelActive]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {!!badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        {/* Language selector */}
        <TouchableOpacity style={styles.langSelector} onPress={() => setShowLangModal(true)} activeOpacity={0.7}>
          <Icon name="globe-outline" size={15} color={COLORS.textSecondary} />
          <Text style={styles.langSelectorText} numberOfLines={1}>{currentLang.label}</Text>
          <Icon name="chevron-down" size={14} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user.name?.[0]?.toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
            <Text style={styles.userRole} numberOfLines={1}>{user.role}</Text>
          </View>
          <TouchableOpacity onPress={onSignOut} style={styles.signOutBtn} activeOpacity={0.7}>
            <Icon name="log-out-outline" size={16} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Language modal ── */}
      <Modal
        visible={showLangModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLangModal(false)}>
          <Pressable style={styles.langCard} onPress={() => {}}>
            <View style={styles.langHeader}>
              <Text style={styles.langTitle} numberOfLines={1}>{t('manager.language')}</Text>
              <TouchableOpacity
                onPress={() => setShowLangModal(false)}
                style={styles.langCloseBtn}
                activeOpacity={0.7}
              >
                <Icon name="close" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.langList}>
              {LANGS.map(lang => {
                const active = i18n.language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langItem, active && styles.langItemActive]}
                    onPress={() => {
                      i18n.changeLanguage(lang.code);
                      setShowLangModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.langItemLeft}>
                      <View style={[styles.langBadge, active && styles.langBadgeActive]}>
                        <Text style={[styles.langBadgeText, active && styles.langBadgeTextActive]}>
                          {lang.code.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.langItemText, active && styles.langItemTextActive]} numberOfLines={1}>
                        {lang.label}
                      </Text>
                    </View>
                    {active && <Icon name="checkmark-circle" size={18} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    height: '100%',
  },

  /* Logo */
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
  },
  logoSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  /* Nav */
  navScroll: { flex: 1 },
  navScrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.md },

  section: { marginTop: SPACING.lg },
  sectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
    position: 'relative',
  },
  rowActive: {
    backgroundColor: COLORS.primaryLight,
  },
  activeBar: {
    position: 'absolute',
    left: -SPACING.md + 2,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  iconWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  rowLabelActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },

  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },

  /* Footer */
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },

  langSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  langSelectorText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatarText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  userRole: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  signOutBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* Language modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  langCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: 300,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  langHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  langTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    flexShrink: 1,
    minWidth: 0,
  },
  langCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  langList: {
    gap: SPACING.xs,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  langItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  langItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    minWidth: 0,
  },
  langBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  langBadgeActive: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
  },
  langBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  langBadgeTextActive: {
    color: COLORS.primary,
  },
  langItemText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    flexShrink: 1,
    minWidth: 0,
  },
  langItemTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  logoImage: {
    width: 42,
    height: 42,
    borderRadius: 12,   // optional if you want rounded corners
  }
});