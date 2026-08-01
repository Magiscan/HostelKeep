import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useApp } from '../../contexts/AppContext';
import { useNotifications } from '../../contexts/NotificationContext';
import AppCard from '../../components/Card/AppCard';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';

/* ── True filling donut chart ──────────────────────────────── */
function CircularProgress({ pct = 0, size = 80, strokeWidth = 6, color = COLORS.primary }) {
  const fillRotation = `${Math.round((pct / 100) * 360)}deg`;

  return (
    <View style={[styles.donutContainer, { width: size, height: size }]}>
      {/* track (grey background) */}
      <View
        style={[
          styles.donutTrack,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: COLORS.border,
          },
        ]}
      />
      {/* left half (clipped) */}
      <View style={[styles.donutHalf, styles.donutLeft]}>
        <View
          style={[
            styles.donutFillSegment,
            styles.donutLeftFill,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: 'transparent',
              borderTopColor: color,
              borderRightColor: color,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
      </View>
      {/* right half (rotates) */}
      <View style={[styles.donutHalf, styles.donutRight]}>
        <View
          style={[
            styles.donutFillSegment,
            styles.donutRightFill,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: 'transparent',
              borderTopColor: color,
              borderRightColor: color,
              transform: [{ rotate: fillRotation }],
            },
          ]}
        />
      </View>
      {/* centre text */}
      <View style={styles.donutCenter}>
        <Text style={[styles.donutText, { color }]}>{pct}%</Text>
      </View>
    </View>
  );
}

