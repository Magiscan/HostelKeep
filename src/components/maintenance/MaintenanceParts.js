// src/components/maintenance/MaintenanceParts.js
//
// Small building blocks shared by the housekeeper, maintenance and manager
// screens. Plain React Native, so they render on native and on web.

import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image, ScrollView, StyleSheet, Modal, Pressable,
  Alert, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { COLORS } from '../../theme/colors';
import { locationLabel, isFinished } from '../../hooks/useMaintenance';
import { fallbackCleanerColor } from '../../utils/cleanerColor';
import { asMillis } from '../../utils/maintenanceSchedule';
import {
  photosDeleteAt, photosExpiringSoon, PHOTO_RETENTION_DAYS, PHOTO_WARNING_DAYS,
} from '../../utils/photoRetention';
import { savePhoto } from './savePhoto';
import {
  STATUS_LOOK, PRIORITY_LOOK, statusLabel, priorityLabel, dueInfo, sortRooms,
} from './maintenanceUi';

/* ─── Labels ──────────────────────────────────────────────────── */

export function Overline({ children, style }) {
  return <Text style={[s.overline, style]}>{children}</Text>;
}

/* ─── Pills ───────────────────────────────────────────────────── */

export function Pill({ label, bg, color, icon }) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      {!!icon && <Icon name={icon} size={13} color={color} />}
      <Text style={[s.pillText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }) {
  const { t } = useTranslation();
  const look = STATUS_LOOK[status] || STATUS_LOOK.open;
  return <Pill label={statusLabel(t, status)} bg={look.bg} color={look.text} icon={look.icon} />;
}

export function PriorityPill({ priority }) {
  const { t } = useTranslation();
  const look = PRIORITY_LOOK[priority] || PRIORITY_LOOK.medium;
  return <Pill label={priorityLabel(t, priority)} bg={look.bg} color={look.text} />;
}

export function DuePill({ task }) {
  const { t } = useTranslation();
  const info = dueInfo(task, t);
  if (!info) return null;
  return info.overdue
    ? <Pill label={info.label} bg={COLORS.dangerLight} color={COLORS.danger} icon="schedule" />
    : <Pill label={info.label} bg={NEUTRAL.slateChip} color={NEUTRAL.text2} icon="schedule" />;
}

/* ─── Avatars ─────────────────────────────────────────────────── */

const initialsOf = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0)).join('').toUpperCase();

export function Avatar({ name, color = BRAND.navy, size = 28 }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.38 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

export function AvatarStack({ ids = [], colors = {}, nameOf, size = 28, max = 3 }) {
  if (!ids.length) {
    return (
      <View style={[s.avatar, s.avatarEmpty, { width: size, height: size, borderRadius: size / 2 }]}>
        <Icon name="person_add" size={size * 0.55} color={NEUTRAL.text4} />
      </View>
    );
  }
  const shown = ids.slice(0, max);
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((id, i) => (
        <View key={id} style={{ marginLeft: i ? -size * 0.3 : 0, borderRadius: size, borderWidth: 2, borderColor: '#FFFFFF' }}>
          <Avatar name={nameOf ? nameOf(id) : '?'} color={colors[id] || fallbackCleanerColor(id)} size={size} />
        </View>
      ))}
      {ids.length > max && (
        <View style={[s.avatar, s.avatarMore, { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.3 }]}>
          <Text style={s.avatarMoreText}>+{ids.length - max}</Text>
        </View>
      )}
    </View>
  );
}

/* ─── Chips ───────────────────────────────────────────────────── */

