import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { useTranslation } from 'react-i18next';

function initials(name = '') {
  return name.trim().split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function RoomRow({ room, floorName, cleanerName, cleaned, notes, extraTime, onPress }) {
  const { t } = useTranslation();
  const isAssigned = cleanerName !== '—';
  let statusText = t('statusUnassigned');
  let statusColor = COLORS.textSecondary;

  if (isAssigned) {
    statusText = cleaned ? t('statusCleaned') : t('statusPending');
    statusColor = cleaned ? COLORS.success : COLORS.warning;
  }

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.stripe, { backgroundColor: isAssigned ? (cleaned ? COLORS.success : COLORS.warning) : COLORS.border }]} />

      <View style={[styles.cell, styles.name]}>
        <Text style={styles.roomName}>{room.name}</Text>
        {floorName ? <Text style={styles.floorName}>{floorName}</Text> : null}
      </View>

      <View style={styles.cell}>
        <View style={[styles.typeBadge, room.type === 'private' ? styles.typePrivate : styles.typeDorm]}>
          <Text style={[styles.typeText, room.type === 'private' ? styles.typePrivateText : styles.typeDormText]}>
            {room.type === 'private' ? t('private') : t('dorm')}
          </Text>
        </View>
      </View>

      <View style={[styles.cell, styles.cleanerCell]}>
        {isAssigned ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(cleanerName)}</Text>
          </View>
        ) : null}
        <Text style={styles.cellText}>{cleanerName}</Text>
      </View>

      <View style={styles.cell}>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}22` }]}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>

      <Text style={[styles.cell, styles.cellText]} numberOfLines={1}>{notes || '—'}</Text>

      <Text style={[styles.cell, styles.cellText, extraTime ? styles.extraText : null]}>
        {extraTime ? `+${extraTime}m` : '—'}
      </Text>

      <Text style={[styles.cell, styles.chevron]}>{'>'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  stripe: { width: 3, height: '70%', borderRadius: 2, marginRight: SPACING.sm },
  cell: { flex: 1, justifyContent: 'center' },
  cellText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.text },
  name: { flex: 1.2 },
  roomName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.text },
  floorName: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },

  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeDorm: { backgroundColor: `${COLORS.primary}1A` },
  typePrivate: { backgroundColor: `${COLORS.warning}22` },
  typeText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs },
  typeDormText: { color: COLORS.primary },
  typePrivateText: { color: COLORS.warning },

  cleanerCell: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 6,
  },
  avatarText: { fontFamily: FONTS.bold, fontSize: 10, color: COLORS.primary },

  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs },

  extraText: { color: COLORS.warning, fontFamily: FONTS.semiBold },
  chevron: { flex: 0.4, textAlign: 'right', color: COLORS.textSecondary },
});