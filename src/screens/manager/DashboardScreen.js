import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Pressable,
  FlatList,
} from 'react-native';
import Icon from '../../components/Icon';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, SPACING } from '../../theme';
import {
  SectionTitle,
  Card,
  Badge,
  ProgressBar,
  EmptyState,
  Button,
  Chip,
  FloorHeader,
} from '../../components/UI';
import { useApp } from '../../contexts/AppContext';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
const REASONS = {
  clean:    { label: 'Clean',      color: COLORS.success, bg: COLORS.successLight },
  stayover: { label: 'Stay‑over',  color: COLORS.amber,   bg: COLORS.amberLight },
  late:     { label: 'Late c/out', color: COLORS.danger,  bg: COLORS.dangerLight },
  early:    { label: 'Early c/in', color: COLORS.primary, bg: COLORS.primaryLight },
  noone:    { label: 'No one',     color: COLORS.blue,    bg: COLORS.blueLight },
  common:   { label: 'Common',     color: COLORS.textMuted, bg: COLORS.surface },
};

const generateCSV = (rooms, roomStatus, cleaners, extraRequests, floors) => {
  const headers = [
    'Room',
    'Floor',
    'Type',
    'Cleaner',
    'Status',
    'Notes',
    'Extra Time (min)',
    'Bed Details',
    'Flags',
    'Extra Request',
  ].join(',');

  const rows = rooms.map(room => {
    const status = roomStatus[room.id] || {};
    const cleaned = status.cleaned ? 'Cleaned' : 'Pending';
    const cleaner = cleaners.find(c => c.id === room.assignedTo);
    const cleanerName = cleaner ? cleaner.username : 'Unassigned';
    const notes = (status.notes || '').replace(/"/g, '""');
    const extraTime = status.extraTime || 0;
    const floor = floors.find(f => f.id === room.floorId);
    const floorName = floor ? floor.name : '';

    const bedStatus = status.bedStatus || {};
    const assignment = status.assignmentBedStatus || {};
    const beds = room.beds || [];
    const bedDetails = beds
      .map(bed => {
        const bStat = bedStatus[bed.id]?.status || 'pending';
        const aStat = assignment[bed.id]?.status || 'clean';
        return `${bed.name}:${bStat}(${aStat})`;
      })
      .join('; ');

    const flags = [];
    if (status.earlyCheckIn) flags.push('Early Check-in');
    if (status.lateCheckOut) flags.push('Late Check-out');
    if (status.commonOnly) flags.push('Common Only');
    if (status.extraCleaning) flags.push('Extra Cleaning');
    const flagsStr = flags.join('/');

    const extraReq = extraRequests.find(req => req.id === room.id);
    const extraReqStr = extraReq
      ? `Requested by ${extraReq.cleanerId}`
      : '';

    return [
      `"${room.name}"`,
      `"${floorName}"`,
      room.type,
      `"${cleanerName}"`,
      cleaned,
      `"${notes}"`,
      extraTime,
      `"${bedDetails}"`,
      `"${flagsStr}"`,
      `"${extraReqStr}"`,
    ].join(',');
  });

  return [headers, ...rows].join('\n');
};

// ─── Confirmation Modal ─────────────────────────────────────────
function ConfirmModal({ visible, onConfirm, onCancel, title, message, t }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.modalBtn, styles.modalBtnCancel]}
            >
              <Text style={styles.modalBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[styles.modalBtn, styles.modalBtnDanger]}
            >
              <Text style={[styles.modalBtnText, { color: COLORS.white }]}>
                {t('reset')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Cleaner Detail Modal (with per‑cleaner export) ─────────────
function CleanerDetailModal({
  visible,
  cleaner,
  rooms = [],
  roomStatus,
  onClose,
  t,
  onExport,
}) {
  if (!cleaner) return null;
  const assignedRooms = rooms.filter(r => r.assignedTo === cleaner.id);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { maxHeight: '80%' }]}>
          <View style={styles.modalTitleRow}>
            <Text style={[styles.modalTitle, { marginBottom: 0, flex: 1 }]}>
              {t('cleanerRooms', { name: cleaner.username })}
            </Text>
            <TouchableOpacity
              onPress={() => onExport(assignedRooms)}
              style={styles.exportBtnSmall}
              activeOpacity={0.7}
            >
              <Icon name="download-outline" size={18} color={COLORS.primary} />
              <Text style={styles.exportBtnTextSmall}>{t('exportCSV')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ marginBottom: SPACING[4] }}>
            {assignedRooms.length === 0 ? (
              <Text style={styles.emptyText}>{t('noRoomsAssignedYet')}</Text>
            ) : (
              assignedRooms.map(room => {
                const status = roomStatus[room.id] || {};
                const cleaned = status.cleaned || false;
                const notes = status.notes;
                const extraTime = status.extraTime || 0;
                const bedStatus = status.bedStatus || {};
                const assignmentBedStatus = status.assignmentBedStatus || {};
                const managerNotes = status.managerNotes;
                const isCommon = status.commonOnly || false;
                const assignmentAttributes = status.assignmentAttributes || {};
                const isEarly = status.earlyCheckIn === true;
                const isLate = status.lateCheckOut === true;
                const hasEarlyBed =
                  room.type === 'dorm' &&
                  room.beds?.some(
                    b => (assignmentBedStatus[b.id] || {}).status === 'early'
                  );
                const hasLateBed =
                  room.type === 'dorm' &&
                  room.beds?.some(
                    b => (assignmentBedStatus[b.id] || {}).status === 'late'
                  );
                const showEarly = isEarly || hasEarlyBed;
                const showLate = isLate || hasLateBed;

                return (
                  <View key={room.id} style={styles.cleanerRoomCard}>
                    <View style={styles.roomHeader}>
                      <View style={{ flex: 1 }}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: SPACING[2],
                            }}
                          >
                            <Text style={styles.roomName}>{room.name}</Text>
                            <Badge
                              label={
                                room.type === 'private'
                                  ? t('private')
                                  : t('dormitory')
                              }
                              type={room.type === 'private' ? 'priv' : 'dorm'}
                            />
                          </View>
                        </ScrollView>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={{ marginTop: 4 }}
                        >
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            {status.extraCleaning && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 2,
                                }}
                              >
                                <Text style={{ fontSize: 14 }}>⭐</Text>
                                <Text
                                  style={{
                                    fontFamily: FONTS.semiBold,
                                    fontSize: FONT_SIZE.xs,
                                    color: COLORS.primary,
                                  }}
                                >
                                  {t('extra')}
                                </Text>
                              </View>
                            )}
                            {showEarly && (
                              <View
                                style={{
                                  backgroundColor: COLORS.blueLight,
                                  paddingHorizontal: SPACING[1],
                                  paddingVertical: 1,
                                  borderRadius: RADIUS.sm,
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: FONTS.bold,
                                    fontSize: FONT_SIZE.xs,
                                    color: COLORS.blue,
                                  }}
                                >
                                  {t('earlyCheckInFlag')}
                                </Text>
                              </View>
                            )}
                            {showLate && (
                              <View
                                style={{
                                  backgroundColor: COLORS.dangerLight,
                                  paddingHorizontal: SPACING[1],
                                  paddingVertical: 1,
                                  borderRadius: RADIUS.sm,
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: FONTS.bold,
                                    fontSize: FONT_SIZE.xs,
                                    color: COLORS.danger,
                                  }}
                                >
                                  {t('lateCheckOutFlag')}
                                </Text>
                              </View>
                            )}
                          </View>
                        </ScrollView>
                      </View>
                      <Badge
                        label={cleaned ? t('cleaned') : t('pending')}
                        type={cleaned ? 'clean' : 'extra'}
                      />
                    </View>
                    {managerNotes ? (
                      <View style={styles.managerNotesBox}>
                        <Text style={styles.managerNotesText}>
                          📋 {managerNotes}
                        </Text>
                      </View>
                    ) : null}
                    {extraTime > 0 && (
                      <Text style={styles.detailLine}>
                        {t('extraTimeValue', { minutes: extraTime })}
                      </Text>
                    )}
                    {notes ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesText}>📝 “{notes}”</Text>
                      </View>
                    ) : null}
                    {room.type === 'private' &&
                      Object.keys(assignmentAttributes).length > 0 && (
                        <View style={styles.attributeSection}>
                          <Text style={styles.detailLine}>
                            {t('roomFeatures')}:
                          </Text>
                          {Object.entries(assignmentAttributes).map(
                            ([attr]) => (
                              <View key={attr} style={styles.attributeRow}>
                                <Icon
                                  name={
                                    cleaned
                                      ? 'checkmark-circle'
                                      : 'ellipse-outline'
                                  }
                                  size={16}
                                  color={
                                    cleaned
                                      ? COLORS.success
                                      : COLORS.textMuted
                                  }
                                  style={{ marginRight: SPACING[1] }}
                                />
                                <Text style={styles.attributeText}>
                                  {attr}
                                </Text>
                              </View>
                            )
                          )}
                        </View>
                      )}
                    {isCommon ? (
                      <View style={styles.commonIndicator}>
                        <Icon
                          name={
                            cleaned
                              ? 'checkmark-circle'
                              : 'ellipse-outline'
                          }
                          size={18}
                          color={
                            cleaned ? COLORS.success : COLORS.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.commonText,
                            cleaned && { color: COLORS.success },
                          ]}
                        >
                          {cleaned
                            ? t('commonCleaned')
                            : t('commonNotCleaned')}
                        </Text>
                      </View>
                    ) : (
                      room.type === 'dorm' &&
                      room.beds?.length > 0 && (
                        <View style={styles.bedSummary}>
                          {room.beds.map(bed => {
                            const assignment =
                              assignmentBedStatus[bed.id] || {
                                status: 'clean',
                                reason: 'clean',
                              };
                            const reasonKey =
                              assignment.reason ||
                              assignment.status ||
                              'clean';
                            const reason =
                              REASONS[reasonKey] || REASONS.clean;
                            const bedClean =
                              bedStatus[bed.id]?.status === 'cleaned';
                            const isSkipped =
                              assignment.status === 'stayover' ||
                              assignment.status === 'noone';
                            const isCleaned = !isSkipped && bedClean;
                            return (
                              <Chip
                                key={bed.id}
                                label={`${
                                  isCleaned ? '✓' : isSkipped ? '⊘' : '○'
                                } ${bed.name}`}
                                colorText={
                                  isCleaned
                                    ? COLORS.success
                                    : reason.color
                                }
                                colorBg={COLORS.surface}
                                colorBorder={COLORS.border}
                                fontSize={FONT_SIZE.xs}
                              />
                            );
                          })}
                        </View>
                      )
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
          <Button
            title={t('close')}
            onPress={onClose}
            variant="secondary"
            style={{ alignSelf: 'center' }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Room Detail Modal ──────────────────────────────────────────
function RoomDetailModal({ visible, room, roomStatus, cleaners, onClose, t }) {
  if (!room) return null;
  const status = roomStatus[room.id] || {};
  const cleaned = status.cleaned || false;
  const notes = status.notes;
  const extraTime = status.extraTime || 0;
  const bedStatus = status.bedStatus || {};
  const assignmentBedStatus = status.assignmentBedStatus || {};
  const managerNotes = status.managerNotes;
  const isCommon = status.commonOnly || false;
  const assignmentAttributes = status.assignmentAttributes || {};
  const cleaner = cleaners.find(c => c.id === room.assignedTo);
  const isEarly = status.earlyCheckIn === true;
  const isLate = status.lateCheckOut === true;
  const hasEarlyBed =
    room.type === 'dorm' &&
    room.beds?.some(
      b => (assignmentBedStatus[b.id] || {}).status === 'early'
    );
  const hasLateBed =
    room.type === 'dorm' &&
    room.beds?.some(
      b => (assignmentBedStatus[b.id] || {}).status === 'late'
    );
  const showEarly = isEarly || hasEarlyBed;
  const showLate = isLate || hasLateBed;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { maxHeight: '80%' }]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: SPACING[3],
            }}
          >
            <Text
              style={[styles.modalTitle, { marginBottom: 0, flex: 1 }]}
              numberOfLines={2}
            >
              {room.name}
            </Text>
            <Badge
              label={cleaned ? t('cleaned') : t('pending')}
              type={cleaned ? 'clean' : 'extra'}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: SPACING[4] }}
          >
            <View style={{ flexDirection: 'row', gap: SPACING[2] }}>
              <Badge
                label={
                  room.type === 'private' ? t('private') : t('dormitory')
                }
                type={room.type === 'private' ? 'priv' : 'dorm'}
              />
              {status.extraCleaning && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>⭐</Text>
                  <Text
                    style={{
                      fontFamily: FONTS.semiBold,
                      fontSize: FONT_SIZE.xs,
                      color: COLORS.primary,
                    }}
                  >
                    {t('extra')}
                  </Text>
                </View>
              )}
              {showEarly && (
                <View
                  style={{
                    backgroundColor: COLORS.blueLight,
                    paddingHorizontal: SPACING[2],
                    paddingVertical: 2,
                    borderRadius: RADIUS.sm,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: FONT_SIZE.xs,
                      color: COLORS.blue,
                    }}
                  >
                    {t('earlyCheckInFlag')}
                  </Text>
                </View>
              )}
              {showLate && (
                <View
                  style={{
                    backgroundColor: COLORS.dangerLight,
                    paddingHorizontal: SPACING[2],
                    paddingVertical: 2,
                    borderRadius: RADIUS.sm,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bold,
                      fontSize: FONT_SIZE.xs,
                      color: COLORS.danger,
                    }}
                  >
                    {t('lateCheckOutFlag')}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          <ScrollView style={{ marginBottom: SPACING[4] }}>
            <Text style={styles.detailLine}>
              {t('cleaner')}:{' '}
              {cleaner ? cleaner.username : t('unassigned')}
            </Text>
            {managerNotes ? (
              <View style={styles.managerNotesBox}>
                <Text style={styles.managerNotesText}>
                  📋 {managerNotes}
                </Text>
              </View>
            ) : null}
            {extraTime > 0 && (
              <Text style={styles.detailLine}>
                {t('extraTimeValue', { minutes: extraTime })}
              </Text>
            )}
            {notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>📝 “{notes}”</Text>
              </View>
            ) : null}
            {room.type === 'private' &&
              Object.keys(assignmentAttributes).length > 0 && (
                <View style={styles.attributeSection}>
                  <Text style={styles.detailLine}>
                    {t('roomFeatures')}:
                  </Text>
                  {Object.entries(assignmentAttributes).map(([attr]) => (
                    <View key={attr} style={styles.attributeRow}>
                      <Icon
                        name={
                          cleaned
                            ? 'checkmark-circle'
                            : 'ellipse-outline'
                        }
                        size={16}
                        color={
                          cleaned ? COLORS.success : COLORS.textMuted
                        }
                        style={{ marginRight: SPACING[1] }}
                      />
                      <Text style={styles.attributeText}>{attr}</Text>
                    </View>
                  ))}
                </View>
              )}
            {isCommon ? (
              <View style={styles.commonIndicator}>
                <Icon
                  name={
                    cleaned ? 'checkmark-circle' : 'ellipse-outline'
                  }
                  size={18}
                  color={cleaned ? COLORS.success : COLORS.textMuted}
                />
                <Text
                  style={[
                    styles.commonText,
                    cleaned && { color: COLORS.success },
                  ]}
                >
                  {cleaned
                    ? t('commonCleaned')
                    : t('commonNotCleaned')}
                </Text>
              </View>
            ) : (
              room.type === 'dorm' &&
              room.beds?.length > 0 && (
                <View style={styles.bedSummary}>
                  {room.beds.map(bed => {
                    const assignment = assignmentBedStatus[bed.id] || {
                      status: 'clean',
                      reason: 'clean',
                    };
                    const reasonKey =
                      assignment.reason ||
                      assignment.status ||
                      'clean';
                    const reason = REASONS[reasonKey] || REASONS.clean;
                    const bedClean =
                      bedStatus[bed.id]?.status === 'cleaned';
                    const isSkipped =
                      assignment.status === 'stayover' ||
                      assignment.status === 'noone';
                    const isCleaned = !isSkipped && bedClean;
                    return (
                      <Chip
                        key={bed.id}
                        label={`${
                          isCleaned
                            ? '✓'
                            : isSkipped
                            ? '⊘'
                            : '○'
                        } ${bed.name}`}
                        colorText={
                          isCleaned ? COLORS.success : reason.color
                        }
                        colorBg={COLORS.surface}
                        colorBorder={COLORS.border}
                        fontSize={FONT_SIZE.xs}
                      />
                    );
                  })}
                </View>
              )
            )}
          </ScrollView>
          <Button
            title={t('close')}
            onPress={onClose}
            variant="secondary"
            style={{ alignSelf: 'center' }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Dashboard Screen ──────────────────────────────────────
function DashboardScreen({ highlightRoomId, onRoomOpened }) {
  const {
    rooms = [],
    roomStatus = {},
    hostel = {},
    floors = [],
    cleaners = [],
    updateRoomStatus,
    resetAllRoomStatus,
    extraRequests = [],
  } = useApp();
  // NOTE: approveExtraRoom / rejectExtraRoom removed from the destructure —
  // this screen no longer shows extra requests (that now lives only in
  // ExtraRequestsScreen, reached from its own tab). extraRequests itself
  // stays, since the CSV export still includes it.

  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);

  const sortedFloors = useMemo(() => {
    return [...floors].sort((a, b) => {
      const order = name => {
        if (name === 'Ground Floor') return 0;
        if (name === 'Garage') return 999;
        const num = parseInt(name);
        if (!isNaN(num)) return num;
        return 500;
      };
      return order(a.name) - order(b.name);
    });
  }, [floors]);

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return null;
    const term = search.toLowerCase();
    return rooms.filter(r => r.name.toLowerCase().includes(term));
  }, [rooms, search]);

  const [refreshing, setRefreshing] = useState(false);
  const [resetAllModal, setResetAllModal] = useState(false);
  const [resetSingleModal, setResetSingleModal] = useState(null);
  const [selectedCleaner, setSelectedCleaner] = useState(null);
  const [expandedFloors, setExpandedFloors] = useState({});

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 300);
  }, []);

  const confirmResetAll = () => {
    resetAllRoomStatus();
    setResetAllModal(false);
  };

  const confirmResetSingle = () => {
    if (resetSingleModal) {
      updateRoomStatus(resetSingleModal, {
        cleaned: false,
        notes: '',
        extraTime: 0,
        bedStatus: {},
      });
      setResetSingleModal(null);
    }
  };

  const toggleFloor = floorId =>
    setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));

  const handleExport = useCallback(
    async (roomList) => {
      try {
        const csv = generateCSV(roomList, roomStatus, cleaners, extraRequests, floors);
        const fileName = `keepclean_report_${new Date().toISOString().slice(0, 10)}.csv`;

        if (Platform.OS === 'web') {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
        } else {
          const fileUri = FileSystem.cacheDirectory + fileName;
          const encoding = FileSystem.EncodingType?.UTF8 ?? 'utf8';
          await FileSystem.writeAsStringAsync(fileUri, csv, { encoding });
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'text/csv',
              dialogTitle: t('exportCSV'),
              UTI: 'public.comma-separated-values-text',
            });
          } else {
            Alert.alert('Error', 'Sharing not available on this device.');
          }
        }
      } catch (error) {
        console.error('Export error:', error);
        Alert.alert('Export failed', error.message);
      }
    },
    [roomStatus, cleaners, extraRequests, floors, t]
  );

  useEffect(() => {
    if (highlightRoomId && rooms.length > 0) {
      const room = rooms.find(r => r.id === highlightRoomId);
      if (room) {
        setSelectedRoom(room);
        if (onRoomOpened) onRoomOpened();
      }
    }
  }, [highlightRoomId, rooms, onRoomOpened]);

   // ── FlatList data for unassigned rooms ────────────────────────
  const flatUnassigned = useMemo(() => {
    if (search.trim()) return [];
    const data = [];
    sortedFloors.forEach(floor => {
      const floorRooms = rooms.filter(r => r.floorId === floor.id && !r.assignedTo);
      if (!floorRooms.length) return;
      data.push({ type: 'header', key: `header-${floor.id}`, floor });
      floorRooms.forEach(room => data.push({ type: 'room', key: room.id, room }));
    });
    return data;
  }, [search, sortedFloors, rooms]);

  const renderUnassignedItem = useCallback(({ item }) => {
    if (item.type === 'header') {
      return (
        <TouchableOpacity
          onPress={() => toggleFloor(item.floor.id)}
          style={styles.floorHeaderRow}
          activeOpacity={0.7}
        >
          <FloorHeader label={item.floor.name} />
          <Icon
            name={expandedFloors[item.floor.id] !== false ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>
      );
    }

    const room = item.room;
    if (expandedFloors[room.floorId] === false) return null;

    const status = roomStatus[room.id] || {};
    const cleaned = status.cleaned || false;
    const notes = status.notes;
    const extraTime = status.extraTime || 0;
    const bedStatus = status.bedStatus || {};
    const managerNotes = status.managerNotes;
    const assignmentAttributes = status.assignmentAttributes || {};

    return (
      <Card key={room.id} style={styles.roomDetailCard}>
        <View style={styles.roomHeader}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING[2] }}>
              <Text style={styles.roomName}>{room.name}</Text>
              <Badge
                label={room.type === 'private' ? t('private') : t('dormitory')}
                type={room.type === 'private' ? 'priv' : 'dorm'}
              />
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: SPACING[2] }}>
            <Badge label={cleaned ? t('cleaned') : t('pending')} type={cleaned ? 'clean' : 'extra'} />
            <TouchableOpacity onPress={() => setResetSingleModal(room.id)}>
              <Icon name="refresh-circle" size={24} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
        {managerNotes ? (
          <View style={styles.managerNotesBox}>
            <Text style={styles.managerNotesText}>📋 {managerNotes}</Text>
          </View>
        ) : null}
        <Text style={styles.detailLine}>{t('cleaner')}: {t('unassigned')}</Text>
        {extraTime > 0 && <Text style={styles.detailLine}>{t('extraTimeValue', { minutes: extraTime })}</Text>}
        {notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>📝 “{notes}”</Text>
          </View>
        ) : null}
        {room.type === 'dorm' && room.beds?.length > 0 && (
          <View style={styles.bedSummary}>
            {room.beds.map(bed => {
              const bedState = bedStatus[bed.id]?.status || 'pending';
              const isCleaned = bedState === 'cleaned';
              const isSkipped = bedState === 'skipped';
              return (
                <Chip
                  key={bed.id}
                  label={`${isCleaned ? '✓' : isSkipped ? '⊘' : '○'} ${bed.name}`}
                  colorText={isCleaned ? COLORS.success : isSkipped ? COLORS.amber : COLORS.textMuted}
                  fontSize={FONT_SIZE.xs}
                />
              );
            })}
          </View>
        )}
        {room.type === 'private' && Object.keys(assignmentAttributes).length > 0 && (
          <View style={styles.attributeSection}>
            <Text style={styles.detailLine}>{t('roomFeatures')}:</Text>
            {Object.entries(assignmentAttributes).map(([attr, value]) => (
              <View key={attr} style={styles.attributeRow}>
                <Icon
                  name={value ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={value ? COLORS.success : COLORS.textMuted}
                  style={{ marginRight: SPACING[1] }}
                />
                <Text style={styles.attributeText}>{attr}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    );
  }, [expandedFloors, roomStatus, t]);

  if (!hostel.name) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <EmptyState
          icon="🏠"
          title={t('noProperty')}
          subtitle={t('createHostelFirst')}
        />
      </ScrollView>
    );
  }

  const assignedRooms = rooms.filter(r => r.assignedTo != null);
  const overallCleaned = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const overallPct = assignedRooms.length ? Math.round((overallCleaned / assignedRooms.length) * 100) : 0;

  return (
    <>
      <FlatList
        data={flatUnassigned}
        renderItem={renderUnassignedItem}
        keyExtractor={(item, index) => item.key}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {/* Header row */}
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <SectionTitle
                  title={t('todaysOverview')}
                  subtitle={hostel.name}
                />
              </View>
              <TouchableOpacity
                onPress={() => setResetAllModal(true)}
                style={styles.resetAllBtn}
              >
                <Icon name="refresh" size={18} color={COLORS.danger} />
                <Text style={styles.resetAllText}>{t('resetAllRooms')}</Text>
              </TouchableOpacity>
            </View>

            <Card style={styles.overviewCard}>
              <Text style={styles.overviewText}>
                {t('roomsCleanedPercent', {
                  cleaned: overallCleaned,
                  total: assignedRooms.length,
                  percent: overallPct,
                })}
              </Text>
              <ProgressBar pct={overallPct} />
            </Card>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Icon
                name="search-outline"
                size={18}
                color={COLORS.textMuted}
                style={{ marginRight: SPACING[2] }}
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('search')}
                placeholderTextColor={COLORS.textMuted}
                style={styles.searchInput}
                clearButtonMode="while-editing"
              />
              {search.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearch('')}
                  style={{ padding: 4 }}
                >
                  <Icon
                    name="close-circle"
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results */}
            {filteredRooms !== null && (
              <View style={{ marginBottom: SPACING[4] }}>
                <SectionTitle
                  title={t('searchResults', { count: filteredRooms.length })}
                  subtitle={
                    search.trim() ? t('matching', { query: search.trim() }) : ''
                  }
                />
                {filteredRooms.length === 0 ? (
                  <Text style={styles.emptyText}>{t('noResults')}</Text>
                ) : (
                  filteredRooms.map(room => {
                    const status = roomStatus[room.id] || {};
                    const cleaned = status.cleaned || false;
                    const cleaner = cleaners.find(c => c.id === room.assignedTo);
                    const isEarly = status.earlyCheckIn === true;
                    const isLate = status.lateCheckOut === true;
                    const assignmentBedStatus = status.assignmentBedStatus || {};
                    const hasEarlyBed =
                      room.type === 'dorm' &&
                      room.beds?.some(
                        b => (assignmentBedStatus[b.id] || {}).status === 'early'
                      );
                    const hasLateBed =
                      room.type === 'dorm' &&
                      room.beds?.some(
                        b => (assignmentBedStatus[b.id] || {}).status === 'late'
                      );
                    const showEarly = isEarly || hasEarlyBed;
                    const showLate = isLate || hasLateBed;

                    return (
                      <TouchableOpacity
                        key={room.id}
                        onPress={() => setSelectedRoom(room)}
                        activeOpacity={0.7}
                      >
                        <Card style={styles.roomDetailCard}>
                          <View style={styles.roomHeader}>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={{ flex: 1 }}
                            >
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: SPACING[2],
                                }}
                              >
                                <Text style={styles.roomName}>{room.name}</Text>
                                <Badge
                                  label={
                                    room.type === 'private'
                                      ? t('private')
                                      : t('dormitory')
                                  }
                                  type={room.type === 'private' ? 'priv' : 'dorm'}
                                />
                                {showEarly && (
                                  <View
                                    style={{
                                      backgroundColor: COLORS.blueLight,
                                      paddingHorizontal: SPACING[2],
                                      paddingVertical: 2,
                                      borderRadius: RADIUS.sm,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontFamily: FONTS.bold,
                                        fontSize: FONT_SIZE.xs,
                                        color: COLORS.blue,
                                      }}
                                    >
                                      {t('earlyCheckInFlag')}
                                    </Text>
                                  </View>
                                )}
                                {showLate && (
                                  <View
                                    style={{
                                      backgroundColor: COLORS.dangerLight,
                                      paddingHorizontal: SPACING[2],
                                      paddingVertical: 2,
                                      borderRadius: RADIUS.sm,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontFamily: FONTS.bold,
                                        fontSize: FONT_SIZE.xs,
                                        color: COLORS.danger,
                                      }}
                                    >
                                      {t('lateCheckOutFlag')}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </ScrollView>
                            <Badge
                              label={cleaned ? t('cleaned') : t('pending')}
                              type={cleaned ? 'clean' : 'extra'}
                            />
                          </View>
                          <Text style={styles.detailLine}>
                            {t('cleaner')}:{' '}
                            {cleaner ? cleaner.username : t('unassigned')}
                          </Text>
                          {status.extraCleaning && (
                            <Text
                              style={[
                                styles.detailLine,
                                { color: COLORS.primary },
                              ]}
                            >
                              ⭐ {t('extra')}
                            </Text>
                          )}
                        </Card>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            {/* Cleaner Progress */}
            {!search.trim() && cleaners.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <SectionTitle
                    title={t('cleanerProgress')}
                    subtitle={t('tapCleaner')}
                  />
                  <TouchableOpacity
                    onPress={() => handleExport(rooms)}
                    style={styles.exportBtn}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name="download-outline"
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text style={styles.exportText}>{t('exportCSV')}</Text>
                  </TouchableOpacity>
                </View>
                {cleaners.map(c => {
                  const assigned = rooms.filter(
                    r => r.assignedTo === c.id
                  );
                  const done = assigned.filter(
                    r => roomStatus[r.id]?.cleaned
                  ).length;
                  const pct = assigned.length
                    ? Math.round((done / assigned.length) * 100)
                    : 0;
                  const extraCount = rooms.filter(r => {
                    const status = roomStatus[r.id] || {};
                    return (
                      status.extraCleaning &&
                      status.extraCleaningBy === c.id
                    );
                  }).length;

                  return (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.7}
                      onPress={() => setSelectedCleaner(c)}
                    >
                      <Card style={styles.cleanerCard}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cleanerName}>
                              {c.username}
                            </Text>
                            <Text style={styles.cleanerStats}>
                              {t('cleanerRoomsStats', {
                                done,
                                total: assigned.length,
                              })}
                            </Text>
                            <ProgressBar pct={pct} />
                          </View>
                          {extraCount > 0 && (
                            <View style={styles.extraBadge}>
                              <Text style={styles.extraBadgeText}>
                                {extraCount}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Card>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Section title for unassigned rooms */}
            {!search.trim() && (
              <SectionTitle
                title={t('unassignedRooms')}
                subtitle={t('unassignedRoomsSubtitle')}
              />
            )}
            {rooms.length === 0 && !search.trim() && (
              <EmptyState icon="🚪" title={t('noRoomsYet')} />
            )}
          </>
        }
        ListEmptyComponent={!search.trim() ? undefined : null}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={8}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => {
          const item = data[index];
          if (!item) return { length: 0, offset: 0, index };
          const isHeader = item.type === 'header';
          const height = isHeader ? 60 : 120;
          let offset = 0;
          for (let i = 0; i < index; i++) {
            const prev = data[i];
            offset += prev?.type === 'header' ? 60 : 120;
          }
          return { length: height, offset, index };
        }}
      />

      {/* ── Modals ─────────────────────────────────────────── */}
      <ConfirmModal
        visible={resetAllModal}
        onConfirm={confirmResetAll}
        onCancel={() => setResetAllModal(false)}
        title={t('resetAllRooms')}
        message={t('resetAllMsg')}
        t={t}
      />
      <ConfirmModal
        visible={!!resetSingleModal}
        onConfirm={confirmResetSingle}
        onCancel={() => setResetSingleModal(null)}
        title={t('resetRoom')}
        message={t('resetRoomMsg')}
        t={t}
      />
      <CleanerDetailModal
        visible={!!selectedCleaner}
        cleaner={selectedCleaner}
        rooms={rooms}
        roomStatus={roomStatus}
        onClose={() => setSelectedCleaner(null)}
        t={t}
        onExport={handleExport}
      />
      <RoomDetailModal
        visible={!!selectedRoom}
        room={selectedRoom}
        roomStatus={roomStatus}
        cleaners={cleaners}
        onClose={() => setSelectedRoom(null)}
        t={t}
      />
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { padding: SPACING[4], paddingBottom: SPACING[10] },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING[3],
    flexWrap: 'wrap',
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[1],
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.danger,
    alignSelf: 'flex-start',
    marginTop: SPACING[1],
    maxWidth: '40%',
  },
  resetAllText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.danger,
  },
  overviewCard: { marginBottom: SPACING[4], padding: SPACING[4] },
  overviewText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING[3],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING[3],
    marginBottom: SPACING[4],
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    paddingVertical: SPACING[2],
  },
  cleanerCard: { marginBottom: SPACING[3], padding: SPACING[3] },
  cleanerName: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
  },
  cleanerStats: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING[3],
  },
  roomDetailCard: { marginBottom: SPACING[3], padding: SPACING[3] },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[3],
  },
  roomName: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
  },
  detailLine: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  notesBox: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.sm,
    padding: SPACING[2],
    marginTop: SPACING[2],
  },
  notesText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontStyle: 'italic',
  },
  bedSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING[2],
    marginTop: SPACING[3],
  },
  floorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING[6],
    marginBottom: SPACING[3],
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    marginTop: SPACING[4],
  },
  cleanerRoomCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING[3],
    marginBottom: SPACING[2],
  },
  managerNotesBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    padding: SPACING[2],
    marginTop: SPACING[2],
  },
  managerNotesText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primaryDark,
  },
  commonIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[2],
    paddingVertical: SPACING[2],
  },
  commonText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  attributeSection: {
    marginTop: SPACING[2],
    marginBottom: SPACING[2],
  },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING[1],
  },
  attributeText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  extraBadge: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING[2],
  },
  extraBadgeText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 12,
    color: COLORS.white,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[6],
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[5],
    width: '100%',
    maxWidth: 400,
    ...SHADOW.md,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xl,
    color: COLORS.text,
    marginBottom: SPACING[3],
  },
  modalMessage: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING[5],
  },
  modalActions: { flexDirection: 'row', gap: SPACING[2] },
  modalBtn: {
    flex: 1,
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalBtnCancel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  modalBtnDanger: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  modalBtnText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    color: COLORS.primary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[3],
    flexWrap: 'wrap',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[1],
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  exportText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING[3],
  },
  exportBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: SPACING[2],
    paddingVertical: SPACING[1],
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginLeft: SPACING[2],
  },
  exportBtnTextSmall: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    marginLeft: 2,
  },
});

export default React.memo(DashboardScreen);