/* ── Timeline with continuous line ─────────────────────────── */
function Timeline({ items }) {
  return (
    <View style={styles.timelineContainer}>
      {/* single vertical line */}
      <View style={styles.timelineLine} />
      {items.map((item, idx) => (
        <View key={idx} style={styles.timelineRow}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineContent}>
            <Text style={styles.timelineTime}>{item.time}</Text>
            <Text style={styles.timelineText}>{item.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ReportsScreen() {
  const {
    rooms = [], roomStatus = {}, cleaners = [], floors = [], extraRequests = [],
  } = useApp();
  const { notifications } = useNotifications();

  // ── Overall stats ──────────────────────────────────────────────
  const assignedRooms = rooms.filter(r => r.assignedTo);
  const cleanedRooms = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const pendingRooms = assignedRooms.length - cleanedRooms;
  const progressPct = assignedRooms.length
    ? Math.round((cleanedRooms / assignedRooms.length) * 100)
    : 0;

  const pendingRequests = extraRequests.filter(r => r.status === 'pending' || !r.status).length;

  // ── Per‑cleaner stats ──────────────────────────────────────────
  const cleanerStats = cleaners.map(c => {
    const assigned = rooms.filter(r => r.assignedTo === c.id);
    const done = assigned.filter(r => roomStatus[r.id]?.cleaned).length;
    const pct = assigned.length ? Math.round((done / assigned.length) * 100) : 0;
    return { username: c.username, done, total: assigned.length, pct };
  }).sort((a, b) => b.total - a.total);

  // ── Per‑floor stats (Ground Floor first, Garage last) ──────────
  const sortedFloors = [...floors].sort((a, b) => {
    const order = (name) => {
      if (name === 'Ground Floor') return 0;
      if (name === 'Garage') return 999;
      const num = parseInt(name, 10);
      if (!isNaN(num)) return num;
      return 500;
    };
    return order(a.name) - order(b.name);
  });

  const floorStats = sortedFloors.map(f => {
    const floorRooms = rooms.filter(r => r.floorId === f.id);
    const done = floorRooms.filter(r => roomStatus[r.id]?.cleaned).length;
    const pct = floorRooms.length ? Math.round((done / floorRooms.length) * 100) : 0;
    return { name: f.name, done, total: floorRooms.length, pct };
  });

  // ── Recent activity (last 10 notifications) ────────────────────
  const recentActivity = notifications.slice(0, 10).map(n => ({
    text: n.message,
    time: new Date(n.timestamp).toLocaleString(),
  }));

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Reports</Text>

      {/* ── Overview cards ─────────────────────────────────────── */}
      <View style={styles.cardRow}>
        <AppCard style={styles.statCard}>
          <Text style={styles.statNumber}>{rooms.length}</Text>
          <Text style={styles.statLabel}>Total Rooms</Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <Text style={styles.statNumber}>{cleanedRooms}</Text>
          <Text style={styles.statLabel}>Cleaned</Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingRooms}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <CircularProgress
            pct={progressPct}
            color={progressPct === 100 ? COLORS.success : COLORS.primary}
          />
          <Text style={styles.statLabel}>Completion</Text>
        </AppCard>
      </View>

      {/* ── Cleaner performance ────────────────────────────────── */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Cleaner Performance</Text>
        {cleanerStats.map(c => (
          <View key={c.username} style={styles.perfRow}>
            <View style={styles.perfLabel}>
              <Text style={styles.perfName}>{c.username}</Text>
              <Text style={styles.perfCount}>{c.done}/{c.total} rooms</Text>
            </View>
            <View style={styles.perfBar}>
              <View style={[styles.perfFill, { width: `${c.pct}%`, backgroundColor: c.pct === 100 ? COLORS.success : COLORS.primary }]} />
            </View>
          </View>
        ))}
        {cleanerStats.length === 0 && <Text style={styles.empty}>No cleaners.</Text>}
      </AppCard>

      {/* ── Floor breakdown ────────────────────────────────────── */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Floor Progress</Text>
        {floorStats.map(f => (
          <View key={f.name} style={styles.perfRow}>
            <View style={styles.perfLabel}>
              <Text style={styles.perfName}>{f.name}</Text>
              <Text style={styles.perfCount}>{f.done}/{f.total} rooms</Text>
            </View>
            <View style={styles.perfBar}>
              <View style={[styles.perfFill, { width: `${f.pct}%`, backgroundColor: f.pct === 100 ? COLORS.success : COLORS.primary }]} />
            </View>
          </View>
        ))}
        {floorStats.length === 0 && <Text style={styles.empty}>No floors.</Text>}
      </AppCard>

      {/* ── Extra requests summary ─────────────────────────────── */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Extra Requests</Text>
        <View style={styles.cardRow}>
          <View style={styles.miniStat}>
            <Text style={[styles.miniNumber, { color: COLORS.warning }]}>{pendingRequests}</Text>
            <Text style={styles.miniLabel}>Pending</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={[styles.miniNumber, { color: COLORS.success }]}>
              {extraRequests.filter(r => r.status === 'approved').length}
            </Text>
            <Text style={styles.miniLabel}>Approved</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={[styles.miniNumber, { color: COLORS.danger }]}>
              {extraRequests.filter(r => r.status === 'rejected').length}
            </Text>
            <Text style={styles.miniLabel}>Rejected</Text>
          </View>
        </View>
      </AppCard>

      {/* ── Recent activity timeline ───────────────────────────── */}
      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentActivity.length > 0 ? (
          <Timeline items={recentActivity} />
        ) : (
          <Text style={styles.empty}>No activity yet.</Text>
        )}
      </AppCard>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.lg, backgroundColor: COLORS.background },
  pageTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xxl, marginBottom: SPACING.lg },
  cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  statCard: {
    flex: 1,
    minWidth: 150,
    alignItems: 'center',
    padding: SPACING.md,
  },
  statNumber: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xxl, color: COLORS.text },
  statLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  sectionCard: { marginBottom: SPACING.lg, padding: SPACING.lg },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, marginBottom: SPACING.md },
  perfRow: { marginBottom: SPACING.sm },
  perfLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  perfName: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text },
  perfCount: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  perfBar: { height: 6, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  perfFill: { height: '100%', borderRadius: 3 },
  empty: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 8 },
  miniStat: { flex: 1, alignItems: 'center' },
  miniNumber: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl },
  miniLabel: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },

  // Donut chart
  donutContainer: { alignItems: 'center', justifyContent: 'center' },
  donutTrack: { position: 'absolute' },
  donutHalf: { position: 'absolute', width: '50%', height: '100%', overflow: 'hidden' },
  donutLeft: { left: 0, top: 0 },
  donutRight: { right: 0, top: 0 },
  donutFillSegment: { position: 'absolute', borderStyle: 'solid' },
  donutLeftFill: { left: 0, top: 0 },
  donutRightFill: { right: 0, top: 0 },
  donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  donutText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md },

  // Timeline
  timelineContainer: { paddingLeft: 24, position: 'relative' },
  timelineLine: {
    position: 'absolute',
    left: 11,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.border,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginRight: SPACING.md,
    marginTop: 4,
    zIndex: 1,
  },
  timelineContent: { flex: 1 },
  timelineTime: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  timelineText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text, marginTop: 2 },
});