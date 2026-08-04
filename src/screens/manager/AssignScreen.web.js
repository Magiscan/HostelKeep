import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
} from 'react-native';
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

  const [search, setSearch] = useState('');

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const term = search.toLowerCase();
    return rooms.filter(r => r.name.toLowerCase().includes(term));
  }, [rooms, search]);

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
  const [panelOpen, setPanelOpen] = useState(false);
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

    setEarlyCheckIn(existingStatus.earlyCheckIn || false);
    setLateCheckOut(existingStatus.lateCheckOut || false);

    setManagerNotes(existingStatus.managerNotes || '');
    setPanelOpen(true);
  };

  const closeConfig = () => {
    setPanelOpen(false);
    setSelectedRoom(null);
    setSelectedCleaner(null);
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
    closeConfig();
  };

  if (rooms.length === 0) {
    return (
      <View style={styles.safe}>
        <EmptyState icon="📋" title={t('noRoomsToAssign')} subtitle={t('addRoomsFirst')} />
      </View>
    );
  }

  if (cleaners.length === 0) {
    return (
      <View style={styles.safe}>
        <EmptyState icon="👤" title={t('noCleaners')} subtitle={t('addCleanersFirst')} />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      {/* ── Toolbar ── */}
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.title}>{t('assignments')}</Text>
          <Text style={styles.subtitle}>{t('tapToAssign')}</Text>
        </View>

        <View style={styles.toolbarActions}>
          <View style={styles.searchContainer}>
            <Icon name="search-outline" size={16} color={COLORS.textMuted} style={{ marginRight: SPACING[2] }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('search')}
              placeholderTextColor={COLORS.textMuted}
              style={styles.searchInput}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                <Icon name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn} activeOpacity={0.7}>
            <Icon name="close-circle-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.clearText}>{t('clearAll')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Body: room grid + side panel ── */}
      <View style={styles.body}>
        <ScrollView style={styles.mainArea} contentContainerStyle={styles.mainAreaContent}>
          {filteredRooms.length === 0 && search.trim() !== '' && (
            <EmptyState icon="🔍" title={t('noResults')} subtitle="" />
          )}

          {sortedFloors.map(floor => {
            const floorRooms = filteredRooms.filter(r => r.floorId === floor.id);
            if (!floorRooms.length) return null;
            return (
              <View key={floor.id} style={{ marginBottom: SPACING[6] }}>
                <FloorHeader label={floor.name} />
                <View style={styles.roomGrid}>
                  {floorRooms.map(room => {
                    const currentCleaner = cleaners.find(c => c.id === room.assignedTo);
                    const isSelected = panelOpen && selectedRoom?.id === room.id;
                    return (
                      <View
                        key={room.id}
                        style={[styles.roomCard, isSelected && styles.roomCardActive]}
                      >
                        <View style={styles.roomCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.roomName}>{room.name}</Text>
                            <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: 4, alignItems: 'center' }}>
                              <Badge label={room.type === 'private' ? t('private') : t('dormitory')} type={room.type === 'private' ? 'priv' : 'dorm'} />
                              {room.type === 'dorm' && room.beds?.length > 0 && (
                                <Text style={styles.bedCount}>{room.beds.length} {t('beds')}</Text>
                              )}
                            </View>
                          </View>
                        </View>

                        {currentCleaner ? (
                          <View style={styles.assignedTag}>
                            <Avatar name={currentCleaner.username} size={24} />
                            <Text style={styles.assignedName}>{currentCleaner.username}</Text>
                          </View>
                        ) : (
                          <Text style={styles.unassignedHint}>{t('noCleaner')}</Text>
                        )}

                        <View style={styles.pillsContainer}>
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
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* ── Side panel (replaces mobile modal) ── */}
        {panelOpen && (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>{t('assign')} {selectedRoom?.name}</Text>
                <Text style={styles.panelSubtitle}>{t('cleaner')}: {selectedCleaner?.username}</Text>
              </View>
              <TouchableOpacity onPress={closeConfig} style={styles.panelClose}>
                <Icon name="close" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.panelBody} contentContainerStyle={{ paddingBottom: SPACING[6] }}>
              {selectedRoom?.type === 'dorm' && selectedRoom.beds?.length > 0 && (
                <View style={{ marginBottom: SPACING[5] }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[2] }}>
                    <Label>{t('commonOnly')}</Label>
                    <TouchableOpacity
                      onPress={() => setCommonOnly(!commonOnly)}
                      style={[styles.checkbox, commonOnly && styles.checkboxActive]}
                    >
                      {commonOnly && <Icon name="checkmark" size={16} color={COLORS.white} />}
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.helperText}>
                    {commonOnly ? t('commonOnly') : t('scrollToSeeOptions')}
                  </Text>

                  {!commonOnly && (
                    <View style={{ marginTop: SPACING[3], gap: SPACING[4] }}>
                      {selectedRoom.beds.map(bed => {
                        const current = bedAssignments[bed.id] || { status: 'clean', reason: 'clean' };
                        return (
                          <View key={bed.id} style={styles.bedGroup}>
                            <Text style={styles.bedName}>{bed.name}</Text>
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
                                        { fontWeight: isActive ? '700' : '400' },
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
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {selectedRoom?.type === 'private' && Object.keys(assignmentAttributes).length > 0 && (
                <View style={{ marginBottom: SPACING[5] }}>
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
              <View style={{ flexDirection: 'row', gap: SPACING[3], marginBottom: SPACING[5] }}>
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
                style={{ marginBottom: SPACING[2] }}
              />
            </ScrollView>

            <View style={styles.panelFooter}>
              <TouchableOpacity
                onPress={closeConfig}
                style={[styles.panelBtn, styles.panelBtnCancel]}
              >
                <Text style={styles.panelBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAssign}
                style={[styles.panelBtn, styles.panelBtnPrimary]}
              >
                <Text style={[styles.panelBtnText, { color: COLORS.white }]}>{t('assign')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING[3],
    paddingHorizontal: SPACING[6],
    paddingVertical: SPACING[4],
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  subtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING[3] },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[2],
    width: 260,
  },
  searchInput: { flex: 1, fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.text },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    backgroundColor: COLORS.background, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  clearText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  body: { flex: 1, flexDirection: 'row' },
  mainArea: { flex: 1 },
  mainAreaContent: { padding: SPACING[6] },

  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[4] },
  roomCard: {
    width: 300,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING[4],
    ...SHADOW.sm,
  },
  roomCardActive: { borderColor: COLORS.primary, borderWidth: 2 },
  roomCardHeader: { marginBottom: SPACING[2] },
  roomName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text, marginBottom: 2 },
  bedCount: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  assignedTag: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    backgroundColor: COLORS.primaryLight, alignSelf: 'flex-start',
    paddingVertical: SPACING[1], paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.sm, marginBottom: SPACING[3],
  },
  assignedName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.primary },
  unassignedHint: {
    fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textMuted,
    fontStyle: 'italic', marginBottom: SPACING[3],
  },
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2] },

  panel: {
    width: 440,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    ...SHADOW.md,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: SPACING[5],
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  panelTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: 2 },
  panelSubtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  panelClose: { padding: 4 },
  panelBody: { flex: 1, padding: SPACING[5] },
  panelFooter: {
    flexDirection: 'row', gap: SPACING[3],
    padding: SPACING[5],
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  panelBtn: { flex: 1, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  panelBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  panelBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  panelBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },

  helperText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  bedGroup: {
    paddingBottom: SPACING[3],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bedName: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING[2] },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2] },
  toggleBtn: {
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    minWidth: 78, alignItems: 'center',
  },
  toggleText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

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
});