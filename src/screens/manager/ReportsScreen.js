// src/screens/manager/ReportsScreen.js
//
// Live activities — NATIVE. Pro feature: ManagerApp only renders this when the
// hostel's subscription is active; everyone else gets the Pro sheet.
//
// Same data and arithmetic as ReportsScreen.web.js, laid out for a phone in the
// HostelKeep 2.0 mobile language the other tabs already use: gold-bar section
// headers (Assign's floor rows), 20px white cards, a navy hero card (Account's
// identity card), Fredoka numbers. Everything is one vertical scroll so it sits
// cleanly under the floating tab bar.
//
// Web resolves ReportsScreen.web.js, so this file is native-only.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import BottomSheet from '../../components/BottomSheet';
import { useApp } from '../../contexts/AppContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { COLORS, STATUS, ACCENT } from '../../theme/colors';
import { FONTS, DISPLAY } from '../../theme/typography';
import { SHADOW } from '../../theme/shadows';
import { buildCleanerColors } from '../../utils/cleanerColor';
import { roomNeedsAssignment, effectiveAttributes } from '../../utils/assignment';

const pctOf = (done, total) => (total ? Math.round((done / total) * 100) : 0);

const timeOf = (n) => {
  const ms = n.timestampMs
    ?? (typeof n.timestamp?.toMillis === 'function' ? n.timestamp.toMillis() : new Date(n.timestamp).getTime());
  return Number.isFinite(ms) ? ms : 0;
};

function activityLook(type) {
  switch (type) {
    case 'room_cleaned':  return { icon: 'verified', bg: STATUS.inspected.bg, fg: STATUS.inspected.text };
    case 'extra_request': return { icon: 'flag', bg: STATUS.dirty.bg, fg: STATUS.dirty.text };
    case 'note_added':    return { icon: 'sticky_note_2', bg: STATUS.cleaned.bg, fg: STATUS.cleaned.text };
    case 'extra_time':    return { icon: 'more_time', bg: STATUS.late.bg, fg: STATUS.late.text };
    case 'issue':         return { icon: 'build', bg: STATUS.late.bg, fg: STATUS.late.text };
    default:              return { icon: 'schedule', bg: COLORS.surfaceMuted, fg: COLORS.textSecondary };
  }
}

/* ── Pieces ────────────────────────────────────────────────────────── */
function SectionHead({ title, meta }) {
  return (
    <View style={s.sectionHead}>
      <View style={s.sectionBar} />
      <Text style={s.sectionTitle} numberOfLines={1}>{title}</Text>
      {!!meta && <Text style={s.sectionMeta}>{meta}</Text>}
    </View>
  );
}

function ProgressRow({ label, done, total, color, initial }) {
  const pct = pctOf(done, total);
  const complete = total > 0 && done === total;
  return (
    <View style={s.progressRow}>
      {!!color && (
        <View style={[s.avatar, { backgroundColor: color }]}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.progressTop}>
          <Text style={s.progressLabel} numberOfLines={1}>{label}</Text>
          <Text style={s.progressMeta}>
            {done}/{total}
            <Text style={[s.progressPct, complete && { color: STATUS.inspected.text }]}>{`  ${pct}%`}</Text>
          </Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill, {
            width: `${pct}%`,
            backgroundColor: complete ? ACCENT.complete : COLORS.accent,
          }]} />
        </View>
      </View>
    </View>
  );
}

/* ── Room lookup ───────────────────────────────────────────────────── */
// Where a room stands right now. Same buckets as the web dashboard's drawer.
function roomLook(room, status, t) {
  if (status.cleaned) {
    return { key: 'done', label: t('live.statusDone', 'Cleaned'), icon: 'verified', ...STATUS.inspected };
  }
  if (room.assignedTo) {
    return { key: 'progress', label: t('live.statusProgress', 'In progress'), icon: 'cleaning_services', ...STATUS.dirty };
  }
  if (roomNeedsAssignment(room, status)) {
    return { key: 'waiting', label: t('live.statusUnassigned', 'Not assigned'), icon: 'schedule', ...STATUS.waiting };
  }
  return { key: 'none', label: t('live.statusNoWork', 'Nothing to do'), icon: 'remove_circle', ...STATUS.excluded };
}

