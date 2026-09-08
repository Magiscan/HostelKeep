    // src/components/Dashboard/PageHeader.web.js
//
// The header strip the prototype puts inside <main>, above every section:
// page title + subtitle on the left, notification bell + contextual actions on
// the right. Web only — the native manager UI has its own glass header.
//
// This is deliberately dumb. It knows nothing about which section is showing;
// ManagerLayout hands it a title, a subtitle and a list of actions. That's what
// lets screens hand their toolbar buttons upward one at a time instead of all
// at once.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';

/**
 * @param {string}  title
 * @param {string}  subtitle
 * @param {number}  unreadCount
 * @param {func}    onOpenNotifications
 * @param {Array}   actions  [{ key, label, icon, onPress, variant }]
 *                           variant: 'primary' (navy fill, gold icon)
 *                                  | 'default'  (outlined, navy text)
 *                                  | 'danger'   (outlined red)
 */
export default function PageHeader({
  title,
  subtitle,
  unreadCount = 0,
  onOpenNotifications,
  actions = [],
}) {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.actions}>
          {!!onOpenNotifications && (
            <TouchableOpacity
              onPress={onOpenNotifications}
              style={styles.bell}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Notifications, ${unreadCount} unread`}
            >
              <Icon name="notifications" size={21} color={COLORS.textSecondary} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {actions.map(action => {
            const v = VARIANTS[action.variant] || VARIANTS.default;
            return (
              <TouchableOpacity
                key={action.key || action.label}
                onPress={action.onPress}
                disabled={action.disabled}
                style={[
                  styles.action,
                  { backgroundColor: v.bg, borderColor: v.border },
                  action.disabled && styles.actionDisabled,
                ]}
                activeOpacity={0.85}
              >
                {!!action.icon && (
                  <Icon
                    name={action.icon}
                    size={19}
                    color={action.disabled ? COLORS.textMuted : v.iconColor}
                  />
                )}
                <Text
                  style={[
                    styles.actionText,
                    { color: action.disabled ? COLORS.textMuted : v.fg },
                  ]}
                  numberOfLines={1}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const VARIANTS = {
  default: {
    bg: NEUTRAL.surface,
    border: NEUTRAL.border,
    fg: BRAND.navy,
    iconColor: BRAND.navy,
  },
  primary: {
    bg: BRAND.navy,
    border: BRAND.navy,
    fg: '#FFFFFF',
    iconColor: BRAND.yellow,
  },
  danger: {
    bg: NEUTRAL.surface,
    border: '#FECACA',
    fg: '#B91C1C',
    iconColor: '#B91C1C',
  },
};

const styles = StyleSheet.create({
  header: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: NEUTRAL.surface,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
    paddingVertical: 20,
    paddingHorizontal: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 24,
    flexWrap: 'wrap',
  },
  titleBlock: { flex: 1, minWidth: 240 },
  title: {
    fontFamily: FONTS.display,
    fontWeight: '600',
    fontSize: 26,
    letterSpacing: -0.26,
    color: NEUTRAL.text,
  },
  subtitle: {
    marginTop: 5,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: NEUTRAL.text3,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    flexShrink: 0,
  },

  bell: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: BRAND.yellow,
    borderWidth: 2,
    borderColor: NEUTRAL.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
    fontSize: 11,
    color: BRAND.navy,
  },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionDisabled: { opacity: 0.55 },
  actionText: {
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
    fontSize: 14,
  },
});