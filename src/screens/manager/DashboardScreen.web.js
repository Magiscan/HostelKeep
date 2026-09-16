// src/screens/manager/DashboardScreen.web.js
//
// REDESIGN — transcribed from the prototype's `isDashboard` branch.
//
// Structure: four clickable KPI tiles across the top, then a two-column split —
// Rooms today + Recent activity on the left (flex 3, basis 560), Housekeepers +
// Floor progress + Needs attention on the right (flex 1, basis 300).
//
// WHAT WENT AWAY
// Header, KPICard, ProgressCard, SearchBar, RoomTable, CleanerWidget,
// FloorProgress, RecentActivity and Footer are all gone. The prototype draws
// these inline and none of them survive the redesign intact — KPICard has no
// icon square or chevron, RoomTable has no accent bar or status chip, and the
// Header's buttons are now header actions. If nothing else in the app imports
// them, they can be deleted.
//
// The notification Modal is gone too: ManagerLayout owns notifications now,
// via the header bell.
//
// DROPPED DELIBERATELY: the local generateCSV helper and handleExport. They
// were defined but never referenced — Header only ever called onSaveDay and
// onDailyReport. Excel export still works through generateDailyReport.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, useWindowDimensions,
} from 'react-native';
import { useApp } from '../../contexts/AppContext';
import { useNotifications } from '../../contexts/NotificationContext';
import Icon from '../../components/Icon';
import { Drawer, drawerStyles as d } from '../../components/Dashboard/Drawer.web';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL, STATUS, ACCENT } from '../../theme/tokens';
import { buildCleanerColors } from '../../utils/cleanerColor';
import { downloadDailyReport } from '../../utils/dailyReport';
import Footer from '../../components/Dashboard/Footer';

const SUNKEN = '#F8FAFC';
const HAIRLINE = '#EEF2F7';

/* Room status → chip + accent. `worst` in the prototype walks the bed states;
   here the app's simpler model is: cleaned → done, assigned → in progress,
   otherwise waiting. */
function roomLook(cleaned, assigned) {
  if (cleaned) {
    return {
      label: 'Done', icon: 'verified', accent: ACCENT.complete,
      bg: STATUS.inspected.bg, border: STATUS.inspected.border, fg: STATUS.inspected.text,
    };
  }
  if (assigned) {
    return {
      label: 'In progress', icon: 'cleaning_services', accent: BRAND.yellow,
      bg: STATUS.dirty.bg, border: STATUS.dirty.border, fg: STATUS.dirty.text,
    };
  }
  return {
    label: 'Waiting', icon: 'schedule', accent: NEUTRAL.border,
    bg: NEUTRAL.slateChip, border: NEUTRAL.border, fg: NEUTRAL.text3,
  };
}

function activityLook(type) {
  switch (type) {
    case 'room_cleaned':  return { icon: 'verified', bg: STATUS.inspected.bg, fg: STATUS.inspected.text };
    case 'extra_request': return { icon: 'flag', bg: STATUS.dirty.bg, fg: STATUS.dirty.text };
    default:              return { icon: 'schedule', bg: NEUTRAL.slateChip, fg: NEUTRAL.text2 };
  }
}

const ATTENTION_LOOK = {
  request:   { icon: 'flag', bg: STATUS.dirty.bg, fg: STATUS.dirty.text },
  flag:      { icon: 'schedule', bg: STATUS.late.bg, fg: STATUS.late.text },
  note:      { icon: 'sticky_note_2', bg: STATUS.cleaned.bg, fg: STATUS.cleaned.text },
  extraTime: { icon: 'more_time', bg: STATUS.dirty.bg, fg: STATUS.dirty.text },
};

/* ── Room detail ───────────────────────────────────────────────────
   Reuses the shared Drawer so a row click on the dashboard and a room click on
   Assign open the same kind of surface. Read-only — editing lives on Assign. */
