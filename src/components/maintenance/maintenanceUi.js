// src/components/maintenance/maintenanceUi.js
//
// Non-visual helpers shared by every maintenance screen, native and web:
// colours/labels per status and priority, due-date wording, photo capture,
// and the create/edit form state.

import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { NEUTRAL, STATUS } from '../../theme/tokens';
import { COLORS } from '../../theme/colors';
import {
  MAX_PHOTO_CHARS, ACTIVE_STATUSES, normaliseChecklist, placesOf,
} from '../../hooks/useMaintenance';
import { asMillis } from '../../utils/maintenanceSchedule';

/* ─── Looks ───────────────────────────────────────────────────── */

const pick = (s, fallbackText) => ({ bg: s?.bg || NEUTRAL.slateChip, text: s?.text || fallbackText });

export const STATUS_LOOK = {
  reported:    { ...pick(STATUS.dirty, COLORS.accentDark),  icon: 'flag' },
  open:        { ...pick(STATUS.cleaned, COLORS.info),      icon: 'radio_button_unchecked' },
  in_progress: { ...pick(STATUS.waiting, COLORS.accentDark), icon: 'construction' },
  on_hold:     { ...pick(STATUS.late, COLORS.accentDark),   icon: 'pause_circle' },
  done:        { ...pick(STATUS.inspected, COLORS.success), icon: 'task_alt' },
  dismissed:   { bg: NEUTRAL.slateChip, text: NEUTRAL.text3, icon: 'block' },
};

// `accent` is the card's left border, like Flexkeeping's coloured edge.
export const PRIORITY_LOOK = {
  low:    { bg: NEUTRAL.slateChip, text: NEUTRAL.text3, accent: NEUTRAL.text4, icon: 'south' },
  medium: { ...pick(STATUS.cleaned, COLORS.info), accent: COLORS.info, icon: 'remove' },
  high:   { ...pick(STATUS.waiting, COLORS.accentDark), accent: COLORS.accent, icon: 'north' },
  urgent: { ...pick(STATUS.error, COLORS.danger), accent: COLORS.danger, icon: 'priority_high' },
};

const STATUS_DEFAULT = {
  reported: 'To review', open: 'To do', in_progress: 'In progress',
  on_hold: 'Waiting', done: 'Done', dismissed: 'Dismissed',
};
const PRIORITY_DEFAULT = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

export const statusLabel = (t, s) => t(`maint.status.${s}`, STATUS_DEFAULT[s] || s);
export const priorityLabel = (t, p) => t(`maint.priority.${p}`, PRIORITY_DEFAULT[p] || p);

/* ─── Time ────────────────────────────────────────────────────── */

/** { overdue, label } — "+20 h" when late (Flexkeeping style), "in 3 h" otherwise. */
export function dueInfo(task, t, now = Date.now()) {
  const dueMs = asMillis(task?.dueAt);
  if (dueMs == null || !ACTIVE_STATUSES.includes(task.status)) return null;
  const diff = dueMs - now;
  const abs = Math.abs(diff);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const span = abs < 3600000
    ? t('maint.underAnHour', '<1 h')
    : hours < 48 ? `${hours} h` : `${days} ${t('maint.daysShort', 'd')}`;
  if (diff < 0) return { overdue: true, label: `+${span}` };
  return { overdue: false, label: t('maint.dueIn', 'in {{span}}', { span }) };
}

export function formatWhen(value) {
  const ms = asMillis(value);
  if (!ms) return '';
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function dueOptions(t) {
  const at = (days, hour) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };
  return [
    { key: 'none',     label: t('maint.dueNone', 'No date'),     value: null },
    { key: 'today',    label: t('maint.dueToday', 'Today'),      value: at(0, 18) },
    { key: 'tomorrow', label: t('maint.dueTomorrow', 'Tomorrow'), value: at(1, 12) },
    { key: '3d',       label: t('maint.due3Days', 'In 3 days'),  value: at(3, 12) },
    { key: 'week',     label: t('maint.dueWeek', 'In a week'),   value: at(7, 12) },
  ];
}

/** Where "Pick date & time" starts when there's no date yet: tomorrow 09:00. */
export function defaultCustomDue(now = Date.now()) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

/** Earliest pickable day: today — or the current due date if it's already past
    (editing an overdue task mustn't silently move its date). */
export function minimumDueDate(value, now = Date.now()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const ms = asMillis(value);
  return new Date(ms != null && ms < today.getTime() ? ms : today.getTime());
}

const pad2 = (n) => String(n).padStart(2, '0');
/** millis → "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">. */
export function toLocalInput(value) {
  const ms = asMillis(value);
  if (ms == null) return '';
  const x = new Date(ms);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}T${pad2(x.getHours())}:${pad2(x.getMinutes())}`;
}

/** "Shower drain blocked" + time → "hostelkeep-shower-drain-blocked-2026-10-12-0930.jpg" */
export function photoFileName(name, at) {
  const slug = String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const ms = asMillis(at) ?? Date.now();
  const stamp = toLocalInput(ms).replace('T', '-').replace(':', '');
  return `hostelkeep-${slug ? `${slug}-` : ''}${stamp}.jpg`;
}

/* ─── Confirmations ──────────────────────────────────────────────
   ask() resolves true/false on every platform. On native it's Alert.alert;
   on the web it's window.confirm, because a buttons-Alert on the web may
   never call onPress — which made "Mark fixed" do nothing in a browser. */

export function ask({ title, message, confirmLabel, cancelLabel = 'Cancel', destructive = false }) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message || ''}`.trim()));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/** "Task completed?" — every route to 'done' on a phone goes through this. */
export async function confirmDone(t, task, onYes) {
  const ok = await ask({
    title: t('maint.confirmDoneTitle', 'Task completed?'),
    message: t('maint.confirmDoneBody', '"{{title}}" will be marked as fixed and the manager notified.', { title: task?.title || '' }),
    confirmLabel: t('maint.confirmDoneYes', "Yes, it's fixed"),
    cancelLabel: t('cancel', 'Cancel'),
  });
  if (ok) onYes();
}

