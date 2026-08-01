import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppCard from '../Card/AppCard';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';

export default function CleanerWidget({ cleaners, roomStatus, rooms }) {
  const rows = cleaners
    .map(c => {
      const assigned = rooms.filter(r => r.assignedTo === c.id);
      const done = assigned.filter(r => roomStatus[r.id]?.cleaned).length;
      const pct = assigned.length ? Math.round((done / assigned.length) * 100) : 0;
      return { ...c, done, total: assigned.length, pct };
    })
    .sort((a, b) => b.done - a.done);

  return (
    <AppCard style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Cleaner Workload</Text>
        <Text style={styles.period}>Today ▾</Text>
      </View>
      {rows.map(c => (
        <View key={c.id} style={styles.row}>
          <View style={styles.labelRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{c.username?.[0]?.toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{c.username}</Text>
            <Text style={styles.stat}>{c.done}/{c.total}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${c.pct}%` }]} />
          </View>
        </View>
      ))}
      {rows.length === 0 && <Text style={styles.empty}>No cleaners yet.</Text>}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  title: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text },
  period: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  row: { marginTop: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  avatar: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  avatarText: { fontFamily: FONTS.bold, fontSize: 10, color: COLORS.primary },
  name: { flex: 1, fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text },
  stat: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.primary },
  track: { height: 6, borderRadius: 3, backgroundColor: COLORS.primaryLight, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.primary },
  empty: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 8 },
});