export function Chip({ label, selected, onPress, icon, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[s.chip, selected && s.chipOn, disabled && { opacity: 0.5 }]}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      {!!icon && <Icon name={icon} size={16} color={selected ? '#FFFFFF' : BRAND.navy} />}
      <Text style={[s.chipText, selected && { color: '#FFFFFF' }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ─── Location ────────────────────────────────────────────────────
   value: { places: [{ roomId, beds: [bedId] }], area }.
   One or more rooms, OR a free-text place. The search stays open after each
   pick so more rooms can be added. Dorms get an optional bed row: no bed
   selected = the whole room. */

export function LocationPicker({ rooms = [], value, onChange }) {
  const { t } = useTranslation();
  const places = value?.places || [];
  const [mode, setMode] = useState(places.length || !value?.area ? 'room' : 'area');
  const [q, setQ] = useState('');
  const sorted = useMemo(() => sortRooms(rooms), [rooms]);
  const roomById = useMemo(() => Object.fromEntries(rooms.map(r => [r.id, r])), [rooms]);
  const picked = new Set(places.map(p => p.roomId));

  // Rooms appear only while searching, so the sheet never fills up with
  // every room in the building.
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return sorted
      .filter(r => !picked.has(r.id))
      .filter(r => String(r.name || '').toLowerCase().includes(needle))
      .slice(0, 12);
  }, [sorted, q, places]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPlaces = (next) => onChange({ places: next, area: '' });
  const addRoom = (id) => { setPlaces([...places, { roomId: id, beds: [] }]); setQ(''); };
  const removeRoom = (id) => setPlaces(places.filter(p => p.roomId !== id));
  const toggleBed = (roomId, bedId) => setPlaces(places.map((p) => {
    if (p.roomId !== roomId) return p;
    const beds = p.beds.includes(bedId) ? p.beds.filter(b => b !== bedId) : [...p.beds, bedId];
    return { ...p, beds };
  }));
  const wholeRoom = (roomId) => setPlaces(places.map(p => (p.roomId === roomId ? { ...p, beds: [] } : p)));

  const switchTo = (m) => {
    setMode(m);
    onChange(m === 'room'
      ? { places, area: '' }
      : { places: [], area: value?.area || '' });
  };

  const full = places.length >= 20;

  return (
    <View style={{ gap: 10 }}>
      <View style={s.segment}>
        {[
          { key: 'room', label: t('maint.whereRoom', 'A room'), icon: 'bed' },
          { key: 'area', label: t('maint.whereArea', 'Another place'), icon: 'location_on' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => switchTo(opt.key)}
            style={[s.segmentBtn, mode === opt.key && s.segmentBtnOn]}
            activeOpacity={0.8}
          >
            <Icon name={opt.icon} size={16} color={mode === opt.key ? BRAND.navy : NEUTRAL.text3} />
            <Text style={[s.segmentText, mode === opt.key && { color: BRAND.navy }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'room' ? (
        <>
          {/* Selected rooms, each with its beds when it's a dorm */}
          {places.map((p) => {
            const room = roomById[p.roomId];
            const beds = room?.beds || [];
            const isDorm = room?.type === 'dorm' && beds.length > 0;
            return (
              <View key={p.roomId} style={s.placeCard}>
                <View style={s.placeHead}>
                  <Icon name="bed" size={18} color={BRAND.navy} />
                  <Text style={s.placeName} numberOfLines={1}>{room?.name || '—'}</Text>
                  <TouchableOpacity
                    onPress={() => removeRoom(p.roomId)}
                    hitSlop={8}
                    accessibilityLabel={t('maint.removeRoom', 'Remove room')}
                  >
                    <Icon name="close" size={18} color={NEUTRAL.text3} />
                  </TouchableOpacity>
                </View>
                {isDorm && (
                  <>
                    <Text style={s.bedHint}>{t('maint.whichBeds', 'Which beds? (optional)')}</Text>
                    <View style={s.wrap}>
                      <Chip
                        label={t('maint.wholeRoom', 'Whole room')}
                        selected={p.beds.length === 0}
                        onPress={() => wholeRoom(p.roomId)}
                      />
                      {beds.map((b, i) => (
                        <Chip
                          key={b.id}
                          label={(b.name || b.label || String(i + 1)).trim()}
                          selected={p.beds.includes(b.id)}
                          onPress={() => toggleBed(p.roomId, b.id)}
                        />
                      ))}
                    </View>
                  </>
                )}
              </View>
            );
          })}

          {!full && (
            <View style={s.searchRow}>
              <Icon name="search" size={18} color={NEUTRAL.text3} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={places.length
                  ? t('maint.searchMoreRooms', 'Add another room…')
                  : t('maint.searchRoomType', 'Type a room name or number…')}
                placeholderTextColor={NEUTRAL.text4}
                autoCorrect={false}
                style={s.searchInput}
              />
            </View>
          )}
          {shown.length > 0 && (
            <View style={s.wrap}>
              {shown.map(r => (
                <Chip key={r.id} label={r.name} icon="add" onPress={() => addRoom(r.id)} />
              ))}
            </View>
          )}
          {!!q.trim() && shown.length === 0 && (
            <Text style={s.noMatch}>{t('maint.noRoomMatch', 'No room matches. Try "Another place".')}</Text>
          )}
        </>
      ) : (
        <TextInput
          value={value?.area || ''}
          onChangeText={v => onChange({ places: [], area: v })}
          placeholder={t('maint.areaPlaceholder', 'e.g. Laundry, terrace, kitchen')}
          placeholderTextColor={NEUTRAL.text4}
          maxLength={80}
          style={s.input}
        />
      )}
    </View>
  );
}

/* ─── Checklist ───────────────────────────────────────────────── */

export function ChecklistView({ items = [], onToggle, disabled }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 6 }}>
      {items.map(item => (
        <TouchableOpacity
          key={item.id}
          onPress={() => onToggle?.(item.id)}
          disabled={disabled || !onToggle}
          style={s.checkRow}
          activeOpacity={0.7}
        >
          <Icon
            name={item.done ? 'check_circle' : 'radio_button_unchecked'}
            size={22}
            color={item.done ? COLORS.success : NEUTRAL.text4}
          />
          <Text style={[s.checkText, item.done && s.checkTextDone]}>{item.text}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ChecklistEditor({ items = [], onAdd, onRemove }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const add = () => { onAdd(draft); setDraft(''); };
  return (
    <View style={{ gap: 8 }}>
      {items.map(item => (
        <View key={item.id} style={s.checkEditRow}>
          <Icon name="radio_button_unchecked" size={20} color={NEUTRAL.text4} />
          <Text style={[s.checkText, { flex: 1 }]}>{item.text}</Text>
          <TouchableOpacity onPress={() => onRemove(item.id)} hitSlop={8}>
            <Icon name="close" size={18} color={NEUTRAL.text3} />
          </TouchableOpacity>
        </View>
      ))}
      {items.length < 30 && (
        <View style={s.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder={t('maint.addStep', 'Add a step…')}
            placeholderTextColor={NEUTRAL.text4}
            maxLength={120}
            style={[s.input, { flex: 1 }]}
            returnKeyType="done"
          />
          <TouchableOpacity
            onPress={add}
            disabled={!draft.trim()}
            style={[s.addBtn, !draft.trim() && { opacity: 0.4 }]}
            activeOpacity={0.85}
          >
            <Icon name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ─── Photos ──────────────────────────────────────────────────── */

const dataUri = (b64) => `data:image/jpeg;base64,${b64}`;

export function PhotoStrip({ photos = [], onOpen, onAdd, adding }) {
  const { t } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {photos.map(p => (
        <TouchableOpacity key={p.id} onPress={() => onOpen(p.data, p)} activeOpacity={0.85}>
          <Image source={{ uri: dataUri(p.data) }} style={s.thumb} />
          {p.kind === 'fix' && (
            <View style={s.thumbBadge}>
              <Icon name="task_alt" size={12} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      ))}
      {!!onAdd && (
        <TouchableOpacity onPress={onAdd} disabled={adding} style={[s.thumb, s.thumbAdd]} activeOpacity={0.8}>
          <Icon name="add_a_photo" size={22} color={BRAND.navy} />
          <Text style={s.thumbAddText}>{adding ? '…' : t('maint.addPhotoShort', 'Photo')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

export function PhotoViewer({ base64, onClose, name, at }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await savePhoto(base64, { name, at, dialogTitle: t('maint.savePhoto', 'Save photo') });
    } catch (e) {
      Alert.alert(t('error', 'Error'), e?.message === 'share-unavailable'
        ? t('maint.saveUnavailable', "This device can't save or share files.")
        : (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!base64} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.lightbox}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {!!base64 && <Image source={{ uri: dataUri(base64) }} style={s.fullImage} resizeMode="contain" />}
        <TouchableOpacity onPress={onClose} style={s.lightboxClose} activeOpacity={0.8}
          accessibilityLabel={t('close', 'Close')}>
          <Icon name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        {!!base64 && (
          <TouchableOpacity onPress={save} disabled={saving} style={[s.lightboxSave, saving && { opacity: 0.6 }]} activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color={BRAND.navy} />
              : <Icon name="download" size={20} color={BRAND.navy} />}
            <Text style={s.lightboxSaveText}>{t('maint.savePhoto', 'Save photo')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

/* ─── Photo retention (30 days after finishing) ───────────────── */

/** Under a task's photos: when they'll be deleted, or that they were. */
export function PhotoRetentionNote({ task }) {
  const { t } = useTranslation();
  const purged = asMillis(task?.photosPurgedAt);
  const deleteAt = photosDeleteAt(task);
  if (!purged && !deleteAt) return null;
  const soon = deleteAt != null && deleteAt - Date.now() <= PHOTO_WARNING_DAYS * 24 * 3600 * 1000;
  return (
    <View style={[s.retention, soon && s.retentionSoon]}>
      <Icon name={purged && !deleteAt ? 'image' : 'schedule'} size={16} color={soon ? COLORS.accentDark : NEUTRAL.text3} />
      <Text style={[s.retentionText, soon && { color: NEUTRAL.text }]}>
        {deleteAt
          ? t('maint.photosDeleteOn', 'Photos are deleted on {{date}}, {{days}} days after the task was finished. Open a photo to save it.', {
            date: formatDay(deleteAt), days: PHOTO_RETENTION_DAYS,
          })
          : t('maint.photosDeleted', 'Photos were deleted on {{date}} to save space.', { date: formatDay(purged) })}
      </Text>
    </View>
  );
}

/** Top of the manager board: photos about to be deleted. */
export function PhotoCleanupBanner({ tasks, onShow }) {
  const { t } = useTranslation();
  const soon = useMemo(() => photosExpiringSoon(tasks), [tasks]);
  if (!soon.length) return null;
  const photos = soon.reduce((n, x) => n + (x.photoCount || 0), 0);
  return (
    <TouchableOpacity onPress={onShow ? () => onShow(soon) : undefined} disabled={!onShow} style={s.cleanupBanner} activeOpacity={0.85}>
      <Icon name="photo_library" size={20} color={COLORS.accentDark} />
      <Text style={s.cleanupText}>
        {t('maint.photosExpiring', '{{photos}} photos on {{count}} finished tasks will be deleted within {{days}} days. Open a task to save them.', {
          photos, count: soon.length, days: PHOTO_WARNING_DAYS,
        })}
      </Text>
      {!!onShow && <Icon name="chevron_right" size={20} color={NEUTRAL.text3} />}
    </TouchableOpacity>
  );
}

const formatDay = (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/* ─── Task card (phone lists) ─────────────────────────────────── */

export function TaskCard({ task, rooms, colors, nameOf, onPress, showAssignees, onRemove }) {
  const { t } = useTranslation();
  const finished = isFinished(task);
  const look = finished
    ? { accent: task.status === 'done' ? COLORS.success : NEUTRAL.text4 }
    : (PRIORITY_LOOK[task.priority] || PRIORITY_LOOK.medium);
  const doneSteps = (task.checklist || []).filter(i => i.done).length;
  const totalSteps = (task.checklist || []).length;
  return (
    <TouchableOpacity onPress={onPress} style={[s.card, { borderLeftColor: look.accent }, finished && s.cardFinished]} activeOpacity={0.85}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={s.cardWhere} numberOfLines={1}>{locationLabel(task, rooms).toUpperCase()}</Text>
        <Text style={[s.cardTitle, finished && s.cardTitleFinished]} numberOfLines={2}>{task.title}</Text>
        <View style={s.pillRow}>
          <StatusPill status={task.status} />
          {task.priority !== 'medium' && <PriorityPill priority={task.priority} />}
          <DuePill task={task} />
          {task.photoCount > 0 && (
            <Pill label={String(task.photoCount)} bg={NEUTRAL.slateChip} color={NEUTRAL.text2} icon="image" />
          )}
          {totalSteps > 0 && (
            <Pill label={`${doneSteps}/${totalSteps}`} bg={NEUTRAL.slateChip} color={NEUTRAL.text2} icon="checklist" />
          )}
        </View>
      </View>
      {showAssignees && <AvatarStack ids={task.assignees} colors={colors} nameOf={nameOf} />}
      {finished && onRemove ? (
        <TouchableOpacity
          onPress={(e) => { e?.stopPropagation?.(); onRemove(task); }}
          style={s.removeBtn}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityLabel={t('maint.remove', 'Remove')}
        >
          <Icon name="close" size={18} color={NEUTRAL.text2} />
        </TouchableOpacity>
      ) : (
        <Icon name="chevron_right" size={22} color={NEUTRAL.text4} />
      )}
    </TouchableOpacity>
  );
}

/* ─── Buttons ─────────────────────────────────────────────────── */

export function PrimaryButton({ label, icon, onPress, disabled, tone = 'navy', style }) {
  const bg = tone === 'success' ? COLORS.success : tone === 'danger' ? COLORS.danger : BRAND.navy;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[s.primaryBtn, { backgroundColor: bg }, disabled && { opacity: 0.5 }, style]}
      activeOpacity={0.9}
    >
      {!!icon && <Icon name={icon} size={20} color={tone === 'navy' ? BRAND.yellow : '#FFFFFF'} />}
      <Text style={s.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function GhostButton({ label, icon, onPress, disabled, danger, style }) {
  const c = danger ? COLORS.danger : BRAND.navy;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[s.ghostBtn, danger && { borderColor: COLORS.dangerBorder || COLORS.danger }, disabled && { opacity: 0.5 }, style]}
      activeOpacity={0.8}
    >
      {!!icon && <Icon name={icon} size={19} color={c} />}
      <Text style={[s.ghostBtnText, { color: c }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

export const maintStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.inputFill,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: NEUTRAL.text,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
});

const s = StyleSheet.create({
  overline: {
    fontFamily: FONTS.semiBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: NEUTRAL.text3,
    marginBottom: 6,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start',
  },
  pillText: { fontFamily: FONTS.medium, fontSize: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONTS.semiBold, color: '#FFFFFF' },
  avatarEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: NEUTRAL.text4 },
  avatarMore: { backgroundColor: NEUTRAL.slateChip, borderWidth: 2, borderColor: '#FFFFFF' },
  avatarMoreText: { fontFamily: FONTS.semiBold, fontSize: 11, color: NEUTRAL.text2 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  chipOn: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  chipText: { fontFamily: FONTS.medium, fontSize: 14, color: BRAND.navy },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  segment: { flexDirection: 'row', backgroundColor: NEUTRAL.slateChip, borderRadius: 12, padding: 3 },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10,
  },
  segmentBtnOn: { backgroundColor: NEUTRAL.surface },
  segmentText: { fontFamily: FONTS.medium, fontSize: 14, color: NEUTRAL.text3 },

  input: maintStyles.input,

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkEditRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: NEUTRAL.slateChip,
  },
  checkText: { fontFamily: FONTS.regular, fontSize: 15, color: NEUTRAL.text, flexShrink: 1 },
  checkTextDone: { color: NEUTRAL.text4, textDecorationLine: 'line-through' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: BRAND.navy,
    alignItems: 'center', justifyContent: 'center',
  },

  thumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: NEUTRAL.slateChip },
  thumbAdd: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: NEUTRAL.text4, backgroundColor: NEUTRAL.surface,
  },
  thumbAddText: { fontFamily: FONTS.medium, fontSize: 11.5, color: BRAND.navy },
  thumbBadge: {
    position: 'absolute', right: 4, bottom: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center',
  },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxSave: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: BRAND.yellow,
  },
  lightboxSaveText: { fontFamily: FONTS.semiBold, fontSize: 15, color: BRAND.navy },
  retention: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: NEUTRAL.slateChip,
  },
  retentionSoon: { backgroundColor: COLORS.warningLight },
  retentionText: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: NEUTRAL.text3 },
  cleanupBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 14, backgroundColor: COLORS.warningLight,
  },
  cleanupText: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19, color: NEUTRAL.text },
  fullImage: { width: '92%', height: '80%' },
  lightboxClose: {
    position: 'absolute', top: 48, right: 20, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: NEUTRAL.surface, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, borderLeftWidth: 4,
  },
  cardWhere: { fontFamily: FONTS.medium, fontSize: 11.5, letterSpacing: 0.5, color: NEUTRAL.text3 },
  cardTitle: { fontFamily: FONTS.semiBold, fontSize: 16, color: NEUTRAL.text },
  cardFinished: { backgroundColor: NEUTRAL.inputFill },
  cardTitleFinished: { color: NEUTRAL.text3 },
  removeBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: NEUTRAL.slateChip,
    alignItems: 'center', justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
    borderRadius: 12, paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1, paddingVertical: 11, fontFamily: FONTS.regular, fontSize: 15, color: NEUTRAL.text,
  },
  noMatch: { fontFamily: FONTS.regular, fontSize: 13.5, color: NEUTRAL.text3 },
  placeCard: {
    gap: 8, padding: 12, borderRadius: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  placeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  placeName: { flex: 1, fontFamily: FONTS.semiBold, fontSize: 15.5, color: NEUTRAL.text },
  bedHint: { fontFamily: FONTS.medium, fontSize: 12.5, color: NEUTRAL.text3 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, paddingHorizontal: 18, borderRadius: 26,
  },
  primaryBtnText: { fontFamily: FONTS.semiBold, fontSize: 15.5, color: '#FFFFFF' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48, paddingHorizontal: 16, borderRadius: 26,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  ghostBtnText: { fontFamily: FONTS.semiBold, fontSize: 15 },
});