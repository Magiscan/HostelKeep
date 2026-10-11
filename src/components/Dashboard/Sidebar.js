// src/components/Dashboard/Sidebar.js
//
// REDESIGN — transcribed from the KohCiao desktop handoff prototype.
//
// What changed from the old sidebar:
//   • Navy panel (var(--navy)) instead of white surface. 248px, not 240px.
//   • Material Symbols icon names, not Ionicons names. The LEGACY_MAP in
//     Icon.web.js would have translated the old ones, but the prototype names
//     them directly and there's no reason to route through a shim here.
//   • Active state is a translucent white fill + a 3px gold bar bleeding off
//     the left edge — not a tinted pill with a bar tucked inside the padding.
//   • Notifications is GONE from the nav. It moved to the bell in PageHeader,
//     which is where the prototype puts it. Leaving it in both places gives
//     the same panel two entry points that look unrelated.
//
// LAYOUT NOTE (the reason padding lives on the children, not the <aside>):
// the active bar sits at left:-14, i.e. flush with the panel edge. On web a
// ScrollView is overflow:auto, so anything sticking out horizontally gets
// clipped. Keeping the aside's horizontal padding at 0 and pushing it onto
// the logo row / nav content / footer means the bar is at x=0 inside the
// scroll content and survives.
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView, Image, Platform,
} from 'react-native';
import Icon from '../Icon';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { RADIUS } from '../../theme/radius';
import { BRAND } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';

// Web only: lets the tooltip render on <body>, above every layout layer.
const createPortal = Platform.OS === 'web' ? require('react-dom').createPortal : null;

const logo = require('../../../assets/logo.png');

/* On-navy text tones. */
const ON_NAVY        = '#FFFFFF';
const ON_NAVY_DIM    = '#DCE6F2';   // idle nav label
const ON_NAVY_SOFT   = '#C6D3E4';   // language row
const ON_NAVY_MUTED  = '#A9BCD5';   // group headings, role line
const FILL_SUBTLE    = 'rgba(255,255,255,0.06)';
const FILL_ACTIVE    = 'rgba(255,255,255,0.12)';
const HAIRLINE       = 'rgba(255,255,255,0.1)';

