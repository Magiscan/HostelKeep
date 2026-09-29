  import React from 'react';
  import { View, Text, StyleSheet } from 'react-native';
  import AppCard from '../Card/AppCard';
  import { COLORS } from '../../theme/colors';
  import { FONTS, FONT_SIZE } from '../../theme/typography';
  import { SPACING } from '../../theme/spacing';
  import { useTranslation } from 'react-i18next';

  export default function FloorProgress({ floors = [], rooms = [], roomStatus = {} }) {
    const { t } = useTranslation();
    const rows = floors.map(f => {
      const floorRooms = rooms.filter(r => r.floorId === f.id);
      const done = floorRooms.filter(r => roomStatus[r.id]?.cleaned).length;
      const pct = floorRooms.length ? Math.round((done / floorRooms.length) * 100) : 0;
      return { ...f, pct };
    });

    return (
      <AppCard style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('floorProgress')}</Text>
          <Text style={styles.period}>{t('todayShort')}</Text>
        </View>
        {rows.map(f => (
          <View key={f.id} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.name}>{f.name}</Text>
              <Text style={styles.pct}>{f.pct}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${f.pct}%` }]} />
            </View>
          </View>
        ))}
        {rows.length === 0 && <Text style={styles.empty}>{t('noFloorsConfigured')}</Text>}
      </AppCard>
    );
  }

  const styles = StyleSheet.create({
    card: { marginBottom: SPACING.md },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
    title: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text },
    period: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
    row: { marginTop: 10 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    name: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text },
    pct: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.primary },
    track: { height: 6, borderRadius: 3, backgroundColor: COLORS.primaryLight, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.primary },
    empty: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 8 },
  });