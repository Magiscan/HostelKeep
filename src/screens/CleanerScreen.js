// src/screens/CleanerScreen.js
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal,
  Pressable, Image, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { usePushRegistration } from '../hooks/usePushRegistration';
import AccountScreen from './AccountScreen';
// Imported from the concrete modules rather than the barrel file. A directory
// import ('../components/brand') needs a file named exactly `index.js`; on a
// case-insensitive filesystem a stray `Index.js` appears to work locally and
// then fails the EAS build. These paths can't drift.
import {
  HousekeeperHeader, FloorHeader, RoomCard, BedGrid,
  ManagerNote, RoomActionButton,
} from '../components/brand/RoomCard';
import { Fab, Confetti, ToastHost, useToast } from '../components/brand/Overlays';
import { COLORS } from '../theme/colors';
import { FONTS, DISPLAY, FONT_SIZE } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { RADIUS } from '../theme/radius';
import { SHADOW } from '../theme/shadows';
import { ProfileMenu } from '../components/brand/Sheets';
import { useAvatarPicker } from '../hooks/useAvatarPicker';
import { AvatarPickerSheet, LanguageSheet } from '../components/brand/Pickers';

/**
 * HostelKeep 2.0 cleaner screen.
 *
 * The state machine is unchanged from 1.x: bed states, editing vs cleaned,
 * clean-all, undo, extra time and extra-room requests all behave identically.
 * Only the presentation moved to the brand primitives.
 *
 * Two things that were broken in the first pass and are fixed here:
 *  1. HousekeeperHeader was rendering with no identity props, so the greeting,
 *     hostel name and avatar were invisible — and with the avatar gone there
 *     was no way to open the profile sheet or sign out.
 *  2. Icon names were Ionicons-style ("checkmark-circle-outline"), but
 *     components/Icon.js renders the Material family. Wrong-family names log a
 *     warning and draw nothing. Everything below uses Material Symbols names.
 */

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

const EXTRA_STEP = 5;   // minutes per stepper tap

/* Internal bed state → design token + translation key.
   The token set is fixed by the handoff; the t() keys are the ones already in
   src/i18n.js, so no new translations are required. */
const BED_LABEL_KEY = {
  dirty:     'bedState_clean',
  cleaned:   'cleaned',
  inspected: 'bedState_noone',
  early:     'bedState_early',
  late:      'bedState_late',
  stayover:  'bedState_stayover',
  common:    'common',
};

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'goodMorning';
  if (h < 18) return 'goodAfternoon';
  return 'goodEvening';
}

/* ─── Kebab menu (cleaned dorm rooms) ─────────────────────────── */
function KebabMenu({ onEditBeds, onUndo, t }) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={styles.iconBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="more_vert" size={22} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable onPress={() => {}} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => { setVisible(false); onEditBeds(); }}
              activeOpacity={0.7}
            >
              <Icon name="edit" size={22} color={COLORS.primary} />
              <Text style={styles.sheetRowText}>{t('cleanerScreen.editBeds')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => { setVisible(false); onUndo(); }}
              activeOpacity={0.7}
            >
              <Icon name="refresh" size={22} color={COLORS.danger} />
              <Text style={[styles.sheetRowText, { color: COLORS.danger }]}>{t('undoRoom')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Multiline note field, styled to match the 2.0 inputs. */
function NoteInput({ value, onChangeText, onBlur, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); onBlur && onBlur(); }}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      multiline
      style={[styles.noteInput, focused && { borderColor: COLORS.accent }]}
    />
  );
}