const buildNavSections = (t) => [
  {
    label: t('sidebarOverview'),
    items: [
      { key: 'dashboard', label: t('sidebarDashboard'), icon: 'dashboard' },
    ],
  },
  {
    label: t('sidebarOperations'),
    items: [
      { key: 'rooms', label: t('sidebarRooms'), icon: 'bed' },
      { key: 'assign', label: t('sidebarAssign'), icon: 'swap_horiz' },
      { key: 'team', label: t('sidebarTeam'), icon: 'group' },
      { key: 'extraRequests', label: t('sidebarExtraRequests'), icon: 'flag' },
      { key: 'maintenance', label: t('sidebarMaintenance'), icon: 'build' },
    ],
  },
  {
    label: t('sidebarInsights'),
    items: [
      { key: 'reports', label: t('sidebarLive'), icon: 'description' },
      { key: 'history', label: t('sidebarHistory'), icon: 'calendar_month' },
    ],
  },
  {
    label: t('sidebarSettings'),
    items: [
      { key: 'roles',   label: t('sidebarRoles'),   icon: 'shield_person', ownerOnly: true },
      { key: 'account', label: t('sidebarAccount'), icon: 'account_circle', always: true },
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
  sections = null,
  isOwner = true,
  onSignOut = () => {},
  onClose,
  collapsed = false,
  onToggleCollapse,
}) {
  const { t, i18n } = useTranslation();
  const NAV_SECTIONS = React.useMemo(() => buildNavSections(t), [t]);
  const [showLangModal, setShowLangModal] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [toggleHover, setToggleHover] = useState(false);

  // Hover labels for the collapsed rail. Measured from the hover event itself
  // and rendered on <body> via a portal — anything rendered inside the sidebar
  // sits underneath the content area, whatever its zIndex.
  const [tip, setTip] = useState(null);   // { label, top, left } | null

  const showTip = (e, label) => {
    const el = e?.currentTarget;
    const rect = el?.getBoundingClientRect?.();
    if (rect) {
      setTip({ label, top: rect.top + rect.height / 2, left: rect.right + 16 });
    } else if (e?.nativeEvent?.clientY != null) {
      setTip({ label, top: e.nativeEvent.clientY, left: 92 });
    }
  };
  const hideTip = () => setTip(null);

  // Spread onto any Pressable that should show a label when collapsed.
  // (`key` is unused now; kept so the call sites don't have to change.)
  const tipProps = (key, label) => (collapsed ? {
    onHoverIn: (e) => showTip(e, label),
    onHoverOut: hideTip,
  } : {});

  useEffect(() => { setTip(null); }, [collapsed]);

  const currentLang = LANGS.find(l => l.code === i18n.language) || LANGS[0];

  const navSections = NAV_SECTIONS
    .map(group => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.always) return true;
        if (item.ownerOnly) return isOwner;
        if (!sections) return true;
        return sections.includes(item.key);
      }),
    }))
    .filter(group => group.items.length > 0);

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      {/* ── Logo + wordmark ── */}
      <View style={[styles.logoRow, collapsed && styles.logoRowCollapsed]}>
        <Pressable
          onPress={() => { hideTip(); if (collapsed) onToggleCollapse?.(); }}
          onHoverIn={(e) => { setLogoHover(true); if (collapsed) showTip(e, t('expandSidebar')); }}
          onHoverOut={() => { setLogoHover(false); hideTip(); }}
          disabled={!collapsed}
          style={styles.logoMarkWrap}
          accessibilityRole={collapsed ? 'button' : undefined}
          accessibilityLabel={collapsed ? t('expandSidebar') : undefined}
        >
          {collapsed && logoHover ? (
            <View style={styles.logoMarkHover}>
              <Icon name="right_panel_open" size={21} color={BRAND.yellow} />
            </View>
          ) : (
            <Image source={logo} style={styles.logoMark} />
          )}
        </Pressable>

        {!collapsed && (
          <>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.wordmark} numberOfLines={1}>
                <Text style={{ color: ON_NAVY }}>Hostel</Text>
                <Text style={{ color: BRAND.yellow }}>Keep</Text>
              </Text>
              <Text style={styles.wordmarkSub} numberOfLines={1}>{t('sidebarProSubtitle')}</Text>
            </View>

            {!!onToggleCollapse && (
              <Pressable
                onPress={onToggleCollapse}
                onHoverIn={() => setToggleHover(true)}
                onHoverOut={() => setToggleHover(false)}
                style={[styles.collapseBtn, toggleHover && styles.collapseBtnHover]}
                accessibilityRole="button"
                accessibilityLabel={t('collapseSidebar')}
              >
                <Icon
                  name="left_panel_close"
                  size={19}
                  color={toggleHover ? ON_NAVY : ON_NAVY_MUTED}
                />
              </Pressable>
            )}

            {!!onClose && (
              <TouchableOpacity onPress={onClose} style={styles.collapseBtn} activeOpacity={0.7}>
                <Icon name="close" size={20} color={ON_NAVY_DIM} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* ── Navigation ── */}
      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={hideTip}
        scrollEventThrottle={16}
      >
        {navSections.map(section => (
          <View key={section.label} style={styles.section}>
            {!collapsed && <Text style={styles.sectionLabel}>{section.label}</Text>}
            <View style={{ gap: 2 }}>
              {section.items.map(item => {
                const active = item.key === activeRoute;
                const badge = badges[item.badgeKey || item.key];

                return (
                  <Pressable
                    key={item.key}
                    {...tipProps(item.key, badge ? `${item.label} · ${badge}` : item.label)}
                    style={({ pressed }) => [
                      styles.row,
                      collapsed && styles.rowCollapsed,
                      active && styles.rowActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => { hideTip(); onNavigate(item.key); }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={item.label}
                  >
                    {active && <View style={styles.activeBar} />}
                    <View style={[styles.rowLeft, collapsed && styles.rowLeftCollapsed]}>
                      <View style={styles.iconWrap}>
                        <Icon
                          name={item.icon}
                          size={21}
                          color={active ? BRAND.yellow : ON_NAVY_DIM}
                        />
                      </View>
                      {!collapsed && (
                        <Text
                          style={[styles.rowLabel, active && styles.rowLabelActive]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      )}
                    </View>
                    {!!badge && (
                      <View style={[styles.badge, collapsed && styles.badgeFloat]}>
                        <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── Footer: language + account ── */}
      <View style={styles.footer}>
        <Pressable
          {...tipProps('lang', `${t('manager.language')} · ${currentLang.label}`)}
          style={({ pressed }) => [styles.langSelector, pressed && { opacity: 0.7 }]}
          onPress={() => { hideTip(); setShowLangModal(true); }}
        >
          <View style={styles.langSelectorLeft}>
            <Icon name="language" size={18} color={ON_NAVY_SOFT} />
            {!collapsed && (
              <Text style={styles.langSelectorText} numberOfLines={1}>{currentLang.label}</Text>
            )}
          </View>
          {!collapsed && <Icon name="unfold_more" size={18} color={ON_NAVY_SOFT} />}
        </Pressable>

        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user.name?.[0]?.toUpperCase()}</Text>
          </View>
          {!collapsed && (
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
              <Text style={styles.userRole} numberOfLines={1}>{user.role}</Text>
            </View>
          )}
          <Pressable
            {...tipProps('signout', t('signOut'))}
            onPress={onSignOut}
            style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel={t('signOut')}
          >
            <Icon name="logout" size={19} color={ON_NAVY_MUTED} />
          </Pressable>
        </View>
      </View>

      {/* ── Collapsed-rail tooltip ── */}
      {collapsed && tip && createPortal && createPortal(
        <View style={[styles.tooltip, { top: tip.top, left: tip.left, pointerEvents: 'none' }]}>
          <View style={styles.tooltipArrow} />
          <Text style={styles.tooltipText} numberOfLines={1}>{tip.label}</Text>
        </View>,
        document.body,
      )}

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
                    {active && <Icon name="check_circle" size={18} color={COLORS.primary} />}
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
    width: 248,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 248,
    backgroundColor: BRAND.navy,
    height: '100%',
    paddingTop: 20,
    paddingBottom: 16,
  },
  sidebarCollapsed: { width: 76, flexBasis: 76 },

  /* Logo */
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  logoRowCollapsed: { paddingHorizontal: 18, justifyContent: 'center' },

  logoMarkWrap: { width: 40, height: 40, flexShrink: 0 },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    resizeMode: 'cover',
    shadowColor: BRAND.navy,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  logoMarkHover: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  wordmark: {
    fontFamily: FONTS.display,
    fontWeight: '600',
    fontSize: 19,
    letterSpacing: -0.19,
  },
  wordmarkSub: {
    marginTop: 2,
    fontFamily: FONTS.regular,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
    color: ON_NAVY_MUTED,
  },

  /* Nav */
  navScroll: { flex: 1 },
  navScrollContent: { paddingHorizontal: 14, gap: 20 },

  section: { gap: 2 },
  sectionLabel: {
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
    color: ON_NAVY_MUTED,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },

  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  rowCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  rowActive: { backgroundColor: FILL_ACTIVE },
  activeBar: {
    position: 'absolute',
    left: -14,
    top: 11,
    bottom: 11,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: BRAND.yellow,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLeftCollapsed: {
    flex: 0,
    gap: 0,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 22,
    height: 22,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontWeight: '500',
    fontSize: 15,
    color: ON_NAVY_DIM,
  },
  rowLabelActive: {
    color: ON_NAVY,
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
  },

  badge: {
    minWidth: 22,
    height: 20,
    borderRadius: 999,
    paddingHorizontal: 6,
    backgroundColor: BRAND.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeFloat: {
    position: 'absolute',
    top: 4,
    right: 6,              // shifted from 12 to avoid clipping
    borderWidth: 2,
    borderColor: BRAND.navy,
  },
  badgeText: {
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
    fontSize: 12,
    color: BRAND.navy,
  },

  /* Collapse button (small, in logo row) */
  collapseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseBtnHover: { backgroundColor: 'rgba(255,255,255,0.10)' },

  /* Footer */
  footer: {
    marginHorizontal: 14,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    gap: 10,
  },
  langSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: FILL_SUBTLE,
  },
  langSelectorLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langSelectorText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: ON_NAVY_SOFT,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: FILL_SUBTLE,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: BRAND.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatarText: {
    fontFamily: FONTS.display,
    fontWeight: '600',
    fontSize: 15,
    color: BRAND.navy,
  },
  userInfo: { flex: 1, minWidth: 0 },
  userName: {
    fontFamily: FONTS.medium,
    fontWeight: '500',
    fontSize: 14,
    color: ON_NAVY,
  },
  userRole: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: ON_NAVY_MUTED,
    marginTop: 1,
  },
  signOutBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* Language modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  langCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: SPACING.lg,
    width: 300,
    shadowColor: BRAND.navy,
    shadowOpacity: 0.28,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
  },
  langHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  langTitle: {
    fontFamily: FONTS.display,
    fontWeight: '600',
    fontSize: 20,
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
  langList: { gap: SPACING.xs },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  langItemActive: { backgroundColor: COLORS.primaryLight },
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
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  langBadgeTextActive: { color: COLORS.primary },
  langItemText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    flexShrink: 1,
    minWidth: 0,
  },
    langItemTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
  },

  /* Collapsed-rail tooltip */
  tooltip: {
    position: 'fixed',
    zIndex: 1000,
    transform: [{ translateY: '-50%' }],
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: BRAND.navy,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: BRAND.navy,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  tooltipArrow: {
    position: 'absolute',
    left: -5,
    top: '50%',
    marginTop: -5,
    width: 10,
    height: 10,
    backgroundColor: BRAND.navy,
    transform: [{ rotate: '45deg' }],
  },
  tooltipText: {
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
    fontSize: 13,
    color: ON_NAVY,
  },
});