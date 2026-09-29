import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AppCard from '../Card/AppCard';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { useTranslation } from 'react-i18next';

const STATUS_COLORS = {
  Cleaned: COLORS.success,
  Pending: COLORS.warning,
  High: COLORS.danger,
  Info: COLORS.primary,
};

const STATUS_LABELS = {
  Cleaned: t('statusCleaned'),
  Pending: t('statusPending'),
  // add 'High' / 'Info' here if those statuses are ever used
};

export default function RecentActivity({ activities = [], onViewAll }) {
  const { t } = useTranslation();
  return (
    <AppCard style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('recentActivity')}</Text>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
            <Text style={styles.viewAll}>{t('viewAll')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {activities.map(a => {
        const color = STATUS_COLORS[a.status] || COLORS.textSecondary;
        return (
          <View key={a.id} style={styles.row}>
            <Text style={styles.time}>{a.time}</Text>
            <Text style={styles.text} numberOfLines={1}>{a.text}</Text>
            <Text style={[styles.status, { color }]}>{STATUS_LABELS[a.status] || a.status}</Text>
          </View>
        );
      })}
      {activities.length === 0 && <Text style={styles.empty}>{t('noRecentActivity')}</Text>}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  title: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text },
  viewAll: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  time: { width: 48, fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  text: { flex: 1, fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.text, marginRight: 8 },
  status: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs },
  empty: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 8 },
});