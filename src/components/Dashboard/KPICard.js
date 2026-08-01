import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AppCard from '../Card/AppCard';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';

export default function KPICard({ icon, value, label, sub, chipColor, chipBg, link, onPress }) {
  const cardContent = (
    <AppCard style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.iconChip, { backgroundColor: chipBg || COLORS.primaryLight }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={styles.label}>{label}</Text>
        {link ? <Text style={[styles.link, { color: chipColor || COLORS.primary }]}>{link} ↗</Text> : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      {sub && (
        <View style={styles.subRow}>
          {Array.isArray(sub) ? sub.map((s, i) => (
            <View key={i} style={styles.subItem}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={styles.subText}>{s.label}</Text>
            </View>
          )) : (
            <View style={styles.subItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.warning }]} />
              <Text style={styles.subText}>{sub}</Text>
            </View>
          )}
        </View>
      )}
    </AppCard>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flex: 1, minWidth: 220 }}>
        {cardContent}
      </TouchableOpacity>
    );
  }
  return cardContent;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 220,
    padding: SPACING.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  icon: { fontSize: 16 },
  label: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.textSecondary,
  },
  link: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.xs,
  },
  value: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xxl,
    color: COLORS.text,
  },
  subRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  subItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  subText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
});