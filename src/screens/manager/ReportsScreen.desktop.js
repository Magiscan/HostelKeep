// src/screens/manager/ReportsScreen.web.js
//
// Live activities.
//
// NOT IN THE PROTOTYPE. The handoff's nav is Dashboard / Rooms / Assign / Team /
// Extra requests / History / Roles, with no equivalent of this screen — it
// predates the redesign. So rather than invent a new visual language, this is
// built entirely from parts the other screens already established: the KPI tile
// from Dashboard, the Panel shell, the gold→green progress bars from Team and
// the History accordion, and the activity rows from Dashboard's Recent activity.
//
// The distinction from Dashboard is deliberate: Dashboard answers "what should I
// do next" (needs attention, unassigned rooms, pending requests). This answers
// "how is the shift going" — completion, per-person pace, per-floor coverage, and
// the full activity feed rather than the last five.
//
// All arithmetic is unchanged from the previous version.
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useApp } from '../../contexts/AppContext';
import { useNotifications } from '../../contexts/NotificationContext';
import Icon from '../../components/Icon';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL, STATUS, ACCENT } from '../../theme/tokens';
import { buildCleanerColors } from '../../utils/cleanerColor';
import useBreakpoint from '../../hooks/useBreakpoint';
import { useTranslation } from 'react-i18next';

const SUNKEN = '#F8FAFC';
const HAIRLINE = '#EEF2F7';

/* Progress ring. SVG via raw <svg> because react-native-svg's web build adds a
   wrapper that fights the flex sizing here, and this is a web-only file. */
function ProgressRing({ pct = 0, size = 132, stroke = 12 }) {
  const { t } = useTranslation();
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped === 100 ? ACCENT.complete : BRAND.yellow;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={NEUTRAL.slateChip} strokeWidth={stroke} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .35s ease, stroke .35s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={styles.ringValue}>{clamped}%</Text>
        <Text style={styles.ringLabel}>{t('ringComplete')}</Text>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, padded = true }) {
  return (
    <View style={styles.panel}>
      {!!title && (
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.panelSub}>{subtitle}</Text>}
        </View>
      )}
      <View style={padded ? styles.panelBody : undefined}>{children}</View>
    </View>
  );
}

/* One labelled progress row — used for both housekeepers and floors so the two
   lists read as the same kind of thing. */
function ProgressRow({ label, done, total, color }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = pct === 100 && total > 0;
  return (
    <View>
      <View style={styles.rowTop}>
        <View style={styles.rowLabelCell}>
          {!!color && <View style={[styles.rowDot, { backgroundColor: color }]} />}
          <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
        </View>
        <Text style={styles.rowMeta}>
          {done}/{total}
          <Text style={styles.rowPct}>{`  ${pct}%`}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, {
          width: `${pct}%`,
          backgroundColor: complete ? ACCENT.complete : BRAND.yellow,
        }]} />
      </View>
    </View>
  );
}

function activityLook(type) {
  switch (type) {
    case 'room_cleaned':  return { icon: 'verified', bg: STATUS.inspected.bg, fg: STATUS.inspected.text };
    case 'extra_request': return { icon: 'flag', bg: STATUS.dirty.bg, fg: STATUS.dirty.text };
    case 'issue':         return { icon: 'build', bg: STATUS.late.bg, fg: STATUS.late.text };
    default:              return { icon: 'schedule', bg: NEUTRAL.slateChip, fg: NEUTRAL.text2 };
  }
}

