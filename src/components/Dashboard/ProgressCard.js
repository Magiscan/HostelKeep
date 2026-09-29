import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppCard from '../Card/AppCard';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { useTranslation } from 'react-i18next';

export default function ProgressCard({ pct, cleaned, total }) {
  const { t } = useTranslation();
  const message =
    pct >= 100 ? t('progressAllDone') :
    pct >= 66 ? t('progressGreat') :
    pct >= 33 ? t('progressSolid') :
    t('progressJustStarting');

  return (
    <AppCard style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{t('todayProgress')}</Text>
        <Text style={styles.link}>↗</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.ring}>
          <Text style={styles.pctText}>{pct}%</Text>
        </View>
        <View style={{ marginLeft: SPACING.md }}>
          <Text style={styles.count}>{cleaned} / {total}</Text>
          <Text style={styles.doneLabel}>{t('roomsCleaned')}</Text>
        </View>
      </View>

      <Text style={styles.message}>{message}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 220, padding: SPACING.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  label: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.textSecondary,
  },
  link: { color: COLORS.success, fontFamily: FONTS.medium },
  body: { flexDirection: 'row', alignItems: 'center' },
  ring: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 6,
    borderColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.success}1A`,
  },
  pctText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.success,
  },
  count: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xl,
    color: COLORS.text,
  },
  doneLabel: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  message: {
    marginTop: SPACING.sm,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
});