/* ─── Rooms ───────────────────────────────────────────────────── */

export const sortRooms = (rooms = []) =>
  [...rooms].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true }));

/* ─── Photo ───────────────────────────────────────────────────────
   Same pipeline as the extra-room request: camera → 1280 px → JPEG 0.6 →
   base64. Native is camera-only (media-library permissions are blocked in
   app.json); the web build opens a file picker instead.
   Throws Error('camera-permission') or Error('photo-too-large'). */

/** One picked image → resized JPEG base64 (≤1280 px), or null if too large. */
async function shrink(asset) {
  const { uri, width = 0, height = 0 } = asset;
  const resize = width >= height ? { width: 1280 } : { height: 1280 };
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize }], {
    compress: 0.6,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!out?.base64 || out.base64.length >= MAX_PHOTO_CHARS) return null;
  return out.base64;
}

/** Camera (one photo) or gallery (up to `limit`). Resolves to a list of
    base64 JPEGs, empty if cancelled. The gallery uses the system photo
    picker, which needs no storage permission on Android 13+ or iOS. */
export async function pickPhotos({ source = 'camera', limit = 1 } = {}) {
  const max = Math.max(1, limit);
  let result;
  if (Platform.OS === 'web' || source === 'library') {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 1,
      allowsMultipleSelection: max > 1, selectionLimit: max,
    });
  } else {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') throw new Error('camera-permission');
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  }
  if (result.canceled || !result.assets?.length) return [];

  const out = [];
  let tooLarge = 0;
  for (const asset of result.assets.slice(0, max)) {
    // eslint-disable-next-line no-await-in-loop
    const b64 = await shrink(asset);
    if (b64) out.push(b64); else tooLarge += 1;
  }
  if (!out.length && tooLarge) throw new Error('photo-too-large');
  return out;
}

/** One photo: the camera on a phone, a file in a browser. */
export async function capturePhoto() {
  const [b64] = await pickPhotos({ source: 'camera', limit: 1 });
  return b64 || null;
}

/** Phone: "Take a photo" or "Choose from gallery". Web: always the file picker. */
export function choosePhotoSource(t) {
  if (Platform.OS === 'web') return Promise.resolve('library');
  return new Promise((resolve) => {
    Alert.alert(t('maint.addPhotoTitle', 'Add a photo'), undefined, [
      { text: t('cancel', 'Cancel'), style: 'cancel', onPress: () => resolve(null) },
      { text: t('maint.fromGallery', 'Gallery'), onPress: () => resolve('library') },
      { text: t('maint.fromCamera', 'Camera'), onPress: () => resolve('camera') },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

export function photoErrorMessage(e, t) {
  if (e?.message === 'camera-permission') return t('maint.cameraPermission', 'Camera permission is required.');
  if (e?.message === 'photo-too-large') {
    return t('appPhotoTooLarge', 'That photo is too large. Try again a little further away.');
  }
  return e?.message || t('error', 'Error');
}

/* ─── Form state (create / edit / triage) ─────────────────────────
   Mount the form with key={task?.id || 'new'} so state resets per task. */

export function useTaskForm(task) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  // { places: [{ roomId, beds }], area } — rooms OR a free-text place.
  const [location, setLocation] = useState({ places: placesOf(task), area: task?.area || '' });
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueAt, setDueAt] = useState(task?.dueAt || null);
  const [assignees, setAssignees] = useState(task?.assignees || []);
  const [checklist, setChecklist] = useState(task?.checklist || []);
  const [photos, setPhotos] = useState([]); // create only: base64 JPEGs, ≤ MAX_NEW_PHOTOS

  const toggleAssignee = useCallback((id) => {
    setAssignees(prev => (prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id].slice(0, 6)));
  }, []);

  const addItem = useCallback((text) => {
    const clean = (text || '').trim();
    if (!clean) return;
    setChecklist(prev => normaliseChecklist([...prev, { text: clean }]));
  }, []);

  const removeItem = useCallback((id) => {
    setChecklist(prev => prev.filter(i => i.id !== id));
  }, []);

  const values = {
    title,
    description,
    places: location.places,
    area: location.places.length ? null : location.area,
    priority,
    dueAt,
    assignees,
    checklist,
  };

  return {
    title, setTitle,
    description, setDescription,
    location, setLocation,
    priority, setPriority,
    dueAt, setDueAt,
    assignees, toggleAssignee,
    checklist, addItem, removeItem,
    photos, setPhotos,
    values,
    valid: title.trim().length > 0,
  };
}