export default function ReportsScreen() {
  const { t } = useTranslation();
  const {
    rooms = [], roomStatus = {}, cleaners = [], floors = [], extraRequests = [],
  } = useApp();
  const { notifications } = useNotifications();
  const { isMobile } = useBreakpoint();

  const colors = useMemo(() => buildCleanerColors(cleaners), [cleaners]);

  const assignedRooms = rooms.filter(r => r.assignedTo);
  const cleanedRooms = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const pendingRooms = assignedRooms.length - cleanedRooms;
  const progressPct = assignedRooms.length
    ? Math.round((cleanedRooms / assignedRooms.length) * 100) : 0;

  const pendingRequests = extraRequests.filter(r => r.status === 'pending' || !r.status).length;
  const approvedRequests = extraRequests.filter(r => r.status === 'approved').length;
  const rejectedRequests = extraRequests.filter(r => r.status === 'rejected').length;

  const cleanerStats = useMemo(() => cleaners.map(c => {
    const assigned = rooms.filter(r => r.assignedTo === c.id);
    const done = assigned.filter(r => roomStatus[r.id]?.cleaned).length;
    return { id: c.id, username: c.username, done, total: assigned.length };
  }).sort((a, b) => b.total - a.total), [cleaners, rooms, roomStatus]);

  const floorStats = useMemo(() => {
    const sorted = [...floors].sort((a, b) => {
      const order = name => {
        if (name === 'Ground Floor') return 0;
        if (name === 'Garage') return 999;
        const num = parseInt(name, 10);
        return isNaN(num) ? 500 : num;
      };
      return order(a.name) - order(b.name);
    });
    return sorted.map(f => {
      const floorRooms = rooms.filter(r => r.floorId === f.id);
      const done = floorRooms.filter(r => roomStatus[r.id]?.cleaned).length;
      return { id: f.id, name: f.name, done, total: floorRooms.length };
    });
  }, [floors, rooms, roomStatus]);

  /* The full feed, not Dashboard's top five — this is the screen you open when
     you want the whole picture. Capped at 40 so a long shift doesn't render
     hundreds of rows. */
  const activity = notifications.slice(0, 40).map(n => ({
    id: n.id,
    text: n.message,
    time: new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ...activityLook(n.type),
  }));

  const kpis = [
    {
      key: 'total', icon: 'meeting_room', value: rooms.length, label: t('kpiRoomsToday'),
      chipBg: NEUTRAL.slateChip, chipFg: BRAND.navy,
    },
    {
      key: 'cleaned', icon: 'verified', value: cleanedRooms, label: t('statCleaned'),
      chipBg: STATUS.inspected.bg, chipFg: STATUS.inspected.text,
    },
    {
      key: 'pending', icon: 'cleaning_services', value: pendingRooms, label: t('statStillToDo'),
      chipBg: STATUS.dirty.bg, chipFg: STATUS.dirty.text,
    },
    {
      key: 'requests', icon: 'flag', value: pendingRequests, label: t('statRequestsWaiting'),
      chipBg: STATUS.early.bg, chipFg: STATUS.early.text,
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.page, isMobile && styles.pageMobile]}
      >
        <View style={styles.kpiGrid}>
          {kpis.map(kpi => (
            <View key={kpi.key} style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: kpi.chipBg }]}>
                <Icon name={kpi.icon} size={22} color={kpi.chipFg} />
              </View>
              <View>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.split}>
          <View style={styles.colMain}>
            <Panel title={t('panelShiftCompletion')} subtitle={t('panelShiftCompletionSub')}>
              <View style={[styles.ringRow, isMobile && { flexDirection: 'column' }]}>
                <ProgressRing pct={progressPct} />
                <View style={styles.ringStats}>
                  <View style={styles.ringStat}>
                    <Text style={[styles.ringStatValue, { color: STATUS.inspected.text }]}>
                      {cleanedRooms}
                    </Text>
                    <Text style={styles.ringStatLabel}>{t('ringCleaned')}</Text>
                  </View>
                  <View style={styles.ringStat}>
                    <Text style={[styles.ringStatValue, { color: STATUS.dirty.text }]}>
                      {pendingRooms}
                    </Text>
                    <Text style={styles.ringStatLabel}>{t('ringPending')}</Text>
                  </View>
                  <View style={styles.ringStat}>
                    <Text style={styles.ringStatValue}>{assignedRooms.length}</Text>
                    <Text style={styles.ringStatLabel}>{t('ringAssigned')}</Text>
                  </View>
                  <View style={styles.ringStat}>
                    <Text style={[styles.ringStatValue, { color: NEUTRAL.text3 }]}>
                      {rooms.length - assignedRooms.length}
                    </Text>
                    <Text style={styles.ringStatLabel}>{t('ringUnassigned')}</Text>
                  </View>
                </View>
              </View>
            </Panel>

            <Panel title={t('panelHousekeeperPace')} subtitle={t('panelHousekeeperPaceSub', { count: cleanerStats.length })}>
              {cleanerStats.length === 0 ? (
                <Text style={styles.empty}>{t('nobodyOnTeam')}</Text>
              ) : (
                <View style={{ gap: 16 }}>
                  {cleanerStats.map(c => (
                    <ProgressRow
                      key={c.id}
                      label={c.username}
                      done={c.done}
                      total={c.total}
                      color={colors[c.id]}
                    />
                  ))}
                </View>
              )}
            </Panel>

            <Panel title={t('panelFloorCoverage')}>
              {floorStats.length === 0 ? (
                <Text style={styles.empty}>{t('noFloorsSetUp')}</Text>
              ) : (
                <View style={{ gap: 16 }}>
                  {floorStats.map(f => (
                    <ProgressRow key={f.id} label={f.name} done={f.done} total={f.total} />
                  ))}
                </View>
              )}
            </Panel>
          </View>

          <View style={styles.colSide}>
            <Panel title={t('panelExtraRequests')}>
              <View style={styles.miniGrid}>
                {[
                  { label: t('pending'), value: pendingRequests, ...STATUS.dirty },
                  { label: t('approved'), value: approvedRequests, ...STATUS.inspected },
                  { label: t('rejected'), value: rejectedRequests, ...STATUS.error },
                ].map(s => (
                  <View key={s.label} style={[styles.miniStat, { backgroundColor: s.bg }]}>
                    <Text style={[styles.miniValue, { color: s.text }]}>{s.value}</Text>
                    <Text style={[styles.miniLabel, { color: s.text }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </Panel>

            <Panel title={t('panelActivityLog')} subtitle={t('panelActivityLogSub')} padded={false}>
              <View style={styles.activityList}>
                {activity.length === 0 ? (
                  <Text style={styles.empty}>{t('nothingLoggedToday')}</Text>
                ) : activity.map((a, i) => (
                  <View
                    key={a.id}
                    style={[styles.activityRow, i === activity.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={[styles.activityIcon, { backgroundColor: a.bg }]}>
                      <Icon name={a.icon} size={17} color={a.fg} />
                    </View>
                    <Text style={styles.activityText}>{a.text}</Text>
                    <Text style={styles.activityTime}>{a.time}</Text>
                  </View>
                ))}
              </View>
            </Panel>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NEUTRAL.appBg },
  page: { paddingTop: 24, paddingHorizontal: 28, paddingBottom: 40, gap: 24 },
  pageMobile: { paddingHorizontal: 16 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  kpiCard: {
    flexGrow: 1, flexBasis: 200,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: 22,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  kpiIcon: {
    width: 44, height: 44, borderRadius: 14, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  kpiValue: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 26, lineHeight: 28,
    color: NEUTRAL.text, fontVariant: ['tabular-nums'],
  },
  kpiLabel: { marginTop: 2, fontFamily: FONTS.regular, fontSize: 13, color: NEUTRAL.text3 },

  split: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' },
  colMain: { flexGrow: 3, flexShrink: 1, flexBasis: 520, minWidth: 0, gap: 24 },
  colSide: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0, gap: 24 },

  panel: {
    borderRadius: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  panelHead: {
    paddingVertical: 18, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: NEUTRAL.border,
  },
  panelTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 18, color: NEUTRAL.text,
  },
  panelSub: {
    marginTop: 4, fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text3,
  },
  panelBody: { padding: 20 },

  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  ringValue: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 30, lineHeight: 32,
    color: NEUTRAL.text, fontVariant: ['tabular-nums'],
  },
  ringLabel: { fontFamily: FONTS.regular, fontSize: 12, color: NEUTRAL.text3 },
  ringStats: {
    flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 16,
  },
  ringStat: { flexGrow: 1, flexBasis: 110 },
  ringStatValue: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 22,
    color: NEUTRAL.text, fontVariant: ['tabular-nums'],
  },
  ringStatLabel: {
    marginTop: 2, fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text3,
  },

  rowTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, marginBottom: 8,
  },
  rowLabelCell: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  rowDot: { width: 8, height: 8, borderRadius: 999, flexShrink: 0 },
  rowLabel: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14, color: NEUTRAL.text,
  },
  rowMeta: {
    flexShrink: 0, fontFamily: FONTS.regular, fontSize: 13,
    color: NEUTRAL.text3, fontVariant: ['tabular-nums'],
  },
  rowPct: { fontFamily: FONTS.semiBold, fontWeight: '600', color: NEUTRAL.text2 },
  track: {
    height: 8, borderRadius: 999, backgroundColor: NEUTRAL.slateChip, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999 },

  miniGrid: { flexDirection: 'row', gap: 10 },
  miniStat: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16,
  },
  miniValue: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  miniLabel: { marginTop: 2, fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12 },

  activityList: { paddingHorizontal: 20, paddingVertical: 6, maxHeight: 520 },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: HAIRLINE,
  },
  activityIcon: {
    width: 32, height: 32, borderRadius: 11, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  activityText: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.regular, fontSize: 13.5, color: NEUTRAL.text2,
  },
  activityTime: {
    flexShrink: 0, fontFamily: FONTS.regular, fontSize: 12.5,
    color: NEUTRAL.text4, fontVariant: ['tabular-nums'],
  },

  empty: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3 },
});