function RoomDetailDrawer({ room, roomStatus, cleaners, floors, onClose }) {
  if (!room) return null;
  const status = roomStatus[room.id] || {};
  const cleaner = cleaners.find(c => c.id === room.assignedTo);
  const floor = floors.find(f => f.id === room.floorId);
  const look = roomLook(!!status.cleaned, !!room.assignedTo);

  const rows = [
    ['Type', room.type === 'private' ? 'Private' : 'Dormitory'],
    floor && ['Floor', floor.name],
    ['Housekeeper', cleaner ? cleaner.username : 'Unassigned'],
    ['Status', look.label],
    status.extraTime > 0 && ['Extra time', `+${status.extraTime} min`],
    status.managerNotes && ['Manager note', status.managerNotes],
    status.notes && ['Housekeeper note', status.notes],
  ].filter(Boolean);

  const flags = [];
  if (status.earlyCheckIn) flags.push('Early check-in');
  if (status.lateCheckOut) flags.push('Late check-out');
  if (status.commonOnly) flags.push('Common areas only');

  return (
    <Drawer visible onClose={onClose} width={460} title={room.name} subtitle="Today's state">
      <View style={{ gap: 12 }}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
          </View>
        ))}
      </View>

      {flags.length > 0 && (
        <View>
          <Text style={d.overline}>Flags</Text>
          <View style={styles.chipWrap}>
            {flags.map(f => (
              <View key={f} style={[styles.chip, { backgroundColor: STATUS.late.bg, borderColor: STATUS.late.border }]}>
                <Text style={[styles.chipText, { color: STATUS.late.text }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {room.type === 'dorm' && room.beds?.length > 0 && !status.commonOnly && (
        <View>
          <Text style={d.overline}>Beds</Text>
          <View style={styles.chipWrap}>
            {room.beds.map(bed => {
              const assignment = (status.assignmentBedStatus || {})[bed.id] || { status: 'clean' };
              const bedClean = (status.bedStatus || {})[bed.id]?.status === 'cleaned';
              const skipped = assignment.status === 'stayover' || assignment.status === 'noone';
              const s = bedClean ? STATUS.inspected : skipped ? STATUS.excluded : STATUS.dirty;
              return (
                <View key={bed.id} style={[styles.chip, { backgroundColor: s.bg, borderColor: s.border }]}>
                  <Text style={[styles.chipText, { color: s.text }]}>
                    {bed.name} · {bedClean ? 'Cleaned' : skipped ? 'Skipped' : 'To do'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </Drawer>
  );
}

/* ── Section shell ─────────────────────────────────────────────── */
function Panel({ title, action, children, flush }) {
  return (
    <View style={styles.panel}>
      {!!title && (
        <View style={[styles.panelHead, flush && styles.panelHeadFlush]}>
          <Text style={styles.panelTitle}>{title}</Text>
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export default function DashboardScreen({ highlightRoomId, onRoomOpened, onNavigate, onReady }) {
  const {
    rooms = [], roomStatus = {}, hostel = {}, cleaners = [],
    extraRequests = [], floors = [],
    approveExtraRoom, rejectExtraRoom, can,
  } = useApp();
  const { t, i18n } = useTranslation();
  const { notifications } = useNotifications();
  const canExport = can('export');

  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);

  const colors = useMemo(() => buildCleanerColors(cleaners), [cleaners]);

  const { width } = useWindowDimensions();
  const isMobile = width < 768;   // adjust threshold as needed

  /* ── Header actions ── */
  const handleDailyReport = useCallback(() => {
    const n = new Date();
    const date = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    downloadDailyReport({
      date, hostelName: hostel.name, rooms, roomStatus, cleaners, floors, extraRequests,
      lang: i18n.language.startsWith('it') ? 'it' : 'en',
    });
  }, [hostel.name, rooms, roomStatus, cleaners, floors, extraRequests, i18n.language]);

  useEffect(() => {
    if (!onReady) return;
    onReady(canExport ? { dailyReport: handleDailyReport } : {});
  }, [onReady, handleDailyReport, canExport]);

  /* ── Notification deep-link (unchanged) ── */
  useEffect(() => {
    if (highlightRoomId && rooms.length > 0) {
      const room = rooms.find(r => r.id === highlightRoomId);
      if (room) {
        setSelectedRoom(room);
        if (onRoomOpened) onRoomOpened();
      }
    }
  }, [highlightRoomId, rooms, onRoomOpened]);

  /* ── Derived (unchanged arithmetic) ── */
  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const term = search.toLowerCase();
    return rooms.filter(r => r.name.toLowerCase().includes(term));
  }, [rooms, search]);

  const assignedRooms = rooms.filter(r => r.assignedTo);
  const assignedCleaned = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const assignedPct = assignedRooms.length
    ? Math.round((assignedCleaned / assignedRooms.length) * 100) : 0;
  const unassignedCount = rooms.filter(r => !r.assignedTo).length;
  const pendingExtraRequests = extraRequests.filter(r => r.status === 'pending' || !r.status);
  const approvedCount = extraRequests.filter(r => r.status === 'approved').length;

  const workingCleaners = cleaners.filter(c => {
    const assigned = rooms.filter(r => r.assignedTo === c.id);
    return assigned.length > 0 && assigned.some(r => !roomStatus[r.id]?.cleaned);
  }).length;

  const kpis = [
    {
      key: 'rooms', icon: 'meeting_room', value: rooms.length, label: 'Rooms today',
      chipBg: NEUTRAL.slateChip, chipFg: BRAND.navy,
      subs: [{ label: `${unassignedCount} unassigned`, bg: STATUS.dirty.bg, fg: STATUS.dirty.text }],
      onPress: () => onNavigate('rooms'),
    },
    {
      key: 'progress', icon: 'donut_large', value: `${assignedPct}%`, label: 'Shift progress',
      chipBg: STATUS.early.bg, chipFg: STATUS.early.text,
      subs: [{ label: `${assignedCleaned} of ${assignedRooms.length} done`, bg: STATUS.inspected.bg, fg: STATUS.inspected.text }],
      onPress: () => onNavigate('assign'),
    },
    {
      key: 'team', icon: 'group', value: cleaners.length, label: 'Housekeepers on shift',
      chipBg: STATUS.inspected.bg, chipFg: STATUS.inspected.text,
      subs: [
        { label: `${workingCleaners} working`, bg: NEUTRAL.slateChip, fg: NEUTRAL.text2 },
        { label: `${cleaners.length - workingCleaners} free`, bg: STATUS.inspected.bg, fg: STATUS.inspected.text },
      ],
      onPress: () => onNavigate('team'),
    },
    {
      key: 'requests', icon: 'flag', value: pendingExtraRequests.length, label: 'Extra requests',
      chipBg: STATUS.dirty.bg, chipFg: STATUS.dirty.text,
      subs: [
        { label: `${pendingExtraRequests.length} pending`, bg: STATUS.dirty.bg, fg: STATUS.dirty.text },
        { label: `${approvedCount} approved`, bg: STATUS.inspected.bg, fg: STATUS.inspected.text },
      ],
      onPress: () => onNavigate('extraRequests'),
    },
  ];

  const activity = notifications.slice(0, 5).map(n => ({
    id: n.id,
    text: n.message,
    time: new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ...activityLook(n.type),
  }));

  const sortedFloors = useMemo(() => [...floors].sort((a, b) => {
    const order = name => {
      if (name === 'Ground Floor') return 0;
      if (name === 'Garage') return 999;
      const num = parseInt(name, 10);
      return isNaN(num) ? 500 : num;
    };
    return order(a.name) - order(b.name);
  }), [floors]);

  /* ── Needs attention (unchanged construction) ── */
  const attentionItems = [];
  extraRequests.filter(r => r.status === 'pending' || !r.status).forEach(req => {
    const room = rooms.find(r => r.id === req.id);
    const cleaner = cleaners.find(c => c.id === req.cleanerId);
    attentionItems.push({
      type: 'request', id: req.id, roomId: req.id,
      title: room?.name || 'Unknown room',
      message: `Extra room requested by ${cleaner?.username || 'Unknown housekeeper'}`,
      request: req,
    });
  });
  rooms.forEach(room => {
    const status = roomStatus[room.id] || {};
    if (status.earlyCheckIn) attentionItems.push({ type: 'flag', id: `early-${room.id}`, roomId: room.id, title: room.name, message: 'Early check-in' });
    if (status.lateCheckOut) attentionItems.push({ type: 'flag', id: `late-${room.id}`, roomId: room.id, title: room.name, message: 'Late check-out' });
    if (status.notes && status.notes.trim()) {
      attentionItems.push({
        type: 'note', id: `note-${room.id}`, roomId: room.id, title: room.name,
        message: `${status.notes.substring(0, 60)}${status.notes.length > 60 ? '…' : ''}`,
      });
    }
    if (status.extraTime > 0) {
      attentionItems.push({
        type: 'extraTime', id: `extratime-${room.id}`, roomId: room.id, title: room.name,
        message: `Extra time requested: +${status.extraTime} min`,
      });
    }
  });

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>

        {/* ── KPI tiles ── */}
        <View style={styles.kpiGrid}>
          {kpis.map(kpi => (
            <TouchableOpacity
              key={kpi.key}
              onPress={kpi.onPress}
              style={styles.kpiCard}
              activeOpacity={0.85}
            >
              <View style={styles.kpiTop}>
                <View style={[styles.kpiIcon, { backgroundColor: kpi.chipBg }]}>
                  <Icon name={kpi.icon} size={23} color={kpi.chipFg} />
                </View>
                <Icon name="chevron_right" size={20} color={NEUTRAL.text4} />
              </View>
              <View>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
              </View>
              <View style={styles.kpiSubs}>
                {kpi.subs.map(sub => (
                  <View key={sub.label} style={[styles.kpiSub, { backgroundColor: sub.bg }]}>
                    <Text style={[styles.kpiSubText, { color: sub.fg }]}>{sub.label}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.split}>
          {/* ══ Left column ══ */}
          <View style={styles.colMain}>

            <Panel
              title="Rooms today"
              flush
              action={
                <View style={styles.tableSearch}>
                  <Icon name="search" size={19} color={NEUTRAL.text3} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search a room…"
                    placeholderTextColor={NEUTRAL.text4}
                    style={styles.tableSearchInput}
                  />
                </View>
              }
            >

              <View style={styles.thead}>
                <Text style={[styles.th, styles.cRoom]}>Room</Text>
                <Text style={[styles.th, styles.cFloor]}>Floor</Text>
                <Text style={[styles.th, styles.cType]}>Type</Text>
                <Text style={[styles.th, styles.cHk]}>Housekeeper</Text>
                <Text style={[styles.th, styles.cStatus]}>Status</Text>
                <View style={styles.cEnd} />
              </View>
              {/* Horizontal scroll keeps the six columns readable rather than
                  crushing them when the window narrows. */}

              <ScrollView
                style={styles.tableVerticalScroll}
                showsVerticalScrollIndicator
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  contentContainerStyle={styles.tableContent}
                >
                  <View style={styles.tableInner}>

                  {filteredRooms.map(room => {
                    const status = roomStatus[room.id] || {};
                    const cleaner = cleaners.find(c => c.id === room.assignedTo);
                    const floor = floors.find(f => f.id === room.floorId);
                    const look = roomLook(!!status.cleaned, !!room.assignedTo);
                    const hasNote = !!(status.notes && status.notes.trim());

                    return (
                      <TouchableOpacity
                        key={room.id}
                        style={styles.tr}
                        onPress={() => setSelectedRoom(room)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.cRoom, styles.roomCell]}>
                          <View style={[styles.accent, { backgroundColor: look.accent }]} />
                          <Text style={styles.roomNumber}>{room.name}</Text>
                        </View>
                        <Text style={[styles.cFloor, styles.floorCell]} numberOfLines={1}>
                          {floor?.name || '—'}
                        </Text>
                        <View style={styles.cType}>
                          <View style={[styles.typePill, {
                            backgroundColor: room.type === 'dorm' ? NEUTRAL.beigePill : NEUTRAL.slateChip,
                          }]}>
                            <Text style={[styles.typePillText, {
                              color: room.type === 'dorm' ? '#7C4A15' : NEUTRAL.text2,
                            }]}>
                              {room.type === 'dorm' ? 'Dorm' : 'Private'}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.cHk, styles.hkCell]}>
                          <View style={[styles.hkDot, {
                            backgroundColor: cleaner ? colors[cleaner.id] : '#CBD5E1',
                          }]} />
                          <Text
                            style={[styles.hkName, !cleaner && { color: NEUTRAL.text4 }]}
                            numberOfLines={1}
                          >
                            {cleaner ? cleaner.username : 'Unassigned'}
                          </Text>
                        </View>
                        <View style={styles.cStatus}>
                          <View style={[styles.statusChip, {
                            backgroundColor: look.bg, borderColor: look.border,
                          }]}>
                            <Icon name={look.icon} size={16} color={look.fg} />
                            <Text style={[styles.statusChipText, { color: look.fg }]}>
                              {look.label}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.cEnd, styles.endCell]}>
                          {hasNote && <Icon name="sticky_note_2" size={18} color={BRAND.yellow} />}
                          <Icon name="chevron_right" size={18} color={NEUTRAL.text4} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </ScrollView>
            </Panel>

            <Panel
              title="Recent activity"
              flush
              action={
                <TouchableOpacity onPress={() => onNavigate('reports')} activeOpacity={0.7}>
                  <Text style={styles.viewAll}>View all</Text>
                </TouchableOpacity>
              }
            >
              <View style={styles.activityList}>
                {activity.length === 0 ? (
                  <Text style={styles.emptyLine}>Nothing yet today.</Text>
                ) : activity.map(a => (
                  <View key={a.id} style={styles.activityRow}>
                    <View style={[styles.activityIcon, { backgroundColor: a.bg }]}>
                      <Icon name={a.icon} size={18} color={a.fg} />
                    </View>
                    <Text style={styles.activityText} numberOfLines={1}>{a.text}</Text>
                    <Text style={styles.activityTime}>{a.time}</Text>
                  </View>
                ))}
              </View>
            </Panel>
          </View>

          {/* ══ Right rail ══ */}
          <View style={styles.colSide}>

            <View style={[styles.panel, styles.panelPadded]}>
              <Text style={styles.panelTitle}>Housekeepers</Text>
              <Text style={styles.panelSub}>
                {workingCleaners} of {cleaners.length} working
              </Text>
              <View style={{ gap: 14 }}>
                {cleaners.map(c => {
                  const mine = rooms.filter(r => r.assignedTo === c.id);
                  const done = mine.filter(r => roomStatus[r.id]?.cleaned).length;
                  const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
                  return (
                    <View key={c.id} style={styles.hkBrief}>
                      <View style={[styles.hkAvatar, { backgroundColor: colors[c.id] }]}>
                        <Text style={styles.hkAvatarText}>
                          {c.username?.[0]?.toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.hkBriefTop}>
                          <Text style={styles.hkBriefName} numberOfLines={1}>{c.username}</Text>
                          <Text style={styles.hkBriefLoad}>{done}/{mine.length}</Text>
                        </View>
                        <View style={styles.miniTrack}>
                          <View style={[styles.miniFill, {
                            width: `${pct}%`,
                            backgroundColor: pct === 100 && mine.length ? ACCENT.complete : BRAND.yellow,
                          }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.panel, styles.panelPadded]}>
              <Text style={[styles.panelTitle, { marginBottom: 16 }]}>Floor progress</Text>
              <View style={{ gap: 16 }}>
                {sortedFloors.map(f => {
                  const floorRooms = rooms.filter(r => r.floorId === f.id);
                  const done = floorRooms.filter(r => roomStatus[r.id]?.cleaned).length;
                  const pct = floorRooms.length ? Math.round((done / floorRooms.length) * 100) : 0;
                  return (
                    <View key={f.id}>
                      <View style={styles.floorTop}>
                        <Text style={styles.floorName} numberOfLines={1}>{f.name}</Text>
                        <Text style={styles.floorLabel}>{done}/{floorRooms.length}</Text>
                      </View>
                      <View style={styles.floorTrack}>
                        <View style={[styles.floorFill, {
                          width: `${pct}%`,
                          backgroundColor: pct === 100 && floorRooms.length ? ACCENT.complete : BRAND.yellow,
                        }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.panel, styles.panelPadded]}>
              <Text style={[styles.panelTitle, { marginBottom: 12 }]}>Needs attention</Text>
              {attentionItems.length === 0 ? (
                <Text style={styles.emptyLine}>Nothing needs attention right now.</Text>
              ) : (
                <View>
                  {attentionItems.map(item => {
                    const look = ATTENTION_LOOK[item.type] || ATTENTION_LOOK.note;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.attentionRow}
                        activeOpacity={item.type === 'request' ? 1 : 0.7}
                        onPress={
                          item.type === 'request'
                            ? undefined
                            : () => setSelectedRoom(rooms.find(r => r.id === item.roomId))
                        }
                      >
                        <View style={[styles.attentionIcon, { backgroundColor: look.bg }]}>
                          <Icon name={look.icon} size={17} color={look.fg} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.attentionTitle}>{item.title}</Text>
                          <Text style={styles.attentionMessage}>{item.message}</Text>
                          {item.type === 'request' && (
                            <View style={styles.attentionActions}>
                              <TouchableOpacity
                                onPress={() => approveExtraRoom(item.request.id, item.request.cleanerId)}
                                style={[styles.miniBtn, {
                                  backgroundColor: STATUS.inspected.bg,
                                  borderColor: STATUS.inspected.border,
                                }]}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.miniBtnText, { color: STATUS.inspected.text }]}>
                                  Approve
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => rejectExtraRoom(item.request.id)}
                                style={[styles.miniBtn, { borderColor: '#FECACA' }]}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.miniBtnText, { color: '#B91C1C' }]}>Reject</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <RoomDetailDrawer
        room={selectedRoom}
        roomStatus={roomStatus}
        cleaners={cleaners}
        floors={floors}
        onClose={() => setSelectedRoom(null)}
      />

      <Footer compact={isMobile} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NEUTRAL.appBg },
  page: { paddingTop: 24, paddingHorizontal: 28, paddingBottom: 40, gap: 24 },

  /* KPI tiles */
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  kpiCard: {
    flexGrow: 1, flexBasis: 240, minWidth: 240,
    gap: 14, padding: 20, borderRadius: 22,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  kpiTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12,
  },
  kpiIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  kpiValue: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 28, lineHeight: 30,
    color: NEUTRAL.text, fontVariant: ['tabular-nums'],
  },
  kpiLabel: { marginTop: 6, fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3 },
  kpiSubs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  kpiSub: {
    height: 26, paddingHorizontal: 10, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  kpiSubText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12.5 },

  /* Two-column split */
  split: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' },
  colMain: { flexGrow: 3, flexShrink: 1, flexBasis: 560, minWidth: 0, gap: 24 },
  colSide: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0, gap: 24 },

  panel: {
    borderRadius: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  panelPadded: { padding: 20 },
  panelHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, flexWrap: 'wrap', paddingVertical: 18, paddingHorizontal: 20,
  },
  panelHeadFlush: { borderBottomWidth: 1, borderBottomColor: NEUTRAL.border },
  panelTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 18, color: NEUTRAL.text,
  },
  panelSub: {
    marginTop: 4, marginBottom: 16,
    fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text3,
  },
  viewAll: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 14, color: BRAND.navy,
  },

  tableSearch: {
    flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0, maxWidth: 320,
    height: 40, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
  },
  tableSearchInput: {
    flex: 1, minWidth: 0, outlineStyle: 'none',
    fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text,
  },

  /* Table */
  thead: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: NEUTRAL.border,
    backgroundColor: SUNKEN,
  },
  th: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 11,
    letterSpacing: 0.88, textTransform: 'uppercase', color: NEUTRAL.text3,
  },
  tr: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: HAIRLINE,
  },
  cRoom:   { width: 88, flexShrink: 0 },
  cFloor:  { flexGrow: 1, flexBasis: 0, minWidth: 90 },
  cType:   { width: 140, flexShrink: 0 },
  cHk:     { flexGrow: 1.6, flexBasis: 0, minWidth: 120 },
  cStatus: { width: 132, flexShrink: 0 },
  cEnd:    { width: 40, flexShrink: 0 },

  roomCell: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  accent: { width: 5, height: 22, borderRadius: 3, flexShrink: 0 },
  roomNumber: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 17,
    color: NEUTRAL.text, fontVariant: ['tabular-nums'],
  },
  floorCell: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text2 },
  typePill: {
    height: 24, paddingHorizontal: 10, borderRadius: 9, alignSelf: 'flex-start',
    alignItems: 'center', justifyContent: 'center',
  },
  typePillText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12 },
  hkCell: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  hkDot: { width: 8, height: 8, borderRadius: 999, flexShrink: 0 },
  hkName: { flex: 1, minWidth: 0, fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    height: 28, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1,
  },
  statusChipText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12.5 },
  endCell: { flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },

  /* Activity */
  activityList: { paddingTop: 6, paddingHorizontal: 20, paddingBottom: 14 },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: HAIRLINE,
  },
  activityIcon: {
    width: 34, height: 34, borderRadius: 12, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  activityText: { flex: 1, minWidth: 0, fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text2 },
  activityTime: {
    flexShrink: 0, fontFamily: FONTS.regular, fontSize: 13,
    color: NEUTRAL.text4, fontVariant: ['tabular-nums'],
  },

  /* Housekeepers rail */
  hkBrief: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hkAvatar: {
    width: 34, height: 34, borderRadius: 999, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  hkAvatarText: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 14, color: '#FFFFFF',
  },
  hkBriefTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  hkBriefName: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 15, color: NEUTRAL.text,
  },
  hkBriefLoad: {
    flexShrink: 0, fontFamily: FONTS.regular, fontSize: 13,
    color: NEUTRAL.text2, fontVariant: ['tabular-nums'],
  },
  miniTrack: {
    height: 6, borderRadius: 999, marginTop: 8,
    backgroundColor: NEUTRAL.slateChip, overflow: 'hidden',
  },
  miniFill: { height: '100%', borderRadius: 999 },

  /* Floor progress */
  floorTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 10, marginBottom: 8,
  },
  floorName: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14, color: NEUTRAL.text,
  },
  floorLabel: {
    flexShrink: 0, fontFamily: FONTS.regular, fontSize: 13,
    color: NEUTRAL.text3, fontVariant: ['tabular-nums'],
  },
  floorTrack: {
    height: 8, borderRadius: 999, backgroundColor: NEUTRAL.slateChip, overflow: 'hidden',
  },
  floorFill: { height: '100%', borderRadius: 999 },

  /* Needs attention */
  attentionRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 13, borderTopWidth: 1, borderTopColor: HAIRLINE,
  },
  attentionIcon: {
    width: 30, height: 30, borderRadius: 10, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  attentionTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 14.5, color: NEUTRAL.text,
  },
  attentionMessage: {
    marginTop: 2, fontFamily: FONTS.regular, fontSize: 13,
    lineHeight: 18, color: NEUTRAL.text3,
  },
  attentionActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  miniBtn: {
    height: 32, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  miniBtnText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13 },

  emptyLine: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3 },

  /* Room detail drawer */
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  detailLabel: {
    width: 120, flexShrink: 0,
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13.5, color: NEUTRAL.text3,
  },
  detailValue: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 28, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  chipText: { fontFamily: FONTS.medium, fontWeight: '500', fontSize: 12.5 },
  tableVerticalScroll: {
    maxHeight: 400,  // adjust to your preference (e.g., 400–500)
  },
  tableContent: {
    flexGrow: 1,
    minWidth: 720,
  },
  tableInner: {
    flexGrow: 1,
    minWidth: 0,
  },
});