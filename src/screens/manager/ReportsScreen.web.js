import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useApp } from '../../contexts/AppContext';
import { useNotifications } from '../../contexts/NotificationContext';
import AppCard from '../../components/Card/AppCard';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';

/* ── Correct SVG progress ring (fixes the old half-border hack) ── */
function ProgressRing({ pct = 0, size = 88, strokeWidth = 8, color = COLORS.primary }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={COLORS.border} strokeWidth={strokeWidth} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={[styles.donutText, { color }]}>{clamped}%</Text>
      </div>
    </div>
  );
}

/* ── Timeline with continuous line ─────────────────────────── */
function Timeline({ items }) {
  return (
    <View style={styles.timelineContainer}>
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

  const assignedRooms = rooms.filter(r => r.assignedTo);
  const cleanedRooms = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const pendingRooms = assignedRooms.length - cleanedRooms;
  const progressPct = assignedRooms.length
    ? Math.round((cleanedRooms / assignedRooms.length) * 100)
    : 0;

  const pendingRequests = extraRequests.filter(r => r.status === 'pending' || !r.status).length;

  const cleanerStats = cleaners.map(c => {
    const assigned = rooms.filter(r => r.assignedTo === c.id);
    const done = assigned.filter(r => roomStatus[r.id]?.cleaned).length;
    const pct = assigned.length ? Math.round((done / assigned.length) * 100) : 0;
    return { username: c.username, done, total: assigned.length, pct };
  }).sort((a, b) => b.total - a.total);

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

  const recentActivity = notifications.slice(0, 10).map(n => ({
    text: n.message,
    time: new Date(n.timestamp).toLocaleString(),
  }));

  return (
    <View style={styles.safe}>
      {/* ── Toolbar ── */}
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>Overview of cleaning performance</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Overview cards ── */}
        <View style={styles.cardRow}>
          <AppCard style={styles.statCard}>
            <Text style={styles.statNumber}>{rooms.length}</Text>
            <Text style={styles.statLabel}>Total Rooms</Text>
          </AppCard>
          <AppCard style={styles.statCard}>
            <Text style={[styles.statNumber, { color: COLORS.success }]}>{cleanedRooms}</Text>
            <Text style={styles.statLabel}>Cleaned</Text>
          </AppCard>
          <AppCard style={styles.statCard}>
            <Text style={[styles.statNumber, { color: COLORS.warning }]}>{pendingRooms}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </AppCard>
          <AppCard style={styles.statCard}>
            <ProgressRing pct={progressPct} color={progressPct === 100 ? COLORS.success : COLORS.primary} />
            <Text style={styles.statLabel}>Completion</Text>
          </AppCard>
        </View>

        <View style={styles.mainRow}>
          <View style={styles.mainCol}>
            {/* ── Cleaner performance ── */}
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

            {/* ── Floor breakdown ── */}
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

            {/* ── Extra requests summary ── */}
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
          </View>

          {/* ── Recent activity timeline ── */}
          <View style={styles.sidebarCol}>
            <AppCard style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {recentActivity.length > 0 ? (
                <Timeline items={recentActivity} />
              ) : (
                <Text style={styles.empty}>No activity yet.</Text>
              )}
            </AppCard>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  toolbar: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  subtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },

  scroll: { padding: SPACING.lg },
  cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  statCard: { flex: 1, minWidth: 160, alignItems: 'center', padding: SPACING.md },
  statNumber: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xxl, color: COLORS.text },
  statLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },

  mainRow: { flexDirection: 'row', gap: SPACING.lg, alignItems: 'flex-start' },
  mainCol: { flex: 2, minWidth: 320 },
  sidebarCol: { flex: 1, minWidth: 280 },

  sectionCard: { marginBottom: SPACING.lg, padding: SPACING.lg },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, marginBottom: SPACING.md, color: COLORS.text },
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

  donutText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md },

  timelineContainer: { paddingLeft: 24, position: 'relative' },
  timelineLine: { position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, backgroundColor: COLORS.border },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary, marginRight: SPACING.md, marginTop: 4, zIndex: 1 },
  timelineContent: { flex: 1 },
  timelineTime: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  timelineText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text, marginTop: 2 },
});