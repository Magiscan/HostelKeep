import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import RoomRow from './RoomRow';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';

export default function RoomTable({ rooms, roomStatus, cleaners, floors = [], onRoomPress }) {
  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        <View style={{ width: 3 + SPACING.sm }} />
        <Text style={[styles.headerCell, { flex: 1.2 }]}>ROOM</Text>
        <Text style={styles.headerCell}>TYPE</Text>
        <Text style={styles.headerCell}>CLEANER</Text>
        <Text style={styles.headerCell}>STATUS</Text>
        <Text style={styles.headerCell}>NOTES</Text>
        <Text style={styles.headerCell}>EXTRA</Text>
        <Text style={[styles.headerCell, { flex: 0.4 }]} />
      </View>
      <ScrollView style={{ maxHeight: 460 }}>
        {rooms.map(room => {
          const status = roomStatus[room.id] || {};
          const cleaner = cleaners.find(c => c.id === room.assignedTo);
          const floor = floors.find(f => f.id === room.floorId);
          return (
            <RoomRow
              key={room.id}
              room={room}
              floorName={floor ? floor.name : null}
              cleanerName={cleaner ? cleaner.username : '—'}
              cleaned={status.cleaned || false}
              notes={status.notes}
              extraTime={status.extraTime || 0}
              onPress={() => onRoomPress(room)}
            />
          );
        })}
        {rooms.length === 0 && (
          <Text style={styles.empty}>No rooms match your search.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  headerCell: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xs,
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
  },
  empty: {
    padding: SPACING.lg,
    textAlign: 'center',
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
});