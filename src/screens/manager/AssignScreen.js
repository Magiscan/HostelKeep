import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Platform, SectionList,
} from 'react-native';
import Icon from '../../components/Icon';
import BottomSheet from '../../components/BottomSheet';
import { useApp } from '../../contexts/AppContext';
import { COLORS, STATUS } from '../../theme/colors';
import { FONTS, DISPLAY, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { RADIUS } from '../../theme/radius';
import { SHADOW } from '../../theme/shadows';
import { buildCleanerColors } from '../../utils/cleanerColor';
import { roomNeedsAssignment, effectiveAttributes } from '../../utils/assignment';
import { BunkBedIcon } from '../../components/brand/Pieces';

/**
 * HostelKeep 2.0 assign screen.
 *
 * PERFORMANCE — why this screen felt laggy before:
 * tapping one bed writes to roomStatus; roomStatus lives in context and gets
 * a fresh object identity from every Firestore snapshot. So EVERY room card
 * re-rendered on EVERY tap. With 30 rooms × 8 bed chips that's ~240 views
 * rebuilt per touch, which is exactly the 2–3s delay.
 *
 * Two fixes:
 *   1. RoomCard is extracted and React.memo'd with a custom comparator, so
 *      only the room you touched re-renders.
 *   2. roomsByFloor is a single-pass memo. The old code ran rooms.filter()
 *      once per floor — O(floors × rooms) on every keystroke.
 */

/**
 * Tapping a bed now cycles through ALL states in this order. Previously it
 * only toggled clean↔inspected, so stayover/early/late were unreachable from
 * this screen. Every chip shows its state NAME alongside the icon — colour
 * alone is not something anyone should have to memorise.
 */
const BED_CYCLE = ['noone', 'clean', 'stayover', 'early', 'late'];

const BED_STATES = {
  noone:    { icon: 'remove_circle',      bg: STATUS.excluded.bg, border: STATUS.excluded.border, fg: COLORS.textTertiary },
  clean:    { icon: 'cleaning_services',  bg: STATUS.dirty.bg,    border: STATUS.dirty.border,    fg: STATUS.dirty.text },
  stayover: { icon: 'bed',                bg: STATUS.cleaned.bg,  border: STATUS.cleaned.border,  fg: STATUS.cleaned.text },
  early:    { icon: 'login',              bg: STATUS.early.bg,    border: STATUS.early.border,    fg: STATUS.early.text },
  late:     { icon: 'schedule',           bg: STATUS.late.bg,     border: STATUS.late.border,     fg: STATUS.late.text },
};

// Stable identity for rooms with no status yet — a fresh {} each render would
// break the memo comparator for every unconfigured room.
const EMPTY = {};

/* ─── Room card (memoised) ────────────────────────────────────── */
const RoomCard = React.memo(function RoomCard({
  room, status, cleaner, cleanerColor, t,
  onCycleBed, onToggleCommon, onToggleAttr, onOpenAssign, onResetBeds,
}) {
  const beds = room.beds || [];
  const bedAssigns = status.assignmentBedStatus || {};
  const frozen = !!status.commonOnly;
  const needs = roomNeedsAssignment(room, status);

  const roomAttrs = room.attributes
    ? Object.keys(room.attributes).filter(a => room.attributes[a])
    : [];
  
  const activeAttrs = new Set(effectiveAttributes(room, status));

  return (
    <View
      style={[
        styles.roomCard,
        cleaner && { borderColor: cleanerColor },
        !needs && !cleaner && { opacity: 0.72 },
      ]}
    >
      <View style={styles.roomTop}>
        <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
        <View style={styles.typePill}>
          <Text style={styles.typePillText}>
            {room.type === 'private' ? t('private') : `${beds.length} ${t('beds')}`}
          </Text>
        </View>
        <View style={{ flex: 1 }} />

        {/* Only for dorms, and only when there's something to undo — a button
            that can't change anything is just noise. */}
        {room.type === 'dorm' && beds.length > 0 && needs && (
          <TouchableOpacity
            onPress={() => onResetBeds(room.id)}
            style={styles.resetBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('resetBeds') || 'Reset beds'}
          >
            <Icon name="refresh" size={19} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {room.type === 'dorm' && beds.length > 0 && (
        <View style={styles.bedWrap}>
          {beds.map(bed => {
            const key = bedAssigns[bed.id]?.status || 'noone';
            const v = BED_STATES[key] || BED_STATES.noone;
            return (
              <View key={bed.id} style={styles.bedCell}>
                <TouchableOpacity
                  key={bed.id}
                  style={[
                    styles.bedChip,
                    { backgroundColor: v.bg, borderColor: v.border },
                    frozen && { opacity: 0.45 },
                  ]}
                  onPress={() => onCycleBed(room.id, bed.id)}
                  disabled={frozen}
                  activeOpacity={0.75}
                >
                  <Icon name={v.icon} size={16} color={v.fg} filled={key === 'clean'} />
                  <Text style={[styles.bedChipName, { color: v.fg }]}>{bed.name}</Text>
                  <Text style={[styles.bedChipState, { color: v.fg }]} numberOfLines={1}>
                    {t(`bedState_${key}`)}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {room.type === 'private' && roomAttrs.length > 0 && (
        <View style={styles.bedWrap}>
          {roomAttrs.map(attr => {
            const saved = status.assignmentAttributes;
            const on = activeAttrs.has(attr);
            return (
              <View key={attr} style={styles.bedCell}>
                <TouchableOpacity
                  key={attr}
                  style={[
                    styles.bedChip,
                    on
                      ? {
                          backgroundColor: STATUS.inspected.bg,
                          borderColor: STATUS.inspected.border,
                        }
                      : {
                          backgroundColor: COLORS.surfaceSunken,
                          borderColor: COLORS.border,
                        },
                    frozen && { opacity: 0.45 },
                  ]}
                  onPress={() => onToggleAttr(room.id, attr)}
                  disabled={frozen}
                  activeOpacity={0.75}
                >
                  <Icon
                    name={on ? 'check_circle' : 'radio_button_unchecked'}
                    size={16}
                    filled={on}
                    color={on ? STATUS.inspected.text : COLORS.textMuted}
                  />
                  <Text
                    style={[
                      styles.bedChipName,
                      { color: on ? STATUS.inspected.text : COLORS.textSecondary },
                    ]}
                  >
                    {attr}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        style={styles.commonRow}
        onPress={() => onToggleCommon(room.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, status.commonOnly && styles.checkboxOn]}>
          {status.commonOnly && <Icon name="check" size={18} color={COLORS.primary} />}
        </View>
        <Text style={styles.commonLabel}>{t('commonOnly')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.assignRow,
          cleaner
            ? { backgroundColor: COLORS.surfaceAlt, borderColor: cleanerColor }
            : { backgroundColor: COLORS.surface, borderColor: COLORS.border },
        ]}
        onPress={() => onOpenAssign(room.id, room.assignedTo || null)}
        activeOpacity={0.8}
      >
        {cleaner ? (
          <View style={[styles.assignDot, { backgroundColor: cleanerColor }]}>
            <Text style={styles.assignDotText}>
              {cleaner.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={[styles.assignDot, { backgroundColor: COLORS.surfaceMuted }]}>
            <Icon name="person_add" size={18} color={COLORS.textSecondary} />
          </View>
        )}
        <Text
          style={[styles.assignLabel, !cleaner && { color: COLORS.textSecondary }]}
          numberOfLines={1}
        >
          {cleaner ? cleaner.username : (t('assignTo') || 'Assign to…')}
        </Text>
        <Icon name="chevron_right" size={24} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );
}, (prev, next) => {
  if (prev.room !== next.room) return false;
  if (prev.cleaner?.id !== next.cleaner?.id) return false;
  if (prev.cleanerColor !== next.cleanerColor) return false;

  const a = prev.status;
  const b = next.status;
  return a.commonOnly === b.commonOnly
    && a.assignedTo === b.assignedTo
    && a.assignmentBedStatus === b.assignmentBedStatus
    && a.assignmentAttributes === b.assignmentAttributes;
});

/* ─── Screen ──────────────────────────────────────────────────── */
export default function AssignScreen({ bottomPad = 0, scrollTopSignal = 0 }) {
  const scrollRef = useRef(null);

  // Skip first run — mounting shouldn't animate to top
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    try {
      scrollRef.current?.scrollToLocation({
        sectionIndex: 0,
        itemIndex: 0,
        animated: true,
        viewOffset: 0,
      });
    } catch (_) {
      // No sections yet — ignore
    }
  }, [scrollTopSignal]);

  const { t } = useTranslation();
  const {
    rooms, cleaners, floors, assignRoomWithDetails, unassignRoom,
    roomStatus, updateRoomStatus,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showBulk, setShowBulk] = useState(false);
  const [typePrivate, setTypePrivate] = useState(false);
  const [typeDorm, setTypeDorm] = useState(false);
  const [roomType, setRoomType] = useState(null);

  const [expandedFloors, setExpandedFloors] = useState({});
  const [assignRoomId, setAssignRoomId] = useState(null);
  const [pickedCleanerId, setPickedCleanerId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const sortedFloors = useMemo(() => (
    [...floors].sort((a, b) => {
      const order = (name) => {
        if (name === 'Ground Floor') return 0;
        if (name === 'Garage') return 999;
        const num = parseInt(name, 10);
        return isNaN(num) ? 500 : num;
      };
      return order(a.name) - order(b.name);
    })
  ), [floors]);

  const matchesType = useCallback(
    (room) => !roomType || room.type === roomType,
    [roomType],
  );

  const matchesFilter = useCallback(
  (room, status) => {
    if (filter === 'all') return true;
    const hasWork = roomNeedsAssignment(room, status);
    if (filter === 'todo') return hasWork;
    return hasWork && !room.assignedTo;
  },
  [filter],
);

const { map: roomsByFloor, counts } = useMemo(() => {
  const term = search.trim().toLowerCase();
  const m = {};
  const c = { all: 0, todo: 0, unassigned: 0 };

  rooms.forEach(r => {
    const status = roomStatus[r.id] || EMPTY;
    const hasWork = roomNeedsAssignment(r, status);

    c.all += 1;
    if (hasWork) c.todo += 1;
    if (hasWork && !r.assignedTo) c.unassigned += 1;

    if (term && !r.name.toLowerCase().includes(term)) return;
    if (!matchesType(r)) return; 
    if (!matchesFilter(r, status)) return;
    (m[r.floorId] ||= []).push(r);
        });

        return { map: m, counts: c };
      }, [rooms, search, roomStatus, matchesFilter, matchesType]);

      const sections = useMemo(
        () => sortedFloors
          .filter(f => roomsByFloor[f.id]?.length)
          .map(f => ({
            floor: f,
            // Collapsing is just an empty data array — the header still renders.
            data: expandedFloors[f.id] === false ? [] : roomsByFloor[f.id],
          })),
        [sortedFloors, roomsByFloor, expandedFloors],
      );

      const visibleCount = useMemo(
        () => Object.values(roomsByFloor).reduce((n, list) => n + list.length, 0),
        [roomsByFloor],
      );

      const FILTERS = useMemo(
        () => [
          { key: 'all',         label: t('filterAll')       || 'All',         count: counts.all },
          { key: 'todo',        label: t('filterToPrepare') || 'To prepare',  count: counts.todo },
          { key: 'unassigned',  label: t('filterUnassigned') || 'Unassigned', count: counts.unassigned },
        ],
        [t, counts],
      );

  const cleanerById = useMemo(() => {
    const colors = buildCleanerColors(cleaners);
    const m = {};
    cleaners.forEach(c => { m[c.id] = { cleaner: c, color: colors[c.id] }; });
    return m;
  }, [cleaners]);

  /* ── Stable callbacks — recreating these would defeat the memo ── */
  const cycleBed = useCallback(async (roomId, bedId) => {
    const status = roomStatus[roomId] || EMPTY;
    const assignments = status.assignmentBedStatus || {};
    const current = assignments[bedId]?.status || 'noone';
    const idx = BED_CYCLE.indexOf(current);
    const next = BED_CYCLE[(idx + 1) % BED_CYCLE.length];
    await updateRoomStatus(roomId, {
      assignmentBedStatus: { ...assignments, [bedId]: { status: next, reason: next } },
    });
  }, [roomStatus, updateRoomStatus]);

  const toggleCommon = useCallback(async (roomId) => {
    const status = roomStatus[roomId] || EMPTY;
    await updateRoomStatus(roomId, { commonOnly: !status.commonOnly });
  }, [roomStatus, updateRoomStatus]);

  const toggleAttr = useCallback(async (roomId, attr) => {
    const room = rooms.find(r => r.id === roomId);
    const status = roomStatus[roomId] || EMPTY;
    const active = new Set(effectiveAttributes(room, status));
    const attrs = { ...(status.assignmentAttributes || {}) };
    attrs[attr] = !active.has(attr);
    await updateRoomStatus(roomId, { assignmentAttributes: attrs });
  }, [rooms, roomStatus, updateRoomStatus]);

  const openAssign = useCallback((roomId, currentCleanerId) => {
    setAssignRoomId(roomId);
    setPickedCleanerId(currentCleanerId);
  }, []);

  const clearAll = useCallback(() => {
    rooms.forEach(room => {
      unassignRoom(room.id);
      if (room.type === 'private') {
        const attrs = {};
        Object.keys(room.attributes || {}).forEach(key => {
          if (room.attributes[key]) attrs[key] = false;
        });
        updateRoomStatus(room.id, { assignmentAttributes: attrs });
      }
    });
  }, [rooms, unassignRoom, updateRoomStatus]);

  const resetRoomBeds = useCallback(async (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room?.beds?.length) return;
    const defaults = {};
    room.beds.forEach(bed => { defaults[bed.id] = { status: 'noone', reason: 'noone' }; });
    await updateRoomStatus(roomId, { assignmentBedStatus: defaults });
  }, [rooms, updateRoomStatus]);

  const resetBeds = useCallback(async () => {
    const updates = [];
    rooms.forEach(room => {
      if (room.type === 'dorm' && room.beds?.length) {
        const defaults = {};
        room.beds.forEach(bed => {
          defaults[bed.id] = { status: 'noone', reason: 'noone' };
        });
        updates.push(updateRoomStatus(room.id, { assignmentBedStatus: defaults }));
      }

      if (room.type === 'private') {
        const attrs = {};
        Object.keys(room.attributes || {}).forEach(key => {
          if (room.attributes[key]) attrs[key] = false;
        });
        updates.push(updateRoomStatus(room.id, { assignmentAttributes: attrs }));
      }
    });
    await Promise.all(updates);
  }, [rooms, updateRoomStatus]);

  const doAssign = useCallback(async () => {
    const room = rooms.find(r => r.id === assignRoomId);
    if (!room) return;
    const status = roomStatus[room.id] || EMPTY;
    if (!pickedCleanerId) {
      await unassignRoom(room.id);
    } else {
      await assignRoomWithDetails(
        room.id, pickedCleanerId,
        status.assignmentBedStatus || {}, status.managerNotes || '',
        status.commonOnly || false, status.assignmentAttributes || {},
        status.earlyCheckIn || false, status.lateCheckOut || false,
      );
    }
    setAssignRoomId(null);
    setPickedCleanerId(null);
  }, [assignRoomId, pickedCleanerId, rooms, roomStatus, assignRoomWithDetails, unassignRoom]);

  if (!rooms.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>{t('noRoomsToAssign')}</Text>
        <Text style={styles.emptySub}>{t('addRoomsFirst')}</Text>
      </View>
    );
  }
  if (!cleaners.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>👤</Text>
        <Text style={styles.emptyTitle}>{t('noCleaners')}</Text>
        <Text style={styles.emptySub}>{t('addCleanersFirst')}</Text>
      </View>
    );
  }

  const assignRoom = rooms.find(r => r.id === assignRoomId);

  return (
        <View style={{ flex: 1 }}>
      {/* Sticky header — outside the list so it stays fixed */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerRow}>
          <View style={styles.searchBar}>
            <Icon name="search" size={21} color={COLORS.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('search')}
              placeholderTextColor={COLORS.textMuted}
              style={styles.searchInput}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="cancel" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setShowBulk(true)}
            style={styles.iconBtn}
            activeOpacity={0.7}
            accessibilityLabel={t('bulkActions') || 'Bulk actions'}
          >
            <Icon name="more_horiz" size={22} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRow}>
          <View style={styles.segment}>
            {FILTERS.map(f => {
              const active = filter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${f.label}, ${f.count}`}
                >
                  <Text style={[styles.segmentCount, active && styles.segmentCountActive]}>
                    {f.count}
                  </Text>
                  <Text
                    style={[styles.segmentLabel, active && styles.segmentLabelActive]}
                    numberOfLines={1}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Neither selected = every room. Both selected is the same thing,
              so we don't bother preventing it. */}
          <TouchableOpacity
            onPress={() => setRoomType(v => (v === 'private' ? null : 'private'))}
            style={[styles.typeBtn, roomType === 'private' && styles.typeBtnActive]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('private')}
            accessibilityState={{ selected: roomType === 'private' }}
          >
            <Icon
              name="single_bed"
              size={20}
              color={roomType === 'private' ? COLORS.primary : COLORS.textTertiary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setRoomType(v => (v === 'dorm' ? null : 'dorm'))}
            style={[styles.typeBtn, roomType === 'dorm' && styles.typeBtnActive]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('dormitory')}
            accessibilityState={{ selected: roomType === 'dorm' }}
          >
            <BunkBedIcon
              size={20}
              color={roomType === 'dorm' ? COLORS.primary : COLORS.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <SectionList
        ref={scrollRef}
        sections={sections}
        keyExtractor={item => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        renderSectionHeader={({ section }) => {
          const floorRooms = roomsByFloor[section.floor.id] || [];
          const expanded = expandedFloors[section.floor.id] ?? (section.floor.id === sortedFloors[0]?.id);
          const assigned = floorRooms.filter(r => r.assignedTo).length;
          return (
            <TouchableOpacity
              onPress={() => setExpandedFloors(p => ({ ...p, [section.floor.id]: !expanded }))}
              style={styles.floorRow}
              activeOpacity={0.7}
            >
              <View style={styles.floorBar} />
              <Text style={styles.floorName}>{section.floor.name}</Text>
              <Text style={styles.floorCount}>{assigned}/{floorRooms.length}</Text>
              <Icon
                name={expanded ? 'expand_less' : 'expand_more'}
                size={24}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          );
        }}
        renderItem={({ item: room }) => {
          const entry = cleanerById[room.assignedTo];
          return (
            <RoomCard
              room={room}
              status={roomStatus[room.id] || EMPTY}
              cleaner={entry?.cleaner || null}
              cleanerColor={entry?.color || COLORS.border}
              t={t}
              onCycleBed={cycleBed}
              onToggleCommon={toggleCommon}
              onToggleAttr={toggleAttr}
              onResetBeds={resetRoomBeds}
              onOpenAssign={openAssign}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>{t('noResults')}</Text>
          </View>
        }
      />

      {/* ── Assign sheet (swipe down to dismiss) ── */}
      <BottomSheet
        visible={!!assignRoomId}
        onClose={() => setAssignRoomId(null)}
        maxHeightRatio={0.82}
        scrollable
      >
        <Text style={styles.sheetTitle}>
          {assignRoom ? `${t('assign')} ${assignRoom.name}` : t('assign')}
        </Text>
        <Text style={styles.sheetSub}>
          {t('pickCleaner') || 'Choose who cleans this room.'}
        </Text>

        <ScrollView style={{ maxHeight: 320 }}>
          {assignRoom?.assignedTo && (
            <TouchableOpacity
              style={[styles.pickRow, pickedCleanerId === null && styles.pickRowActive]}
              onPress={() => setPickedCleanerId(null)}
              activeOpacity={0.7}
            >
              <View style={[styles.assignDot, { backgroundColor: COLORS.dangerLight }]}>
                <Icon name="person_remove" size={18} color={COLORS.danger} />
              </View>
              <Text style={[styles.pickRowText, { color: COLORS.danger }]}>{t('unassign')}</Text>
              {pickedCleanerId === null && (
                <Icon name="check_circle" size={24} color={COLORS.danger} filled />
              )}
            </TouchableOpacity>
          )}

          {[...cleaners]
            .sort((a, b) => a.username.localeCompare(b.username))
            .map(c => {
              const picked = pickedCleanerId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pickRow, picked && styles.pickRowActive]}
                  onPress={() => setPickedCleanerId(c.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.assignDot, { backgroundColor: cleanerById[c.id].color }]}>
                    <Text style={styles.assignDotText}>
                      {c.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.pickRowText}>{c.username}</Text>
                  {picked && <Icon name="check_circle" size={24} color={COLORS.accent} filled />}
                </TouchableOpacity>
              );
            })}
        </ScrollView>

        <TouchableOpacity onPress={doAssign} style={styles.primaryBtn} activeOpacity={0.85}>
          <Icon name="assignment_turned_in" size={22} color={COLORS.onPrimary} />
          <Text style={styles.primaryBtnText}>{t('confirm') || 'Confirm'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Bulk actions sheet ── */}
      <BottomSheet visible={showBulk} onClose={() => setShowBulk(false)} maxHeightRatio={0.45}>
        <Text style={styles.sheetTitle}>{t('bulkActions') || 'Bulk actions'}</Text>

        <TouchableOpacity
          style={styles.pickRow}
          onPress={() => {
            setShowBulk(false);
            setConfirm('resetBeds');
          }}
          activeOpacity={0.7}
        >
          <Icon name="refresh" size={22} color={COLORS.textTertiary} />
          <Text style={styles.pickRowText}>{t('resetBeds') || 'Reset beds'}</Text>
          <Icon name="chevron_right" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pickRow}
          onPress={() => {
            setShowBulk(false);
            setConfirm('clearAll');
          }}
          activeOpacity={0.7}
        >
          <Icon name="cancel" size={22} color={COLORS.danger} />
          <Text style={[styles.pickRowText, { color: COLORS.danger }]}>{t('clearAll')}</Text>
          <Icon name="chevron_right" size={24} color={COLORS.danger} />
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Confirm sheet ── */}
      <BottomSheet visible={!!confirm} onClose={() => setConfirm(null)} maxHeightRatio={0.5}>
        <Text style={styles.sheetTitle}>
          {confirm === 'clearAll'
            ? (t('clearAllConfirmTitle') || 'Clear all assignments?')
            : (t('resetBedsConfirmTitle') || 'Reset all bed states?')}
        </Text>
        <Text style={styles.sheetSub}>
          {confirm === 'clearAll'
            ? (t('clearAllConfirmMsg')
               || "This unassigns every room and clears any private-room features you'd ticked.")
            : (t('resetBedsConfirmMsg')
               || 'This resets every dorm bed back to Inspected.')}
        </Text>
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
          <TouchableOpacity
            onPress={() => setConfirm(null)}
            style={[styles.halfBtn, styles.halfBtnGhost]}
            activeOpacity={0.8}
          >
            <Text style={styles.halfBtnGhostText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              const which = confirm;
              setConfirm(null);
              if (which === 'clearAll') clearAll();
              else if (which === 'resetBeds') await resetBeds();
            }}
            style={[styles.halfBtn, { backgroundColor: COLORS.danger }]}
            activeOpacity={0.8}
          >
            <Text style={styles.halfBtnText}>{t('confirm') || 'Confirm'}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, gap: 14 },

  stickyHeader: {
    gap: 12,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 18,
    backgroundColor: COLORS.background,
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 9,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    ...SHADOW.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: COLORS.text,
  },

  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: COLORS.slate,
    borderRadius: 16,
  },
  segmentItem: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  // The active tab lifts off the tray — a white card on the slate groove.
  segmentItemActive: { backgroundColor: COLORS.surface, ...SHADOW.card },
  segmentCount: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 19,
    lineHeight: 21,
    color: COLORS.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  segmentCountActive: { color: COLORS.primary },
  segmentLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    lineHeight: 13,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  segmentLabelActive: { color: COLORS.text },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultCount: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textTertiary },

  floorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 2, minHeight: 44,
  },
  floorBar:   { width: 5, height: 20, borderRadius: 3, backgroundColor: COLORS.accent },
  floorName:  { flex: 1, minWidth: 0, fontFamily: DISPLAY.semiBold, fontSize: 20, color: COLORS.primary },
  floorCount: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textTertiary },

  roomCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 15,
    marginBottom: 11,
    gap: 12,
    ...SHADOW.card,
  },
  roomTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  roomName: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 32,
    lineHeight: 34,
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  typePill: {
    borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: COLORS.beige,
  },
  typePillText: { fontFamily: FONTS.semiBold, fontSize: 14, color: COLORS.primary },

  bedWrap: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  bedCell: { width: '50%', paddingHorizontal: 4, paddingBottom: 8 },
  bedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 44,
    paddingVertical: 9, paddingHorizontal: 11,
    borderRadius: 12, borderWidth: 1,
  },
  bedChipName:  { fontFamily: DISPLAY.semiBold, fontSize: 17, flexShrink: 0 },
  bedChipState: { fontFamily: FONTS.semiBold, fontSize: 13, flexShrink: 1 },

  commonRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 44 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  commonLabel: { fontFamily: FONTS.medium, fontSize: 16, color: COLORS.text },

  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  assignDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignDotText: { fontFamily: DISPLAY.semiBold, fontSize: 14, color: COLORS.onPrimary },
  assignLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.semiBold,
    fontSize: 16,
  },

  sheetTitle: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.xxl, color: COLORS.primary },
  sheetSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 60,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.lg,
  },
  pickRowActive: { backgroundColor: COLORS.accentLight },
  pickRowText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.primary,
  },

  primaryBtn: {
    height: 56,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    ...SHADOW.md,
  },
  primaryBtnText: { fontFamily: DISPLAY.semiBold, fontSize: 18, color: COLORS.onPrimary },

  resetBtn: {
    width: 40, height: 40, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  iconBtn: {
    width: 44,
    height: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtn: {
    width: 44,
    height: 52,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.card,
  },
  typeBtnActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentLight,
  },

  halfBtn: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfBtnGhost: { backgroundColor: COLORS.surfaceMuted },
  halfBtnGhostText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.lg, color: COLORS.primary },
  halfBtnText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.lg, color: COLORS.onPrimary },

  emptyWrap: { alignItems: 'center', paddingVertical: SPACING.xl, gap: 6 },
  emptyIcon: { fontSize: 46 },
  emptyTitle: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.xxl, color: COLORS.primary },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});