/* ─── Cleaner room ────────────────────────────────────────────── */
function CleanerRoom({ room, status, onUpdate, t }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(status.notes || '');
  const [extraEnabled, setExtraEnabled] = useState(!!status.extraTime);
  const [extraMinutes, setExtraMinutes] = useState(Number(status.extraTime) || 0);

  const isDorm = room.type === 'dorm';
  const beds = room.beds || [];
  const bedStatus = status.bedStatus || {};
  const assignmentBedStatus = status.assignmentBedStatus || {};
  const managerNotes = status.managerNotes;
  const commonOnly = status.commonOnly || false;
  const assignmentAttributes = status.assignmentAttributes || {};
  const isExtra = status.extraCleaning === true;
  const isEarly = status.earlyCheckIn === true;
  const isLate = status.lateCheckOut === true;

  const hasEarlyBed = isDorm && beds.some(b => (assignmentBedStatus[b.id] || {}).status === 'early');
  const hasLateBed = isDorm && beds.some(b => (assignmentBedStatus[b.id] || {}).status === 'late');
  const showEarly = isEarly || hasEarlyBed;
  const showLate = isLate || hasLateBed;

  // ── Logic below is byte-for-byte the 1.x behaviour ──
  const getEffectiveBedState = (bedId) => {
    const assignment = assignmentBedStatus[bedId] || { status: 'clean', reason: 'clean' };
    if (commonOnly) return { ...assignment, status: 'common' };
    if (assignment.status === 'early' || assignment.status === 'late') {
      const cleanedByCleaner = bedStatus[bedId]?.status === 'cleaned';
      return { ...assignment, status: cleanedByCleaner ? 'cleaned' : 'pending' };
    }
    if (assignment.status === 'stayover' || assignment.status === 'noone') return assignment;
    return { ...assignment, status: bedStatus[bedId]?.status || 'pending' };
  };

  const allBedsDone = isDorm && beds.length > 0
    ? beds.every(b => getEffectiveBedState(b.id).status !== 'pending')
    : true;

  const cleaned = isDorm ? allBedsDone && status.cleaned : !!status.cleaned;
  const canMarkCleaned = allBedsDone || !isDorm;

  // 6px left edge: yellow in progress → blue beds done → green room complete.
  const accent = cleaned
    ? 'complete'
    : (isDorm && allBedsDone ? 'bedsDone' : 'progress');

  const payload = (extra = {}) => ({
    notes: note,
    extraTime: extraEnabled ? extraMinutes : 0,
    ...extra,
  });

  const handleOpen = () => {
    setOpen(!open);
    if (!cleaned && !open) setEditing(true);
    if (cleaned) setEditing(false);
  };

  const toggleBed = (bedId) => {
    const assignment = assignmentBedStatus[bedId] || { status: 'clean', reason: 'clean' };
    if (assignment.status === 'stayover' || assignment.status === 'noone') return;
    if (cleaned && !editing) { startEditing(); return; }
    if (!editing) return;
    const current = bedStatus[bedId]?.status || 'pending';
    const nextStatus = current === 'cleaned' ? 'pending' : 'cleaned';
    onUpdate(payload({
      bedStatus: { ...bedStatus, [bedId]: { status: nextStatus } },
      cleaned: false,
    }));
  };

  const cleanAllBeds = () => {
    if (!editing) return;
    const newBS = { ...bedStatus };
    beds.forEach(b => {
      const assignment = assignmentBedStatus[b.id] || { status: 'clean', reason: 'clean' };
      if (assignment.status === 'stayover' || assignment.status === 'noone') return;
      newBS[b.id] = { status: 'cleaned' };
    });
    onUpdate(payload({ bedStatus: newBS, cleaned: false }));
  };

  const markCleaned = () => {
    if (!canMarkCleaned) {
      Alert.alert(t('bedsNotReady'), t('finishBedsFirst'));
      return;
    }
    if (isDorm) {
      const newBS = { ...bedStatus };
      beds.forEach(b => {
        const state = getEffectiveBedState(b.id);
        newBS[b.id] = { status: state.status === 'pending' ? 'cleaned' : state.status };
      });
      onUpdate(payload({ cleaned: true, bedStatus: newBS }));
    } else {
      onUpdate(payload({ cleaned: true }));
    }
    setOpen(true);
    setEditing(false);
  };

  const undo = () => {
    if (isDorm) {
      const newBS = {};
      beds.forEach(b => {
        const assignment = assignmentBedStatus[b.id] || { status: 'clean', reason: 'clean' };
        newBS[b.id] = (assignment.status === 'stayover' || assignment.status === 'noone')
          ? { status: assignment.status }
          : { status: 'pending' };
      });
      onUpdate({ cleaned: false, bedStatus: newBS });
    } else {
      onUpdate({ cleaned: false });
    }
    setEditing(true);
  };

  const startEditing = () => {
    onUpdate(payload({ cleaned: false, bedStatus }));
    setOpen(true);
    setEditing(true);
  };

  const adjustExtra = (delta) => {
    const next = Math.max(0, extraMinutes + delta);
    setExtraMinutes(next);
    onUpdate(payload({ extraTime: next }));
  };

  // Presentation mapping only — the cycle logic above is untouched.
  const mapBedStatus = (bedId) => {
    const state = getEffectiveBedState(bedId);
    if (state.status === 'cleaned')  return 'cleaned';
    if (state.status === 'common')   return 'common';
    if (state.status === 'stayover') return 'stayover';
    if (state.status === 'noone')    return 'inspected';
    if (state.reason === 'early' || state.status === 'early') return 'early';
    if (state.reason === 'late'  || state.status === 'late')  return 'late';
    return 'dirty';
  };

  const bedItems = beds.map((b, i) => ({
    ...b,
    status: mapBedStatus(b.id),
    // BedChip shows a single Fredoka glyph; room.beds store a full name.
    letter: (b.name || b.label || String(i + 1)).trim().slice(-2),
  }));

  const doneBeds = isDorm
    ? beds.filter(b => getEffectiveBedState(b.id).status === 'cleaned').length
    : 0;

  const bedLabel = (b) => t(BED_LABEL_KEY[b.status] || 'bedState_clean');

  return (
    <RoomCard accent={accent}>
      {/* Header row */}
      <TouchableOpacity onPress={handleOpen} activeOpacity={0.7} style={styles.roomHeader}>
        <View style={styles.roomHeaderLeft}>
          <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>

          <View style={styles.tagRow}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>
                {isDorm
                  ? `${t('dormitory')} · ${doneBeds}/${beds.length}`
                  : t('private')}
              </Text>
            </View>

            {isExtra && (
              <View style={[styles.tag, { backgroundColor: COLORS.successLight }]}>
                <Text style={[styles.tagText, { color: COLORS.successDark }]}>{t('extra')}</Text>
              </View>
            )}
            {showEarly && (
              <View style={[styles.tag, { backgroundColor: '#FFE4EC' }]}>
                <Text style={[styles.tagText, { color: '#9F1239' }]}>{t('earlyCheckInFlag')}</Text>
              </View>
            )}
            {showLate && (
              <View style={[styles.tag, { backgroundColor: '#EDE9FE' }]}>
                <Text style={[styles.tagText, { color: '#5B21B6' }]}>{t('lateCheckOutFlag')}</Text>
              </View>
            )}
            {extraEnabled && extraMinutes > 0 && (
              <View style={[styles.tag, { backgroundColor: COLORS.infoLight }]}>
                <Text style={[styles.tagText, { color: COLORS.info }]}>+{extraMinutes}m</Text>
              </View>
            )}
            {!!managerNotes && (
              <View style={[styles.tag, styles.tagWithIcon, { backgroundColor: COLORS.infoLight }]}>
                <Icon name="campaign" size={14} color={COLORS.info} />
                <Text style={[styles.tagText, { color: COLORS.info }]}>{t('note')}</Text>
              </View>
            )}
          </View>
        </View>

        {cleaned ? (
          <Icon name="check_circle" size={26} color={COLORS.success} />
        ) : (
          <Icon name={open ? 'expand_less' : 'expand_more'} size={26} color={COLORS.textMuted} />
        )}
      </TouchableOpacity>

      {/* Cleaned-state controls sit outside the collapse so they stay reachable */}
      {cleaned && (
        <View style={styles.doneRow}>
          {!!status.notes && (
            <Text style={styles.savedNote} numberOfLines={2}>“{status.notes}”</Text>
          )}
          {status.extraTime > 0 && (
            <Text style={styles.savedNote}>{t('extraTimeValue', { minutes: status.extraTime })}</Text>
          )}
          <View style={{ flex: 1 }} />
          {isDorm
            ? <KebabMenu onEditBeds={startEditing} onUndo={undo} t={t} />
            : (
              <TouchableOpacity onPress={undo} style={styles.undoBtn} activeOpacity={0.7}>
                <Text style={styles.undoText}>{t('undo')}</Text>
              </TouchableOpacity>
            )}
        </View>
      )}

      {open && (
        <View style={styles.roomBody}>
          {!!managerNotes && (
            <ManagerNote note={managerNotes} overline={t('note').toUpperCase()} />
          )}

          {commonOnly && (
            <View style={[styles.banner, cleaned && { backgroundColor: COLORS.successLight }]}>
              <Icon
                name={cleaned ? 'check_circle' : 'home'}
                size={20}
                color={cleaned ? COLORS.success : COLORS.primary}
              />
              <Text style={[styles.bannerText, cleaned && { color: COLORS.successDark }]}>
                {cleaned ? t('commonCleaned') : t('commonOnlyBanner')}
              </Text>
            </View>
          )}

          {/* Bed grid */}
          {isDorm && beds.length > 0 && !commonOnly && (
            <View style={{ gap: SPACING.sm }}>
              <BedGrid
                beds={bedItems}
                onBedPress={(bed) => toggleBed(bed.id)}
                labelFor={bedLabel}
              />

              {editing && beds.some(b => {
                const a = assignmentBedStatus[b.id] || { status: 'clean' };
                return a.status === 'clean' || a.status === 'early' || a.status === 'late';
              }) && (
                <TouchableOpacity style={styles.outlineBtn} onPress={cleanAllBeds} activeOpacity={0.8}>
                  <Icon name="done_all" size={22} color={COLORS.primary} />
                  <Text style={styles.outlineBtnText}>{t('cleanerScreen.cleanAll')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Private room features */}
          {!isDorm && Object.keys(assignmentAttributes).length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={styles.blockLabel}>{t('roomFeatures')}</Text>
              {Object.entries(assignmentAttributes).filter(([, v]) => v).map(([attr]) => (
                <View key={attr} style={styles.attrRow}>
                  <Icon name="check_circle" size={20} color={COLORS.success} />
                  <Text style={styles.attrText}>{attr}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Extra time — steppers, not a keyboard */}
          {!cleaned && (
            <View style={{ gap: SPACING.xs }}>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => {
                  const next = !extraEnabled;
                  setExtraEnabled(next);
                  if (!next) { setExtraMinutes(0); onUpdate(payload({ extraTime: 0 })); }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, extraEnabled && styles.checkboxOn]}>
                  {extraEnabled && <Icon name="check" size={18} color={COLORS.primary} />}
                </View>
                <Text style={styles.checkLabel}>{t('extraTime')}</Text>
              </TouchableOpacity>

              {extraEnabled && (
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => adjustExtra(-EXTRA_STEP)}
                    disabled={extraMinutes === 0}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name="remove"
                      size={24}
                      color={extraMinutes === 0 ? COLORS.textMuted : COLORS.primary}
                    />
                  </TouchableOpacity>
                  <View style={styles.stepperValue}>
                    <Text style={styles.stepperNum}>{extraMinutes}</Text>
                    <Text style={styles.stepperUnit}>{t('cleanerScreen.minutes')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => adjustExtra(EXTRA_STEP)}
                    activeOpacity={0.7}
                  >
                    <Icon name="add" size={24} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          {!cleaned && (
            <View style={{ gap: 6 }}>
              <Text style={styles.blockLabel}>{t('notesOptional')}</Text>
              <NoteInput
                value={note}
                onChangeText={setNote}
                onBlur={() => onUpdate(payload({}))}
                placeholder={t('cleanerScreen.notesPlaceholder')}
              />
            </View>
          )}

          {/* Primary action */}
          {!cleaned && (
            <RoomActionButton
              state={canMarkCleaned ? 'ready' : 'blocked'}
              onPress={markCleaned}
              label={canMarkCleaned ? t('markAsCleaned') : t('finishBedsFirst')}
            />
          )}
        </View>
      )}
    </RoomCard>
  );
}

/* ─── Request extra room ──────────────────────────────────────── */
function RequestExtraModal({ visible, rooms, floors, roomStatus, extraRequests, onClose, onRequest, t }) {
  const [loadingRoomId, setLoadingRoomId] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageUri, setImageUri] = useState(null);

  const sortedFloors = useMemo(() => {
    if (!floors) return [];
    return [...floors].sort((a, b) => {
      const order = (name) => {
        if (name === 'Ground Floor') return 0;
        if (name === 'Garage') return 999;
        const num = parseInt(name, 10);
        return isNaN(num) ? 500 : num;
      };
      return order(a.name) - order(b.name);
    });
  }, [floors]);

  // Any existing request blocks a new one: the document ID is the room ID, so a
  // second setDoc would be an update, which needs 'approve'.
  const requestedRoomIds = (extraRequests || []).map(r => r.id);
  const eligibleRooms = (rooms || []).filter(
    r => !r.assignedTo && !(roomStatus?.[r.id]?.extraCleaning) && !requestedRoomIds.includes(r.id),
  );

  const handlePress = async (room) => {
    setLoadingRoomId(room.id);
    try {
      await onRequest(room, imageBase64);
      setImageUri(null);
      setImageBase64(null);
      onClose();
    } catch (e) {
      Alert.alert(t('error'), e.message);
    } finally {
      setLoadingRoomId(null);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('error'), 'Camera permission is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.3,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0].base64) {
      setImageBase64(result.assets[0].base64);
      setImageUri(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.sheet, { maxHeight: '88%' }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('requestExtra')}</Text>
          <Text style={styles.sheetSub}>{t('cleanerScreen.requestExtraDescription')}</Text>

          <TouchableOpacity style={styles.outlineBtn} onPress={pickImage} activeOpacity={0.8}>
            <Icon name="photo_camera" size={22} color={COLORS.primary} />
            <Text style={styles.outlineBtnText}>
              {imageUri ? t('cleanerScreen.changePhoto') : t('cleanerScreen.addPhoto')}
            </Text>
          </TouchableOpacity>

          {imageUri && (
            <View style={styles.preview}>
              <Image source={{ uri: imageUri }} style={styles.previewImg} />
              <TouchableOpacity
                style={styles.previewRemove}
                onPress={() => { setImageUri(null); setImageBase64(null); }}
              >
                <Icon name="cancel" size={26} color={COLORS.danger} filled />
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={{ marginTop: SPACING.xs }} nestedScrollEnabled>
            {sortedFloors.map(floor => {
              const floorRooms = eligibleRooms.filter(r => r.floorId === floor.id);
              if (!floorRooms.length) return null;
              return (
                <View key={floor.id}>
                  <Text style={styles.floorLabel}>{floor.name}</Text>
                  {floorRooms.map(room => {
                    const isLoading = loadingRoomId === room.id;
                    return (
                      <TouchableOpacity
                        key={room.id}
                        style={styles.pickRow}
                        onPress={() => handlePress(room)}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.pickRowText}>{room.name}</Text>
                        <Text style={styles.pickRowMeta}>
                          {room.type === 'private' ? t('private') : t('dormitory')}
                        </Text>
                        <Icon
                          name={isLoading ? 'hourglass_empty' : 'send'}
                          size={22}
                          color={COLORS.accent}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
            {eligibleRooms.length === 0 && (
              <Text style={styles.emptyHint}>{t('noResults')}</Text>
            )}
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn} activeOpacity={0.85}>
            <Text style={styles.sheetCloseText}>{t('close')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Screen ──────────────────────────────────────────────────── */
export default function CleanerScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateProfile } = useAuth();
  const {
    hostel, floors = [], rooms = [], roomStatus = {}, updateRoomStatus,
    requestExtraRoom, cancelExtraRoomRequest, extraRequests = [],
  } = useApp();
  usePushRegistration(user);

  const toast = useToast();

  const avatar = useAvatarPicker();
  const [showLang, setShowLang] = useState(false);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [cancelRequestId, setCancelRequestId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [expandedFloors, setExpandedFloors] = useState({});

  const myRooms = rooms.filter(r => r.assignedTo === user.uid);

  // Priority sort: early → early+late → neither → late. Unchanged.
  const sortedRooms = useMemo(() => {
    const numericName = (name) => {
      const num = parseInt(name, 10);
      return isNaN(num) ? name : num;
    };
    return [...myRooms].sort((a, b) => {
      const sA = roomStatus[a.id] || {};
      const sB = roomStatus[b.id] || {};
      const aA = sA.assignmentBedStatus || {};
      const aB = sB.assignmentBedStatus || {};
      const isEarlyA = sA.earlyCheckIn === true || (a.beds || []).some(x => (aA[x.id] || {}).status === 'early');
      const isEarlyB = sB.earlyCheckIn === true || (b.beds || []).some(x => (aB[x.id] || {}).status === 'early');
      const isLateA = sA.lateCheckOut === true || (a.beds || []).some(x => (aA[x.id] || {}).status === 'late');
      const isLateB = sB.lateCheckOut === true || (b.beds || []).some(x => (aB[x.id] || {}).status === 'late');
      const cat = (early, late) => (early && !late ? 0 : early && late ? 1 : !early && !late ? 2 : 3);
      const catA = cat(isEarlyA, isLateA);
      const catB = cat(isEarlyB, isLateB);
      if (catA !== catB) return catA - catB;
      const nA = numericName(a.name);
      const nB = numericName(b.name);
      if (typeof nA === 'number' && typeof nB === 'number') return nA - nB;
      if (typeof nA === 'number') return -1;
      if (typeof nB === 'number') return 1;
      return String(nA).localeCompare(String(nB));
    });
  }, [myRooms, roomStatus]);

  const regularRooms = sortedRooms.filter(r => !roomStatus[r.id]?.extraCleaning);
  const extraRooms = sortedRooms.filter(r => roomStatus[r.id]?.extraCleaning === true);

  const cleanedCount = myRooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const total = myRooms.length;
  const progress = total ? cleanedCount / total : 0;

  const pendingRequests = extraRequests.filter(
    req => req.cleanerId === user.uid && req.status === 'pending',
  );

  const rejectedRequests = extraRequests.filter(
    req => req.cleanerId === user.uid && req.status === 'rejected',
  );

  const sortedFloors = useMemo(() => {
    if (!floors) return [];
    return [...floors].sort((a, b) => {
      const order = (name) => {
        if (name === 'Ground Floor') return 0;
        if (name === 'Garage') return 999;
        const num = parseInt(name, 10);
        return isNaN(num) ? 500 : num;
      };
      return order(a.name) - order(b.name);
    });
  }, [floors]);

  const toggleFloor = (floorId) =>
    setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));

  const handleRequestExtra = async (room, imageBase64) => {
    try {
      await requestExtraRoom(room.id, user.uid, imageBase64 || null);
      toast.show(t('requestSent'));
    } catch (e) {
      Alert.alert(t('error'), e.message);
    }
  };

  const pickProfilePhoto = () => avatar.open({
    canRemove: !!user.photoUri,
    onPicked: (uri) => updateProfile({ photoUri: uri }),
    onRemove: () => updateProfile({ photoUri: null }),
  });

  const initials = (user.username || '?').trim().charAt(0).toUpperCase();

  const renderFloorGroup = (list) => sortedFloors.map(floor => {
    const floorRooms = list.filter(r => r.floorId === floor.id);
    if (!floorRooms.length) return null;
    const isExpanded = expandedFloors[floor.id] !== false;
    const doneHere = floorRooms.filter(r => roomStatus[r.id]?.cleaned).length;
    return (
      <View key={floor.id}>
        <FloorHeader
          title={floor.name}
          done={doneHere}
          total={floorRooms.length}
          expanded={isExpanded}
          onPress={() => toggleFloor(floor.id)}
        />

        {isExpanded && (
          <View>
            {floorRooms.map(room => (
              <CleanerRoom
                key={room.id}
                room={room}
                status={roomStatus[room.id] || {}}
                onUpdate={upd => {
                  updateRoomStatus(room.id, { ...roomStatus[room.id], ...upd })
                    .catch(() => toast.show(
                      t('saveFailed') || "Couldn't save — check your connection and try again."
                    ));
                }}
                t={t}
              />
            ))}
          </View>
        )}
      </View>
    );
  });

  // Account takeover. A cleaner has no "manager stack" to push a screen onto —
  // CleanerScreen is the whole world they live in — so the account screen is
  // rendered in place of the room list, with its own back bar.
  if (showAccount) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.accountBar}>
          <TouchableOpacity
            onPress={() => setShowAccount(false)}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="arrow_back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('account') || 'Account'}</Text>
        </View>
        <AccountScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────────
          Outside the ScrollView, exactly as in the prototype: the strip is
          `flex:none` above a `flex:1` scroll area, so it stays put while the
          room list moves under it. */}
      <HousekeeperHeader
        greeting={`${t(greetingKey(), { defaultValue: t('hi') })}, ${user.username}`}
        hostelName={hostel?.name}
        name={user.username}
        photoUri={user.photoUri}
        onAvatarPress={() => setShowProfile(true)}
        done={cleanedCount}
        total={total}
        label={t('roomsCompleted', {
          done: cleanedCount,
          total,
          defaultValue: `${cleanedCount} ${t('of')} ${total}`,
        })}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Pending requests ── */}
        {pendingRequests.length > 0 && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>{t('cleanerScreen.pendingRequests')}</Text>
            <Text style={styles.pendingSub}>{t('cleanerScreen.waitingApproval')}</Text>
            {pendingRequests.map(req => {
              const room = rooms.find(r => r.id === req.id);
              return (
                <View key={req.id} style={styles.pendingRow}>
                  <Icon name="hourglass_empty" size={22} color={COLORS.accentDark} />
                  <Text style={styles.pendingRoom}>{room?.name || t('unknownRoom')}</Text>
                  <TouchableOpacity
                    onPress={() => setCancelRequestId(req.id)}
                    style={styles.iconBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="close" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Declined requests ── */}
        {rejectedRequests.length > 0 && (
          <View style={styles.rejectedCard}>
            <Text style={styles.pendingTitle}>
              {t('cleanerScreen.declinedRequests', { defaultValue: 'Not approved' })}
            </Text>
            <Text style={styles.rejectedSub}>
              {t('cleanerScreen.declinedHint', {
                defaultValue: 'Your manager didn\'t approve these. Tap ✓ to clear — you can ask again after that.',
              })}
            </Text>
            {rejectedRequests.map(req => {
              const room = rooms.find(r => r.id === req.id);
              return (
                <View key={req.id} style={styles.pendingRow}>
                  <Icon name="cancel" size={22} color={COLORS.danger} />
                  <Text style={styles.pendingRoom}>{room?.name || t('unknownRoom')}</Text>
                  <TouchableOpacity
                    onPress={() => cancelExtraRoomRequest(req.id)}
                    style={styles.iconBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="check" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── My rooms ── */}
        {regularRooms.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('myRooms')}</Text>
            {renderFloorGroup(regularRooms)}
          </>
        )}

        {/* ── Extra rooms ── */}
        {extraRooms.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('extraRooms')}</Text>
            {renderFloorGroup(extraRooms)}
          </>
        )}

        {/* ── Empty ── */}
        {myRooms.length === 0 && pendingRequests.length === 0 && rejectedRequests.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyTitle}>{t('noRoomsAssigned')}</Text>
            <Text style={styles.emptySub}>{t('cleanerScreen.noRoomsAssignedSubtitle')}</Text>
          </View>
        )}

        {/* ── All done ── */}
        {myRooms.length > 0 && cleanedCount === total && (
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>🎉</Text>
            <Text style={styles.doneTitle}>{t('cleanerScreen.allDone')}</Text>
            <Text style={styles.doneSub}>
              {t('cleanerScreen.amazingWork', { name: user.username })}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Request extra (floating) ── */}
      {myRooms.length > 0 && (
        <Fab label={t('extra')} onPress={() => setShowRequestModal(true)} />
      )}

      {/* ── Confetti when the board is complete ── */}
      <Confetti fire={total > 0 && progress === 1} />

      <AvatarPickerSheet
        controller={avatar}
        title={t('profilePhoto') || 'Photo'}
        labels={{
          camera: t('takePhoto') || 'Take a photo',
          gallery: t('chooseFromGallery') || 'Choose from gallery',
          remove: t('removePhoto') || 'Remove photo',
          close: t('close'),
        }}
      />

      <LanguageSheet
        visible={showLang}
        onClose={() => setShowLang(false)}
        languages={LANGS}
        current={i18n.language}
        onSelect={(code) => i18n.changeLanguage(code)}
        title={t('manager.language')}
      />

      {/* ── Toast host: without this, toast.show() updates state nothing renders ── */}
      <ToastHost toast={toast} />

      <RequestExtraModal
        visible={showRequestModal}
        rooms={rooms}
        floors={floors}
        roomStatus={roomStatus}
        extraRequests={extraRequests}
        onClose={() => setShowRequestModal(false)}
        onRequest={handleRequestExtra}
        t={t}
      />

      {/* ── Cancel confirm ── */}
      <Modal visible={!!cancelRequestId} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setCancelRequestId(null)}>
          <Pressable onPress={() => {}} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('cleanerScreen.cancelRequest')}</Text>
            <Text style={styles.sheetSub}>{t('cleanerScreen.cancelRequestMsg')}</Text>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
              <TouchableOpacity
                onPress={() => setCancelRequestId(null)}
                style={[styles.halfBtn, styles.halfBtnGhost]}
                activeOpacity={0.8}
              >
                <Text style={styles.halfBtnGhostText}>{t('cleanerScreen.keep')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (cancelRequestId) cancelExtraRoomRequest(cancelRequestId);
                  setCancelRequestId(null);
                }}
                style={[styles.halfBtn, { backgroundColor: COLORS.danger }]}
                activeOpacity={0.8}
              >
                <Text style={styles.halfBtnText}>{t('cleanerScreen.cancelRequestBtn')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Profile sheet: language + sign out ── */}
      <ProfileMenu
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        name={user.username}
        hostelName={hostel?.name}
        photoUri={user.photoUri}
        onChangePhoto={pickProfilePhoto}
        langLabel={(LANGS.find(l => l.code === i18n.language) || LANGS[0]).label}
        onLanguage={() => { setShowProfile(false); setShowLang(true); }}
        onAccount={() => { setShowProfile(false); setShowAccount(true); }}
        onSignOut={() => { setShowProfile(false); logout(); }}
        labels={{ language: t('manager.language'), account: t('account'), signOut: t('signOut') }}
      />
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  // Matches the header strip so there's no seam under the status bar.
  safe: { flex: 1, backgroundColor: '#F2F3F8' },

  // padding 18/18/120, sections 22px apart — matches the prototype's
  // `padding:18px 18px 120px; gap:22px` scroll column.
  scrollBody: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 22,
  },

  /* Room card */
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  roomHeaderLeft: { flex: 1, minWidth: 0 },
  roomName: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 34,
    lineHeight: 38,
    color: COLORS.text,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  typePill: {
    backgroundColor: COLORS.beige,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
  },
  typePillText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.xs },
  tagWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tagText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs },

  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  savedNote: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  undoBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 36,
    justifyContent: 'center',
  },
  undoText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  roomBody: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
    gap: SPACING.md,
  },

  /* Pending */
  pendingCard: {
    backgroundColor: COLORS.warningLight,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    padding: SPACING.lg,
    gap: 4,
  },
  pendingTitle: {
    fontFamily: DISPLAY.semiBold,
    fontSize: FONT_SIZE.xl,
    color: COLORS.text,
  },
  pendingSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.accentDark,
    marginBottom: SPACING.xs,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    minHeight: 52,
  },
  pendingRoom: {
    flex: 1,
    minWidth: 0,
    fontFamily: DISPLAY.semiBold,
    fontSize: 22,
    color: COLORS.text,
  },

  rejectedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    padding: SPACING.lg,
    gap: 4,
  },
  rejectedSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },

  /* Sections */
  sectionTitle: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 24,
    lineHeight: 27,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },

  accountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: 18,
    paddingVertical: SPACING.sm,
  },

  /* Buttons */
  outlineBtn: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  outlineBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
  },

  /* Extra time */
  blockLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 44 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.xl,
    padding: 6,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepperValue: { flex: 1, alignItems: 'center' },
  stepperNum: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 26,
    lineHeight: 30,
    color: COLORS.text,
  },
  stepperUnit: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textTertiary },

  noteInput: {
    minHeight: 76,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    textAlignVertical: 'top',
  },

  attrRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 32 },
  attrText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },

  /* Empty / done */
  emptyBox: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: 6 },
  emptyIcon: { fontSize: 46 },
  emptyTitle: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.xxl, color: COLORS.text },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  doneBox: {
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    gap: 4,
  },
  doneIcon: { fontSize: 44 },
  doneTitle: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.xxl, color: COLORS.successDark },
  doneSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.successDark,
    textAlign: 'center',
  },

  /* Sheets */
  iconBtn: { padding: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,58,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
    ...SHADOW.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.xs,
  },
  sheetTitle: { fontFamily: DISPLAY.semiBold, fontSize: 25, color: COLORS.text },
  sheetSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
    marginBottom: SPACING.xs,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 56,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  sheetRowText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  sheetCloseBtn: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  sheetCloseText: { fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.onPrimary },

  halfBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfBtnGhost: { backgroundColor: COLORS.surfaceMuted },
  halfBtnGhostText: { fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.text },
  halfBtnText: { fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.onPrimary },

  /* Request picker */
  floorLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: SPACING.md,
    marginBottom: 4,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 56,
    paddingHorizontal: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickRowText: {
    flex: 1,
    minWidth: 0,
    fontFamily: DISPLAY.semiBold,
    fontSize: 22,
    color: COLORS.text,
  },
  pickRowMeta: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textTertiary },
  emptyHint: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },

  preview: { position: 'relative', marginTop: SPACING.xs },
  previewImg: { width: '100%', height: 150, borderRadius: RADIUS.md },
  previewRemove: {
    position: 'absolute',
    top: -10,
    right: -6,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
  },

  /* Profile */
  profileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  avatarLg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLgText: { fontFamily: DISPLAY.semiBold, fontSize: 24, color: COLORS.accent },
  profileName: { fontFamily: DISPLAY.semiBold, fontSize: 25, color: COLORS.text },
  profileMeta: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textTertiary },

  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 52,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  langRowActive: { backgroundColor: COLORS.accentLight },
  langBadge: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadgeActive: { borderColor: COLORS.accent, backgroundColor: COLORS.surface },
  langBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
  langRowText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  langRowTextActive: { fontFamily: FONTS.semiBold, color: COLORS.primary },
});