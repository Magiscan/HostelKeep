import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { RADIUS } from '../../theme/radius';

export default function Header({
  hostelName,
  unreadCount,
  onNotificationsPress,
  onExportPress,         
  onSaveDay,       
  saveDaySuccess,        
}) {
  const { t } = useTranslation();
  const today = new Date();
  const dayName = today.toLocaleDateString(undefined, { weekday: 'long' });
  const dateStr = today.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.header}>
      <View style={styles.greetingBlock}>
        <Text style={styles.greeting}>Good Morning 👋</Text>
        <Text style={styles.hostelName}>{hostelName}</Text>
        <Text style={styles.date}>{dayName}, {dateStr}</Text>
      </View>

      <View style={styles.actions}>
        {onSaveDay && (
          <TouchableOpacity
            onPress={onSaveDay}
            style={[
              styles.exportBtn,
              { borderColor: saveDaySuccess ? COLORS.success : COLORS.primary },
            ]}
            activeOpacity={0.7}
          >
            <Icon
              name={saveDaySuccess ? 'checkmark-circle' : 'calendar-outline'}
              size={18}
              color={saveDaySuccess ? COLORS.success : COLORS.primary}
            />
            <Text style={[styles.exportLabel, { color: saveDaySuccess ? COLORS.success : COLORS.primary }]}>
              {saveDaySuccess ? (t('saved') || 'Saved ✓') : (t('saveDay') || 'Save Day')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Notification bell */}
        <TouchableOpacity
          onPress={onNotificationsPress}
          style={styles.iconBtn}
          activeOpacity={0.7}
        >
          <Icon name="alarm-outline" size={20} color={COLORS.primary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  greetingBlock: {
    flex: 1,
    marginRight: SPACING.md,
  },
  greeting: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xl,
    color: COLORS.text,
  },
  hostelName: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  date: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  exportLabel: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
});