const BED_TODO_LABEL = {
  clean: ['bedState_clean', 'To clean'],
  early: ['bedState_early', 'Early c/in'],
  late: ['bedState_late', 'Late c/out'],
  stayover: ['bedState_stayover', 'Stay-over'],
  noone: ['bedState_noone', 'Inspected'],
};

function DetailRow({ label, value, valueColor }) {
  if (value == null || value === '') return null;
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, valueColor && { color: valueColor }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function RoomDetailSheet({ room, status, floorName, cleanerName, cleanerById, roomActivity, onClose, t }) {
  if (!room) return null;
  const look = roomLook(room, status, t);
  const beds = room.type === 'dorm' ? (room.beds || []) : [];
  const assigns = status.assignmentBedStatus || {};
  const bedDone = status.bedStatus || {};
  const features = room.type === 'private' ? effectiveAttributes(room, status) : [];
  const extraBeds = status.extraBedsCleaning || [];

  const flags = [];
  if (status.earlyCheckIn) flags.push({ label: t('earlyCheckInFlag', 'Early check-in'), ...STATUS.early });
  if (status.lateCheckOut) flags.push({ label: t('lateCheckOutFlag', 'Late check-out'), ...STATUS.late });
  if (status.commonOnly) flags.push({ label: t('commonOnly', 'Common areas only'), ...STATUS.cleaned });
  if (status.extraCleaning) flags.push({ label: t('live.extraRoom', 'Extra room'), ...STATUS.dirty });

  const doneBeds = beds.filter(b => bedDone[b.id]?.status === 'cleaned').length;

  return (
    <BottomSheet visible onClose={onClose} maxHeightRatio={0.88} scrollable>
      <View style={s.sheetHead}>
        <Text style={s.sheetRoom} numberOfLines={1}>{room.name}</Text>
        <View style={s.typePill}>
          <Text style={s.typePillText}>
            {room.type === 'dorm'
              ? `${t('dormitory', 'Dorm')} · ${beds.length} ${t('beds', 'beds')}`
              : t('private', 'Private')}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={[s.statusChip, { backgroundColor: look.bg, borderColor: look.border }]}>
          <Icon name={look.icon} size={16} color={look.text} />
          <Text style={[s.statusChipText, { color: look.text }]}>{look.label}</Text>
        </View>
      </View>

      <View style={s.detailCard}>
        <DetailRow label={t('floor', 'Floor')} value={floorName || '—'} />
        <DetailRow label={t('cleaner', 'Housekeeper')} value={cleanerName || t('unassigned', 'Unassigned')} />
        {Number(status.extraTime) > 0 && (
          <DetailRow label={t('live.extraTime', 'Extra time')} value={`+${status.extraTime} min`} valueColor={STATUS.late.text} />
        )}
        {status.extraCleaning && (
          <DetailRow
            label={t('live.extraRoom', 'Extra room')}
            value={cleanerById[status.extraCleaningBy]?.username || '—'}
          />
        )}
      </View>

      {flags.length > 0 && (
        <View style={s.chipWrap}>
          {flags.map(f => (
            <View key={f.label} style={[s.flagChip, { backgroundColor: f.bg, borderColor: f.border }]}>
              <Text style={[s.flagChipText, { color: f.text }]}>{f.label}</Text>
            </View>
          ))}
        </View>
      )}

      {beds.length > 0 && !status.commonOnly && (
        <View style={{ gap: 8 }}>
          <View style={s.subHead}>
            <Text style={s.subHeadText}>{t('beds', 'Beds')}</Text>
            <Text style={s.subHeadMeta}>{doneBeds}/{beds.length}</Text>
          </View>
          <View style={s.bedWrap}>
            {beds.map(bed => {
              const state = assigns[bed.id]?.status || 'noone';
              const cleaned = bedDone[bed.id]?.status === 'cleaned';
              const skipped = state === 'stayover' || state === 'noone';
              const tone = cleaned ? STATUS.inspected : skipped ? STATUS.excluded : STATUS.dirty;
              const [key, fallback] = BED_TODO_LABEL[state] || BED_TODO_LABEL.clean;
              return (
                <View key={bed.id} style={s.bedCell}>
                  <View style={[s.bedChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                    <Icon
                      name={cleaned ? 'check_circle' : skipped ? 'remove_circle' : 'cleaning_services'}
                      size={16}
                      color={tone.text}
                    />
                    <Text style={[s.bedName, { color: tone.text }]}>{bed.name}</Text>
                    <Text style={[s.bedState, { color: tone.text }]} numberOfLines={1}>
                      {cleaned ? t('live.bedDone', 'Done') : t(key, fallback)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {features.length > 0 && !status.commonOnly && (
        <View style={{ gap: 8 }}>
          <Text style={s.subHeadText}>{t('roomFeatures', 'What to clean')}</Text>
          <View style={s.chipWrap}>
            {features.map(f => (
              <View
                key={f}
                style={[s.flagChip, status.cleaned
                  ? { backgroundColor: STATUS.inspected.bg, borderColor: STATUS.inspected.border }
                  : { backgroundColor: COLORS.surfaceMuted, borderColor: COLORS.border }]}
              >
                <Icon
                  name={status.cleaned ? 'check_circle' : 'radio_button_unchecked'}
                  size={15}
                  color={status.cleaned ? STATUS.inspected.text : COLORS.textTertiary}
                />
                <Text style={[s.flagChipText, { color: status.cleaned ? STATUS.inspected.text : COLORS.textSecondary }]}>
                  {f}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {!!status.managerNotes && (
        <View style={[s.noteBox, { backgroundColor: COLORS.primaryLight }]}>
          <Text style={s.noteLabel}>{t('live.managerNote', 'Manager note')}</Text>
          <Text style={s.noteText}>{status.managerNotes}</Text>
        </View>
      )}
      {!!status.notes && (
        <View style={[s.noteBox, { backgroundColor: COLORS.accentLight }]}>
          <Text style={s.noteLabel}>{t('live.housekeeperNote', 'Housekeeper note')}</Text>
          <Text style={s.noteText}>{status.notes}</Text>
        </View>
      )}

      {extraBeds.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={s.subHeadText}>{t('live.extraBeds', 'Extra beds cleaned')}</Text>
          {extraBeds.map(e => (
            <View key={`${e.bedId}-${e.cleanerId}`} style={s.extraBedRow}>
              <Text style={s.extraBedName}>{beds.find(b => b.id === e.bedId)?.name || e.bedId}</Text>
              <Text style={s.extraBedMeta} numberOfLines={2}>
                {cleanerById[e.cleanerId]?.username || '—'}
                {Number(e.time) > 0 ? ` · +${e.time} min` : ''}
                {e.notes ? ` · ${e.notes}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {roomActivity.length > 0 && (
        <View style={{ gap: 4 }}>
          <Text style={s.subHeadText}>{t('live.activity', 'Activity')}</Text>
          {roomActivity.map((a, i) => (
            <View key={a.id} style={[s.activityRow, i === roomActivity.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[s.activityIcon, { backgroundColor: a.bg }]}>
                <Icon name={a.icon} size={18} color={a.fg} />
              </View>
              <Text style={s.activityText} numberOfLines={2}>{a.text}</Text>
              <Text style={s.activityTime}>{a.time}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.85}>
        <Text style={s.closeBtnText}>{t('close', 'Close')}</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

/* ── Screen ────────────────────────────────────────────────────────── */
export default function ReportsScreen({ bottomPad = 0, scrollTopSignal = 0 }) {
  const { t } = useTranslation();
  const {
    rooms = [], roomStatus = {}, cleaners = [], floors = [], extraRequests = [], hostel = {},
  } = useApp();
  const { notifications = [] } = useNotifications();

  const scrollRef = useRef(null);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollTopSignal]);

  const colors = useMemo(() => buildCleanerColors(cleaners), [cleaners]);

  const [query, setQuery] = useState('');
  const [openRoomId, setOpenRoomId] = useState(null);

  const cleanerById = useMemo(
    () => Object.fromEntries(cleaners.map(c => [c.id, c])),
    [cleaners],
  );
  const floorById = useMemo(
    () => Object.fromEntries(floors.map(f => [f.id, f])),
    [floors],
  );

  // Rooms matching the search, natural order (101, 102, 110 — not 101, 110, 102).
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return rooms
      .filter(r => (r.name || '').toLowerCase().includes(term))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }))
      .slice(0, 12);
  }, [rooms, query]);

  /* Same arithmetic as the web screen. */
  const assignedRooms = rooms.filter(r => r.assignedTo);
  const cleanedRooms = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const pendingRooms = assignedRooms.length - cleanedRooms;
  const unassignedRooms = rooms.length - assignedRooms.length;
  const progressPct = pctOf(cleanedRooms, assignedRooms.length);

  const pendingRequests = extraRequests.filter(r => r.status === 'pending' || !r.status).length;
  const approvedRequests = extraRequests.filter(r => r.status === 'approved').length;
  const rejectedRequests = extraRequests.filter(r => r.status === 'rejected').length;

  const extraMinutes = assignedRooms.reduce((n, r) => n + Number(roomStatus[r.id]?.extraTime || 0), 0);

  const cleanerStats = useMemo(() => cleaners.map(c => {
    const assigned = rooms.filter(r => r.assignedTo === c.id);
    const done = assigned.filter(r => roomStatus[r.id]?.cleaned).length;
    return { id: c.id, username: c.username || '?', done, total: assigned.length };
  }).sort((a, b) => b.total - a.total), [cleaners, rooms, roomStatus]);

  const workingNow = cleanerStats.filter(c => c.total > 0 && c.done < c.total).length;

  const floorStats = useMemo(() => {
    const order = (name) => {
      if (name === 'Ground Floor') return 0;
      if (name === 'Garage') return 999;
      const num = parseInt(name, 10);
      return Number.isNaN(num) ? 500 : num;
    };
    return [...floors]
      .sort((a, b) => order(a.name) - order(b.name))
      .map(f => {
        const floorRooms = rooms.filter(r => r.floorId === f.id);
        const done = floorRooms.filter(r => roomStatus[r.id]?.cleaned).length;
        return { id: f.id, name: f.name, done, total: floorRooms.length };
      })
      .filter(f => f.total > 0);
  }, [floors, rooms, roomStatus]);

  const activity = useMemo(() => [...notifications]
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, 40)
    .map(n => ({
      id: n.id,
      text: n.message,
      time: timeOf(n)
        ? new Date(timeOf(n)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      ...activityLook(n.type),
    })), [notifications]);

  // Activity for the open room — its own feed, newest first.
  const openRoom = openRoomId ? rooms.find(r => r.id === openRoomId) : null;
  const openRoomActivity = useMemo(() => (openRoomId ? [...notifications]
    .filter(n => n.roomId === openRoomId)
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, 6)
    .map(n => ({
      id: n.id,
      text: n.message,
      time: timeOf(n)
        ? new Date(timeOf(n)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      ...activityLook(n.type),
    })) : []), [notifications, openRoomId]);

  const stats = [
    { key: 'rooms', icon: 'meeting_room', value: rooms.length, label: t('live.roomsToday', 'Rooms today'),
      bg: COLORS.surfaceMuted, fg: COLORS.primary },
    { key: 'working', icon: 'group', value: workingNow, label: t('live.workingNow', 'Working now'),
      bg: STATUS.inspected.bg, fg: STATUS.inspected.text },
    { key: 'requests', icon: 'flag', value: pendingRequests, label: t('live.requestsWaiting', 'Requests waiting'),
      bg: STATUS.dirty.bg, fg: STATUS.dirty.text },
    { key: 'extra', icon: 'more_time', value: extraMinutes, suffix: ' min', label: t('live.extraTime', 'Extra time'),
      bg: STATUS.late.bg, fg: STATUS.late.text },
  ];

  const complete = assignedRooms.length > 0 && cleanedRooms === assignedRooms.length;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={[s.scroll, { paddingBottom: bottomPad + 24 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* ── Title ── */}
      <View style={s.titleRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title}>{t('live.title', 'Live activities')}</Text>
          {!!hostel?.name && <Text style={s.subtitle} numberOfLines={1}>{hostel.name}</Text>}
        </View>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.livePillText}>{t('live.badge', 'Live')}</Text>
        </View>
      </View>

      {/* ── Find a room ──
          Sits at the top on purpose: results appear directly under the field,
          above where the keyboard opens. */}
      <View style={s.searchBar}>
        <Icon name="search" size={21} color={COLORS.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('live.findRoom', 'Find a room…')}
          placeholderTextColor={COLORS.textMuted}
          style={s.searchInput}
          autoCorrect={false}
          autoCapitalize="characters"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="cancel" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {query.trim().length > 0 && (
        <View style={[s.card, { paddingVertical: 4, marginBottom: 12 }]}>
          {matches.length === 0 ? (
            <Text style={[s.empty, { paddingVertical: 12 }]}>{t('noResults', 'No rooms match.')}</Text>
          ) : matches.map((room, i) => {
            const st = roomStatus[room.id] || {};
            const look = roomLook(room, st, t);
            const cleaner = cleanerById[room.assignedTo];
            const hasNotes = !!(st.notes || st.managerNotes);
            return (
              <TouchableOpacity
                key={room.id}
                onPress={() => setOpenRoomId(room.id)}
                style={[s.matchRow, i === matches.length - 1 && { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
              >
                <Text style={s.matchName} numberOfLines={1}>{room.name}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.matchMeta} numberOfLines={1}>
                    {[floorById[room.floorId]?.name, cleaner?.username].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
                {hasNotes && <Icon name="sticky_note_2" size={18} color={COLORS.accent} />}
                {Number(st.extraTime) > 0 && <Icon name="more_time" size={18} color={STATUS.late.text} />}
                <View style={[s.statusDot, { backgroundColor: look.text }]} />
                <Icon name="chevron_right" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Hero: shift completion ── */}
      <View style={s.hero}>
        <Text style={s.heroOverline}>{t('live.shiftCompletion', 'Shift completion')}</Text>
        <View style={s.heroTop}>
          <Text style={s.heroValue}>{progressPct}%</Text>
          <Text style={s.heroCaption}>
            {assignedRooms.length
              ? t('live.roomsCleanedOf', '{{done}} of {{total}} assigned rooms cleaned', {
                done: cleanedRooms, total: assignedRooms.length,
              })
              : t('live.nothingAssigned', 'No rooms assigned yet')}
          </Text>
        </View>
        <View style={s.heroTrack}>
          <View style={[s.heroFill, {
            width: `${progressPct}%`,
            backgroundColor: complete ? ACCENT.complete : COLORS.accent,
          }]} />
        </View>
        <View style={s.heroStats}>
          {[
            { label: t('live.cleaned', 'Cleaned'), value: cleanedRooms },
            { label: t('live.stillToDo', 'Still to do'), value: pendingRooms },
            { label: t('live.unassigned', 'Unassigned'), value: unassignedRooms },
          ].map((x, i) => (
            <View key={x.label} style={[s.heroStat, i > 0 && s.heroStatDivider]}>
              <Text style={s.heroStatValue}>{x.value}</Text>
              <Text style={s.heroStatLabel} numberOfLines={1}>{x.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Quick stats ── */}
      <View style={s.statGrid}>
        {stats.map(st => (
          <View key={st.key} style={s.statCell}>
            <View style={s.statCard}>
              <View style={[s.statIcon, { backgroundColor: st.bg }]}>
                <Icon name={st.icon} size={20} color={st.fg} />
              </View>
              <Text style={s.statValue}>
                {st.value}
                {!!st.suffix && <Text style={s.statSuffix}>{st.suffix}</Text>}
              </Text>
              <Text style={s.statLabel} numberOfLines={1}>{st.label}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Housekeepers ── */}
      <SectionHead
        title={t('live.housekeepers', 'Housekeepers')}
        meta={cleanerStats.length ? `${workingNow}/${cleanerStats.length}` : null}
      />
      <View style={s.card}>
        {cleanerStats.length === 0 ? (
          <Text style={s.empty}>{t('live.noTeam', 'Nobody on the team yet.')}</Text>
        ) : (
          <View style={{ gap: 16 }}>
            {cleanerStats.map(c => (
              <ProgressRow
                key={c.id}
                label={c.username}
                initial={c.username.charAt(0).toUpperCase()}
                done={c.done}
                total={c.total}
                color={colors[c.id] || COLORS.primary}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── Floors ── */}
      <SectionHead title={t('live.floors', 'Floor coverage')} />
      <View style={s.card}>
        {floorStats.length === 0 ? (
          <Text style={s.empty}>{t('live.noFloors', 'No rooms on any floor yet.')}</Text>
        ) : (
          <View style={{ gap: 16 }}>
            {floorStats.map(f => (
              <ProgressRow key={f.id} label={f.name} done={f.done} total={f.total} />
            ))}
          </View>
        )}
      </View>

      {/* ── Extra requests ── */}
      <SectionHead title={t('live.extraRequests', 'Extra requests')} />
      <View style={s.miniRow}>
        {[
          { label: t('live.pending', 'Pending'), value: pendingRequests, ...STATUS.dirty },
          { label: t('live.approved', 'Approved'), value: approvedRequests, ...STATUS.inspected },
          { label: t('live.rejected', 'Rejected'), value: rejectedRequests, ...STATUS.error },
        ].map(x => (
          <View key={x.label} style={[s.miniStat, { backgroundColor: x.bg, borderColor: x.border }]}>
            <Text style={[s.miniValue, { color: x.text }]}>{x.value}</Text>
            <Text style={[s.miniLabel, { color: x.text }]} numberOfLines={1}>{x.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Activity ── */}
      <SectionHead title={t('live.activity', 'Activity')} meta={activity.length ? String(activity.length) : null} />
      <View style={[s.card, { paddingVertical: 4 }]}>
        {activity.length === 0 ? (
          <Text style={[s.empty, { paddingVertical: 12 }]}>
            {t('live.noActivity', 'Nothing has happened yet today.')}
          </Text>
        ) : activity.map((a, i) => (
          <View key={a.id} style={[s.activityRow, i === activity.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={[s.activityIcon, { backgroundColor: a.bg }]}>
              <Icon name={a.icon} size={18} color={a.fg} />
            </View>
            <Text style={s.activityText} numberOfLines={2}>{a.text}</Text>
            <Text style={s.activityTime}>{a.time}</Text>
          </View>
        ))}
      </View>

      {!!openRoom && (
        <RoomDetailSheet
          room={openRoom}
          status={roomStatus[openRoom.id] || {}}
          floorName={floorById[openRoom.floorId]?.name}
          cleanerName={cleanerById[openRoom.assignedTo]?.username}
          cleanerById={cleanerById}
          roomActivity={openRoomActivity}
          onClose={() => setOpenRoomId(null)}
          t={t}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 4 },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  title: { fontFamily: DISPLAY.semiBold, fontSize: 30, lineHeight: 34, color: COLORS.primary },
  subtitle: { marginTop: 2, fontFamily: FONTS.medium, fontSize: 15, color: COLORS.textTertiary },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 32, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: STATUS.inspected.bg, borderWidth: 1, borderColor: STATUS.inspected.border,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT.complete },
  livePillText: { fontFamily: FONTS.semiBold, fontSize: 13, color: STATUS.inspected.text },

  /* Hero */
  hero: {
    backgroundColor: COLORS.primary, borderRadius: 22,
    padding: 18, gap: 12, marginBottom: 12,
  },
  heroOverline: {
    fontFamily: FONTS.semiBold, fontSize: 12, letterSpacing: 1,
    textTransform: 'uppercase', color: COLORS.onNavyMuted,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  heroValue: {
    fontFamily: DISPLAY.semiBold, fontSize: 52, lineHeight: 56,
    color: '#FFFFFF', fontVariant: ['tabular-nums'],
  },
  heroCaption: {
    flex: 1, minWidth: 0, paddingBottom: 8,
    fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19, color: COLORS.onNavySoft,
  },
  heroTrack: {
    height: 10, borderRadius: 999, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroFill: { height: '100%', borderRadius: 999 },
  heroStats: {
    flexDirection: 'row', marginTop: 4, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  heroStat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  heroStatDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' },
  heroStatValue: {
    fontFamily: DISPLAY.semiBold, fontSize: 22, color: '#FFFFFF', fontVariant: ['tabular-nums'],
  },
  heroStatLabel: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.onNavyMuted },

  /* Stat grid */
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 6 },
  statCell: { width: '50%', paddingHorizontal: 5, paddingBottom: 10 },
  statCard: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, gap: 8,
    ...SHADOW.card,
  },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: {
    fontFamily: DISPLAY.semiBold, fontSize: 28, lineHeight: 31,
    color: COLORS.text, fontVariant: ['tabular-nums'],
  },
  statSuffix: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textTertiary },
  statLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textTertiary },

  /* Sections */
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 44, marginTop: 8, marginBottom: 8,
  },
  sectionBar: { width: 5, height: 20, borderRadius: 3, backgroundColor: COLORS.accent },
  sectionTitle: { flex: 1, minWidth: 0, fontFamily: DISPLAY.semiBold, fontSize: 20, color: COLORS.primary },
  sectionMeta: {
    fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textTertiary, fontVariant: ['tabular-nums'],
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 15, paddingVertical: 15, marginBottom: 6,
    ...SHADOW.card,
  },
  empty: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textTertiary },

  /* Progress rows */
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: DISPLAY.semiBold, fontSize: 15, color: '#FFFFFF' },
  progressTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7,
  },
  progressLabel: { flex: 1, minWidth: 0, fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.text },
  progressMeta: {
    fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary, fontVariant: ['tabular-nums'],
  },
  progressPct: { fontFamily: FONTS.semiBold, color: COLORS.textTertiary },
  track: { height: 8, borderRadius: 999, backgroundColor: COLORS.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },

  /* Extra requests */
  miniRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  miniStat: {
    flex: 1, minWidth: 0, alignItems: 'center', gap: 2,
    paddingVertical: 14, borderRadius: 18, borderWidth: 1,
  },
  miniValue: { fontFamily: DISPLAY.semiBold, fontSize: 26, fontVariant: ['tabular-nums'] },
  miniLabel: { fontFamily: FONTS.semiBold, fontSize: 13 },

  /* Find a room */
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    minHeight: 50, paddingHorizontal: 14, marginBottom: 12,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    ...SHADOW.card,
  },
  searchInput: { flex: 1, minWidth: 0, fontFamily: FONTS.medium, fontSize: 16, color: COLORS.text },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 56, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  matchName: {
    fontFamily: DISPLAY.semiBold, fontSize: 22, color: COLORS.primary,
    minWidth: 52, fontVariant: ['tabular-nums'],
  },
  matchMeta: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textTertiary },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  /* Room detail sheet */
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sheetRoom: {
    fontFamily: DISPLAY.semiBold, fontSize: 32, lineHeight: 34,
    color: COLORS.primary, fontVariant: ['tabular-nums'], flexShrink: 1,
  },
  typePill: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: COLORS.beige },
  typePillText: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.primary },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 30, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1,
  },
  statusChipText: { fontFamily: FONTS.semiBold, fontSize: 13 },
  detailCard: {
    borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailLabel: { flex: 1, fontFamily: FONTS.medium, fontSize: 15, color: COLORS.textTertiary },
  detailValue: {
    maxWidth: '60%', textAlign: 'right',
    fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.text,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  flagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 32, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1,
  },
  flagChipText: { fontFamily: FONTS.semiBold, fontSize: 13 },
  subHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subHeadText: {
    fontFamily: FONTS.semiBold, fontSize: 13, letterSpacing: 1,
    textTransform: 'uppercase', color: COLORS.textTertiary,
  },
  subHeadMeta: { fontFamily: FONTS.semiBold, fontSize: 14, color: COLORS.textSecondary },
  bedWrap: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 8 },
  bedCell: { width: '50%', paddingHorizontal: 4, paddingBottom: 8 },
  bedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    minHeight: 44, paddingVertical: 9, paddingHorizontal: 11,
    borderRadius: 12, borderWidth: 1,
  },
  bedName: { fontFamily: DISPLAY.semiBold, fontSize: 17 },
  bedState: { flexShrink: 1, fontFamily: FONTS.semiBold, fontSize: 13 },
  noteBox: { borderRadius: 14, padding: 12, gap: 3, marginBottom: 12 },
  noteLabel: {
    fontFamily: FONTS.semiBold, fontSize: 12, letterSpacing: 0.8,
    textTransform: 'uppercase', color: COLORS.textTertiary,
  },
  noteText: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 21, color: COLORS.text },
  extraBedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  extraBedName: { fontFamily: DISPLAY.semiBold, fontSize: 17, color: COLORS.primary, minWidth: 28 },
  extraBedMeta: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary },
  closeBtn: {
    height: 52, borderRadius: 16, marginTop: 14,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontFamily: DISPLAY.semiBold, fontSize: 17, color: COLORS.primary },

  /* Activity */
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 56, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  activityIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityText: {
    flex: 1, minWidth: 0, fontFamily: FONTS.medium, fontSize: 15, lineHeight: 20, color: COLORS.text,
  },
  activityTime: {
    fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textMuted, fontVariant: ['tabular-nums'],
  },
});