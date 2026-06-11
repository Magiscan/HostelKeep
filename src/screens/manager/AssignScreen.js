import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
  Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { COLORS, RADIUS, FONTS, FONT_SIZE, SPACING, SHADOW } from '../../theme';
import {
  SectionTitle, FloorHeader, EmptyState, Badge, Avatar, Chip,
  Label, Input,
} from '../../components/UI';
import { useApp } from '../../contexts/AppContext';

const BED_STATES = [
  { key: 'clean',    label: 'Clean',      color: COLORS.success, bg: COLORS.successLight },
  { key: 'stayover', label: 'Stay‑over',  color: COLORS.amber,   bg: COLORS.amberLight },
  { key: 'late',     label: 'Late c/out', color: COLORS.danger,  bg: COLORS.dangerLight },
  { key: 'early',    label: 'Early c/in', color: '#D97706',      bg: '#FFFBEB' },
  { key: 'noone',    label: 'No one',     color: COLORS.blue,    bg: COLORS.blueLight },
];

export default function AssignScreen() {
  const { t } = useTranslation();
  const {
    rooms, cleaners, floors, assignRoomWithDetails, unassignRoom, roomStatus,
    roomAttributes,
  } = useApp();

  const sortedFloors = useMemo(() => {
    return [...floors].sort((a, b) => {
      const order = (name) => {
        if (name === 'Ground Floor') return 0;
        if (name === 'Garage') return 999;
        const num = parseInt(name);
        if (!isNaN(num)) return num;
        return 500;
      };
      return order(a.name) - order(b.name);
    });
  }, [floors]);

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedCleaner, setSelectedCleaner] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [bedAssignments, setBedAssignments] = useState({});
  const [managerNotes, setManagerNotes] = useState('');
  const [commonOnly, setCommonOnly] = useState(false);
  const [assignmentAttributes, setAssignmentAttributes] = useState({});
  const [earlyCheckIn, setEarlyCheckIn] = useState(false);
  const [lateCheckOut, setLateCheckOut] = useState(false);

  const clearAll = () => rooms.forEach(room => unassignRoom(room.id));

  const openConfig = (room, cleaner) => {
    setSelectedRoom(room);
    setSelectedCleaner(cleaner);

    const existingStatus = roomStatus[room.id] || {};
    const existingBeds = existingStatus.assignmentBedStatus || {};
    const defaultsBeds = {};
    if (room.type === 'dorm' && room.beds) {
      room.beds.forEach(bed => {
        defaultsBeds[bed.id] = existingBeds[bed.id] || { status: 'clean', reason: 'clean' };
      });
    }
    setBedAssignments(defaultsBeds);
    setCommonOnly(existingStatus.commonOnly || false);

    const existingAttrs = existingStatus.assignmentAttributes || {};
    const initialAttrs = Object.keys(existingAttrs).length > 0
      ? existingAttrs
      : (room.attributes ? { ...room.attributes } : {});
    setAssignmentAttributes(initialAttrs);

    // 👇 read back the flags
    setEarlyCheckIn(existingStatus.earlyCheckIn || false);
    setLateCheckOut(existingStatus.lateCheckOut || false);

    setManagerNotes(existingStatus.managerNotes || '');
    setShowConfigModal(true);
  };

  const handleAssign = async () => {
    if (!selectedRoom || !selectedCleaner) return;

    const finalBedAssignments = {};
    if (selectedRoom.type === 'dorm' && selectedRoom.beds) {
      selectedRoom.beds.forEach(bed => {
        finalBedAssignments[bed.id] = bedAssignments[bed.id] || { status: 'clean', reason: 'clean' };
      });
    }

    const finalAttrs = {};
    Object.entries(assignmentAttributes).forEach(([key, val]) => {
      if (val) finalAttrs[key] = true;
    });

    await assignRoomWithDetails(
      selectedRoom.id,
      selectedCleaner.id,
      finalBedAssignments,
      managerNotes,
      commonOnly,
      finalAttrs,
      earlyCheckIn,
      lateCheckOut
    );
    setShowConfigModal(false);
    setSelectedRoom(null);
    setSelectedCleaner(null);
  };

  if (rooms.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <EmptyState icon="📋" title={t('noRoomsToAssign')} subtitle={t('addRoomsFirst')} />
      </SafeAreaView>
    );
  }

  if (cleaners.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <EmptyState icon="👤" title={t('noCleaners')} subtitle={t('addCleanersFirst')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <SectionTitle  title={t('assignments')} subtitle={t('tapToAssign') } />
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn} activeOpacity={0.7}>
            <Icon name="close-circle-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.clearText}>{t('clearAll')}</Text>
          </TouchableOpacity>
        </View>

        {sortedFloors.map(floor => {
          const floorRooms = rooms.filter(r => r.floorId === floor.id);
          if (!floorRooms.length) return null;
          return (
            <View key={floor.id}>
              <FloorHeader label={floor.name} />
              <View style={{ gap: SPACING[3] }}>
                {floorRooms.map(room => {
                  const currentCleaner = cleaners.find(c => c.id === room.assignedTo);
                  return (
                    <View key={room.id} style={styles.roomCard}>
                      <View style={styles.roomInfo}>
                        <View>
                          <Text style={styles.roomName}>{room.name}</Text>
                          <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: 4 }}>
                            <Badge label={room.type === 'private' ? t('private') : t('dormitory')} type={room.type === 'private' ? 'priv' : 'dorm'} />
                            {room.type === 'dorm' && room.beds?.length > 0 && (
                              <Text style={styles.bedCount}>{room.beds.length} {t('beds')}</Text>
                            )}
                          </View>
                        </View>
                        {currentCleaner ? (
                          <View style={styles.assignedTag}>
                            <Avatar name={currentCleaner.username} size={28} />
                            <Text style={styles.assignedName}>{currentCleaner.username}</Text>
                          </View>
                        ) : (
                          <Text style={styles.unassignedHint}>{t('noCleaner')}</Text>
                        )}
                      </View>

                      <View style={styles.pillsContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
                          {cleaners.map(cleaner => {
                            const isAssigned = room.assignedTo === cleaner.id;
                            return (
                              <Chip
                                key={cleaner.id}
                                label={cleaner.username}
                                selected={isAssigned}
                                onPress={() => openConfig(room, cleaner)}
                                icon={isAssigned ? 'checkmark' : undefined}
                              />
                            );
                          })}
                          {currentCleaner && (
                            <Chip
                              label={t('unassign')}
                              icon="close"
                              onPress={() => unassignRoom(room.id)}
                              colorBg={COLORS.dangerLight}
                              colorBorder={COLORS.dangerLight}
                              colorText={COLORS.danger}
                            />
                          )}
                        </ScrollView>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showConfigModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('assign')} {selectedRoom?.name}</Text>
              <Text style={styles.modalSubtitle}>{t('cleaner')}: {selectedCleaner?.username}</Text>

              {selectedRoom?.type === 'dorm' && selectedRoom.beds?.length > 0 && (
                <View style={{ marginBottom: SPACING[4] }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[2] }}>
                    <Label>{t('commonOnly')}</Label>
                    <TouchableOpacity
                      onPress={() => setCommonOnly(!commonOnly)}
                      style={[styles.checkbox, commonOnly && styles.checkboxActive]}
                    >
                      {commonOnly && <Icon name="checkmark" size={16} color={COLORS.white} />}
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING[2] }}>
                    {commonOnly ? t('commonOnly') : t('scrollToSeeOptions')}
                  </Text>

                  {!commonOnly && (
                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                      {selectedRoom.beds.map(bed => {
                        const current = bedAssignments[bed.id] || { status: 'clean', reason: 'clean' };
                        return (
                          <View key={bed.id} style={styles.bedRow}>
                            <Text style={styles.bedName}>{bed.name}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                              <View style={styles.toggleRow}>
                                {BED_STATES.map(state => {
                                  const isActive = current.status === state.key;
                                  return (
                                    <TouchableOpacity
                                      key={state.key}
                                      style={[
                                        styles.toggleBtn,
                                        { backgroundColor: isActive ? state.bg : COLORS.white },
                                        isActive && { borderColor: state.color, borderWidth: 2 },
                                      ]}
                                      onPress={() =>
                                        setBedAssignments(prev => ({
                                          ...prev,
                                          [bed.id]: { status: state.key, reason: state.key },
                                        }))
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.toggleText,
                                          { fontFamily: 'System', fontWeight: isActive ? '700' : '400' },
                                          isActive && { color: state.color },
                                        ]}
                                        numberOfLines={1}
                                      >
                                        {t('bedState_' + state.key)}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </ScrollView>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}

              {selectedRoom?.type === 'private' && Object.keys(assignmentAttributes).length > 0 && (
                <View style={{ marginBottom: SPACING[4] }}>
                  <Label>{t('roomFeatures')}</Label>
                  {Object.keys(assignmentAttributes).map(attr => {
                    const isActive = assignmentAttributes[attr];
                    return (
                      <TouchableOpacity
                        key={attr}
                        style={styles.attributeRow}
                        onPress={() =>
                          setAssignmentAttributes(prev => ({
                            ...prev,
                            [attr]: !prev[attr],
                          }))
                        }
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, isActive && styles.checkboxActive]}>
                          {isActive && <Icon name="checkmark" size={16} color={COLORS.white} />}
                        </View>
                        <Text style={styles.attributeLabel}>{attr}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Label>{t('roomFlags')}</Label>
              <View style={{ flexDirection: 'row', gap: SPACING[4], marginBottom: SPACING[4] }}>
                <TouchableOpacity
                  style={[styles.flagBtn, earlyCheckIn && { backgroundColor: '#FFFBEB', borderColor: '#D97706' }]}
                  onPress={() => setEarlyCheckIn(!earlyCheckIn)}
                >
                  <Text style={[styles.flagText, earlyCheckIn && { color: '#D97706' }]}>{t('earlyCheckInFlag')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.flagBtn, lateCheckOut && { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger }]}
                  onPress={() => setLateCheckOut(!lateCheckOut)}
                >
                  <Text style={[styles.flagText, lateCheckOut && { color: COLORS.danger }]}>{t('lateCheckOutFlag')}</Text>
                </TouchableOpacity>
              </View>

              <Label>{t('notesPlaceholder1')}</Label>
              <Input
                value={managerNotes}
                onChangeText={setManagerNotes}
                placeholder={t('notesPlaceholder2')}
                multiline
                style={{ marginBottom: SPACING[4] }}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowConfigModal(false)}
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                >
                  <Text style={styles.modalBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAssign}
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                >
                  <Text style={[styles.modalBtnText, { color: COLORS.white }]}>{t('assign')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING[4], paddingBottom: SPACING[10] },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING[2], flexWrap: 'wrap' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING[3], paddingVertical: SPACING[1], backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, marginTop: 4, alignSelf: 'flex-start' },
  clearText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  roomCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING[3], ...SHADOW.sm },
  roomInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING[3] },
  roomName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text, marginBottom: 2 },
  bedCount: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, alignSelf: 'center' },
  assignedTag: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2], backgroundColor: COLORS.primaryLight, paddingVertical: SPACING[1], paddingHorizontal: SPACING[3], borderRadius: RADIUS.sm },
  assignedName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.primary },
  unassignedHint: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontStyle: 'italic' },
  pillsContainer: { marginTop: 4 },
  pillsScroll: { gap: SPACING[2], paddingVertical: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: SPACING[6] },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING[5], width: '100%', maxWidth: 400, ...SHADOW.md },
  modalTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: SPACING[2] },
  modalSubtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING[4] },
  bedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[2] },
  bedName: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  toggleRow: { flexDirection: 'row', gap: SPACING[2] },
  toggleBtn: {
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[1],
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    minWidth: 70, alignItems: 'center',
  },
  toggleText: { fontFamily: 'System', fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  attributeRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    marginBottom: SPACING[2],
  },
  attributeLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  flagBtn: {
    flex: 1, paddingVertical: SPACING[2], borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  flagText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  modalActions: { flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[4] },
  modalBtn: { flex: 1, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  modalBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  modalBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalBtnText: { fontFamily: 'System', fontWeight: '600', fontSize: 16, color: COLORS.primary },
});