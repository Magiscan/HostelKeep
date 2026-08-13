import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'rooms', label: 'Rooms', icon: 'bed-outline' },
  { key: 'assign', label: 'Assign', icon: 'swap-horizontal-outline' },
  { key: 'team', label: 'Team', icon: 'people-outline' },
  { key: 'extraRequests', label: 'Extra Requests', icon: 'flag-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', badgeKey: 'notifications' },
  { key: 'reports', label: 'Live Reports', icon: 'document-text-outline' },
  { key: 'history', label: 'History', icon: 'calendar-outline' },
];

export default function Sidebar({
  activeRoute = 'dashboard',
  onNavigate = () => {},
  badges = {},           // e.g. { notifications: 3, extraRequests: 3 }
  user = { name: 'test', role: 'Manager' },
  onLanguagePress = () => {},
  onSignOut = () => {},
}) {
  return (
    <View style={styles.sidebar}>
      <View>
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Icon name="flash-outline" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.logoText}>KeepClean</Text>
        </View>

        {/* Nav */}
        <View style={styles.nav}>
          {NAV_ITEMS.map(item => {
            const active = item.key === activeRoute;
            const badge = badges[item.badgeKey || item.key];
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => onNavigate(item.key)}
                activeOpacity={0.7}
              >
                <Icon
                  name={item.icon}
                  size={18}
                  color={active ? COLORS.primary : COLORS.textSecondary}
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {item.label}
                </Text>
                {!!badge && (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.langRow} onPress={onLanguagePress}>
          <Icon name="globe-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 10 }} />
          <Text style={styles.langLabel}>Language</Text>
          <Icon name="chevron-forward-outline" size={14} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={styles.userRow}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user.name?.[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userRole}>{user.role}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutRow} onPress={onSignOut}>
          <Icon name="log-out-outline" size={16} color={COLORS.danger} style={{ marginRight: 10 }} />
          <Text style={styles.signOutLabel}>Sign out</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    justifyContent: 'space-between',
    height: '100%',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.primary,
  },
  nav: { gap: 2 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  navLabel: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  navLabelActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  navBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  langLabel: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
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
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  signOutLabel: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.danger,
  },
  copyright: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs || 4,
  },
  version: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
});