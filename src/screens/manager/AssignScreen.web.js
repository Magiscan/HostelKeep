import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import * as XLSX from 'xlsx';
import Icon from '../../components/Icon';
import { COLORS, RADIUS, FONTS, FONT_SIZE, SPACING, SHADOW } from '../../theme';
import {
  FloorHeader, EmptyState, Badge, Avatar, Label, Input,
} from '../../components/UI';
import { useApp } from '../../contexts/AppContext';

const BED_STATES = [
  { key: 'clean',    label: 'Clean',      color: COLORS.success, bg: COLORS.successLight },
  { key: 'stayover', label: 'Stay‑over',  color: COLORS.amber,   bg: COLORS.amberLight },
  { key: 'late',     label: 'Late c/out', color: COLORS.danger,  bg: COLORS.dangerLight },
  { key: 'early',    label: 'Early c/in', color: '#D97706',      bg: '#FFFBEB' },
  { key: 'noone',    label: 'No one',     color: COLORS.blue,    bg: COLORS.blueLight },
];
const BED_CYCLE = ['clean', 'stayover', 'late', 'early', 'noone'];

const CLEANER_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#65A30D', '#0891B2', '#4F46E5', '#BE123C',
];

const EXTRA_BLANK_ROWS = 5;
function formatDateIT(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}
function sanitizeSheetName(name) {
  const cleaned = (name || 'Cleaner').replace(/[:\\/?*[\]]/g, '').trim();
  return cleaned.slice(0, 31) || 'Cleaner';
}

export default function AssignScreen() {
  const { t } = useTranslation();
  const {
    rooms, cleaners, floors, assignRoomWithDetails, unassignRoom, roomStatus,
    updateRoomStatus, roomAttributes,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedRoomIds, setSelectedRoomIds] = useState(new Set());
  const [activeCleanerIds, setActiveCleanerIds] = useState(new Set(cleaners.map(c => c.id)));

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedCleaner, setSelectedCleaner] = useState(null);
  const [bedAssignments, setBedAssignments] = useState({});
  const [managerNotes, setManagerNotes] = useState('');
  const [commonOnly, setCommonOnly] = useState(false);
  const [assignmentAttributes, setAssignmentAttributes] = useState({});
  const [earlyCheckIn, setEarlyCheckIn] = useState(false);
  const [lateCheckOut, setLateCheckOut] = useState(false);

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const term = search.toLowerCase();
    return rooms.filter(r => r.name.toLowerCase().includes(term));
  }, [rooms, search]);

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

  const activeCleaners = cleaners.filter(c => activeCleanerIds.has(c.id));

  const toggleBedState = useCallback(async (roomId, bedId) => {
    const status = roomStatus[roomId] || {};
    const assignments = status.assignmentBedStatus || {};
    const current = assignments[bedId]?.status || 'clean';
    const nextIdx = (BED_CYCLE.indexOf(current) + 1) % BED_CYCLE.length;
    const nextStatus = BED_CYCLE[nextIdx];
    await updateRoomStatus(roomId, {
      assignmentBedStatus: { ...assignments, [bedId]: { status: nextStatus, reason: nextStatus } },
    });
  }, [roomStatus, updateRoomStatus]);

  const toggleRoomSelection = useCallback((roomId) => {
    setSelectedRoomIds(prev => {
      const next = new Set(prev);
      next.has(roomId) ? next.delete(roomId) : next.add(roomId);
      return next;
    });
  }, []);

  const bulkAssign = useCallback(async (cleanerId) => {
    const ids = Array.from(selectedRoomIds);
    if (!ids.length) return;
    for (const roomId of ids) {
      const status = roomStatus[roomId] || {};
      await assignRoomWithDetails(roomId, cleanerId,
        status.assignmentBedStatus || {}, status.managerNotes || '',
        status.commonOnly || false, status.assignmentAttributes || {},
        status.earlyCheckIn || false, status.lateCheckOut || false);
    }
    setSelectedRoomIds(new Set());
  }, [selectedRoomIds, assignRoomWithDetails, roomStatus]);

  const handleUnassign = useCallback((roomId) => {
    unassignRoom(roomId);
    setSelectedRoomIds(prev => { const next = new Set(prev); next.delete(roomId); return next; });
  }, [unassignRoom]);

  const toggleCommonOnly = useCallback(async (roomId) => {
    const status = roomStatus[roomId] || {};
    await updateRoomStatus(roomId, { commonOnly: !status.commonOnly });
  }, [roomStatus, updateRoomStatus]);

  const toggleRoomAttribute = useCallback(async (roomId, attr) => {
    const status = roomStatus[roomId] || {};
    const attrs = { ...(status.assignmentAttributes || {}) };
    attrs[attr] = !attrs[attr];
    await updateRoomStatus(roomId, { assignmentAttributes: attrs });
  }, [roomStatus, updateRoomStatus]);

  const clearAll = () => rooms.forEach(room => unassignRoom(room.id));

  const handleExportSheets = () => {
    const assignedCleanerIds = [...new Set(rooms.filter(r => r.assignedTo).map(r => r.assignedTo))];
    if (!assignedCleanerIds.length) {
      Alert.alert('No assignments', 'Assign rooms first.');
      return;
    }
    const wb = XLSX.utils.book_new();
    const dateStr = formatDateIT(new Date());
    const usedSheetNames = new Set();
    assignedCleanerIds.forEach(cleanerId => {
      const cleaner = cleaners.find(c => c.id === cleanerId);
      if (!cleaner) return;
      const assigned = rooms.filter(r => r.assignedTo === cleanerId).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const aoa = [];
      aoa.push([`${cleaner.username} – ${dateStr}`]);
      aoa.push(['Room', 'Beds', 'Done']);
      assigned.forEach(room => {
        let beds = '';
        if (room.type === 'dorm' && room.beds?.length) {
          const assign = (roomStatus[room.id] || {}).assignmentBedStatus || {};
          beds = room.beds.filter(b => (assign[b.id]?.status || 'clean') !== 'noone').map(b => b.name).join('-');
        }
        aoa.push([room.name, beds, '']);
      });
      for (let i = 0; i < EXTRA_BLANK_ROWS; i++) aoa.push(['', '', '']);
      aoa.push(['Signature', '', 'End Time:']);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
      ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 14 }];
      let name = sanitizeSheetName(cleaner.username);
      let unique = name, n = 1;
      while (usedSheetNames.has(unique)) unique = `${name.slice(0, 28)}_${n++}`;
      usedSheetNames.add(unique);
      XLSX.utils.book_append_sheet(wb, ws, unique);
    });
    XLSX.writeFile(wb, `assignment_sheets_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const openDetail = (room) => {
    const currentCleaner = cleaners.find(c => c.id === room.assignedTo);
    setSelectedRoom(room);
    setSelectedCleaner(currentCleaner || null);   // unassigned → null
    const existing = roomStatus[room.id] || {};
    const beds = {};
    if (room.type === 'dorm' && room.beds) {
        room.beds.forEach(b => {
        beds[b.id] = (existing.assignmentBedStatus || {})[b.id] || { status: 'clean', reason: 'clean' };
        });
    }
    setBedAssignments(beds);
    setCommonOnly(existing.commonOnly || false);
    setAssignmentAttributes(existing.assignmentAttributes || (room.attributes ? { ...room.attributes } : {}));
    setEarlyCheckIn(existing.earlyCheckIn || false);
    setLateCheckOut(existing.lateCheckOut || false);
    setManagerNotes(existing.managerNotes || '');
    setPanelOpen(true);
    };

    const closePanel = () => {
    setPanelOpen(false);
    setSelectedRoom(null);
    setSelectedCleaner(null);
    };

  const handleAssignFromPanel = async () => {
    if (!selectedRoom || !selectedCleaner) return;
    const finalBeds = {};
    if (selectedRoom.type === 'dorm' && selectedRoom.beds) {
      selectedRoom.beds.forEach(b => { finalBeds[b.id] = bedAssignments[b.id] || { status: 'clean', reason: 'clean' }; });
    }
    const attrs = {};
    Object.entries(assignmentAttributes).forEach(([k, v]) => { if (v) attrs[k] = true; });
    await assignRoomWithDetails(selectedRoom.id, selectedCleaner.id, finalBeds, managerNotes, commonOnly, attrs, earlyCheckIn, lateCheckOut);
    closePanel();
  };

  if (!rooms.length) return <EmptyState icon="📋" title={t('noRoomsToAssign')} subtitle={t('addRoomsFirst')} />;
  if (!cleaners.length) return <EmptyState icon="👤" title={t('noCleaners')} subtitle={t('addCleanersFirst')} />;

  const selectedRoomsList = useMemo(
    () => rooms.filter(r => selectedRoomIds.has(r.id)),
    [rooms, selectedRoomIds]
  );

  return (
    <View style={styles.container}>
      {/* Toolbar unchanged */}
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.pageTitle}>{t('assignments')}</Text>
          <Text style={styles.subtitle}>{t('tapToAssign')}</Text>
        </View>
        <View style={styles.toolbarRight}>
          <View style={styles.searchBar}>
            <Icon name="search-outline" size={16} color={COLORS.textMuted} style={{ marginRight: SPACING[2] }} />
            <TextInput value={search} onChangeText={setSearch} placeholder={t('search')} placeholderTextColor={COLORS.textMuted} style={styles.searchInput} />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                <Icon name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleExportSheets} style={styles.toolBtn}>
            <Icon name="print-outline" size={16} color={COLORS.primary} />
            <Text style={styles.toolBtnText}>{t('printSheets') || 'Print'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearAll} style={[styles.toolBtn, { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger }]}>
            <Icon name="close-circle-outline" size={16} color={COLORS.danger} />
            <Text style={[styles.toolBtnText, { color: COLORS.danger }]}>{t('clearAll')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.body}>
        <View style={styles.roomAreaWrapper}>
          {/* Persistent selection bar – improved design */}
          {selectedRoomIds.size > 0 && (
            <View style={styles.selectionBar}>
              <View style={styles.selectionBarInner}>
                <View style={styles.selectionLeft}>
                  <Icon name="checkbox-outline" size={18} color={COLORS.primary} style={{ marginRight: SPACING[2] }} />
                  <Text style={styles.selectionBarTitle}>
                    {t('selectedRooms', { count: selectedRoomIds.size }) || `${selectedRoomIds.size} room${selectedRoomIds.size > 1 ? 's' : ''} selected`}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectionScroll}>
                  {selectedRoomsList.map(room => (
                    <TouchableOpacity key={room.id} style={styles.selectionChip} onPress={() => toggleRoomSelection(room.id)}>
                      <Text style={styles.selectionChipText}>{room.name}</Text>
                      <Icon name="close" size={12} color={COLORS.primary} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.clearSelectionBtn} onPress={() => setSelectedRoomIds(new Set())}>
                  <Text style={styles.clearSelectionText}>{t('clearSelection') || 'Clear'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ScrollView style={styles.roomArea} contentContainerStyle={styles.roomAreaContent}>
            {filteredRooms.length === 0 && search.trim() !== '' && (
              <EmptyState icon="🔍" title={t('noResults')} subtitle="" />
            )}
            {sortedFloors.map(floor => {
              const floorRooms = filteredRooms.filter(r => r.floorId === floor.id);
              if (!floorRooms.length) return null;
              return (
                <View key={floor.id} style={{ marginBottom: SPACING[8] }}>
                  <FloorHeader label={floor.name} />
                  <View style={styles.roomGrid}>
                    {floorRooms.map(room => {
                      const currentCleaner = cleaners.find(c => c.id === room.assignedTo);
                      const isSelected = selectedRoomIds.has(room.id);
                      const status = roomStatus[room.id] || {};
                      const bedAssigns = status.assignmentBedStatus || {};
                      const beds = room.beds || [];
                      const cleanerColor = currentCleaner
                        ? CLEANER_COLORS[cleaners.findIndex(c => c.id === currentCleaner.id) % CLEANER_COLORS.length]
                        : COLORS.border;
                      const isFrozen = status.commonOnly;

                      return (
                        <View
                          key={room.id}
                          style={[
                            styles.roomCard,
                            isSelected && styles.roomCardSelected,
                            currentCleaner && { borderLeftWidth: 4, borderLeftColor: cleanerColor },
                          ]}
                        >
                          {/* Top row: name, more button, selection checkbox */}
                          <View style={styles.cardTopRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.roomName}>{room.name}</Text>
                              <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: 4 }}>
                                <Badge label={room.type === 'private' ? t('private') : t('dormitory')} type={room.type === 'private' ? 'priv' : 'dorm'} />
                                {room.type === 'dorm' && beds.length > 0 && (
                                  <Text style={styles.bedCount}>{beds.length} {t('beds')}</Text>
                                )}
                              </View>
                            </View>
                            <View style={styles.cardTopActions}>
                              <TouchableOpacity style={styles.iconBtn} onPress={() => openDetail(room)} activeOpacity={0.7}>
                                <Icon name="create-outline" size={18} color={COLORS.textSecondary} />
                              </TouchableOpacity>
                              {!currentCleaner && (
                                <TouchableOpacity
                                  onPress={() => toggleRoomSelection(room.id)}
                                  style={styles.selectCheckbox}
                                >
                                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                                    {isSelected && <Icon name="checkmark" size={16} color={COLORS.white} />}
                                  </View>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>

                          {/* Bed toggles (dorm only) – frozen when commonOnly */}
                          {room.type === 'dorm' && beds.length > 0 && (
                            <View style={styles.bedList}>
                              {beds.map(bed => {
                                const state = bedAssigns[bed.id]?.status || 'clean';
                                const st = BED_STATES.find(s => s.key === state) || BED_STATES[0];
                                return (
                                  <TouchableOpacity
                                    key={bed.id}
                                    style={[
                                      styles.bedChip,
                                      { backgroundColor: st.bg, borderColor: st.color },
                                      isFrozen && styles.bedChipFrozen,
                                    ]}
                                    onPress={() => toggleBedState(room.id, bed.id)}
                                    disabled={isFrozen}
                                    activeOpacity={isFrozen ? 1 : 0.7}
                                  >
                                    <Text style={[styles.bedChipName, { color: isFrozen ? COLORS.textMuted : st.color }]}>{bed.name}</Text>
                                    <Text style={[styles.bedChipState, { color: isFrozen ? COLORS.textMuted : st.color }]}>{t('bedState_' + state)}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}

                          {/* Private room attributes – clickable toggles */}
                          {room.type === 'private' && roomAttributes.length > 0 && (
                            <View style={styles.attributeList}>
                              {roomAttributes.map(attr => {
                                const isActive = (status.assignmentAttributes || {})[attr] || false;
                                return (
                                  <TouchableOpacity
                                    key={attr}
                                    style={[styles.attrChip, isActive && styles.attrChipActive]}
                                    onPress={() => toggleRoomAttribute(room.id, attr)}
                                    disabled={isFrozen}
                                    activeOpacity={0.7}
                                  >
                                    <Icon
                                      name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                                      size={14}
                                      color={isActive ? COLORS.primary : (isFrozen ? COLORS.textMuted : COLORS.textSecondary)}
                                      style={{ marginRight: 4 }}
                                    />
                                    <Text style={[styles.attrChipText, isActive && { color: COLORS.primary }, isFrozen && { color: COLORS.textMuted }]}>
                                      {attr}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}

                          {/* Common areas checkbox – always active */}
                          <View style={styles.commonRow}>
                            <TouchableOpacity
                              style={styles.commonCheckRow}
                              onPress={() => toggleCommonOnly(room.id)}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.checkbox, status.commonOnly && styles.checkboxActive]}>
                                {status.commonOnly && <Icon name="checkmark" size={16} color={COLORS.white} />}
                              </View>
                              <Text style={styles.commonLabel}>{t('commonOnly')}</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Assigned cleaner + actions */}
                          <View style={styles.cardBottom}>
                            <View style={styles.cleanerInfo}>
                              {currentCleaner ? (
                                <View style={styles.cleanerRow}>
                                  <View style={[styles.cleanerDot, { backgroundColor: cleanerColor }]} />
                                  <Text style={styles.cleanerNameSmall}>{currentCleaner.username}</Text>
                                </View>
                              ) : (
                                <Text style={styles.unassigned}>—</Text>
                              )}
                            </View>
                            <View style={styles.cardActions}>
                              {currentCleaner && (
                                <TouchableOpacity
                                  style={[styles.cardBtn, { borderColor: COLORS.danger }]}
                                  onPress={() => handleUnassign(room.id)}
                                  activeOpacity={0.7}
                                >
                                  <Icon name="close" size={15} color={COLORS.danger} />
                                  <Text style={[styles.cardBtnText, { color: COLORS.danger }]}>{t('unassign')}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>

        {/* Sidebar unchanged */}
        <View style={styles.sidebar}>
          <Text style={styles.sidebarTitle}>{t('workingToday') || 'Working Today'}</Text>
          <ScrollView style={{ flex: 1 }}>
            {cleaners.map((cleaner, idx) => {
              const isActive = activeCleanerIds.has(cleaner.id);
              const color = CLEANER_COLORS[idx % CLEANER_COLORS.length];
              return (
                <TouchableOpacity
                  key={cleaner.id}
                  style={styles.cleanerItem}
                  onPress={() => {
                    setActiveCleanerIds(prev => {
                      const next = new Set(prev);
                      isActive ? next.delete(cleaner.id) : next.add(cleaner.id);
                      return next;
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.cleanerColorDot, { backgroundColor: color }]} />
                  <Text style={[styles.cleanerItemName, !isActive && { color: COLORS.textMuted }]}>{cleaner.username}</Text>
                  <View style={[styles.checkboxMini, isActive && styles.checkboxMiniActive]}>
                    {isActive && <Icon name="checkmark" size={12} color={COLORS.white} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {selectedRoomIds.size > 0 && (
            <View style={styles.bulkSection}>
              <Text style={styles.bulkLabel}>{t('assignSelected', { count: selectedRoomIds.size }) || `Assign ${selectedRoomIds.size} rooms`}</Text>
              <View style={styles.bulkCleanerList}>
                {activeCleaners.map(cleaner => (
                  <TouchableOpacity key={cleaner.id} style={styles.bulkCleanerBtn} onPress={() => bulkAssign(cleaner.id)}>
                    <Text style={styles.bulkCleanerText}>{cleaner.username}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Side panel unchanged */}
      {panelOpen && (
        <View style={styles.panel}>
            <View style={styles.panelHeader}>
            <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>{t('assign')} {selectedRoom?.name}</Text>
                <Text style={styles.panelSubtitle}>
                {t('cleaner')}: {selectedCleaner?.username || t('unassigned')}
                </Text>
            </View>
            <TouchableOpacity onPress={closePanel} style={styles.panelClose}>
                <Icon name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
            </View>

            <ScrollView style={styles.panelBody} contentContainerStyle={{ paddingBottom: SPACING[6] }}>
            {/* Cleaner picker – shown when unassigned or to change */}
            <View style={{ marginBottom: SPACING[5] }}>
                <Label>{t('assignTo') || 'Assign to'}</Label>
                {selectedCleaner ? (
                <View style={styles.assignedCleanerRow}>
                    <View style={styles.cleanerRow}>
                    <View style={[styles.cleanerDot, { backgroundColor: CLEANER_COLORS[cleaners.findIndex(c => c.id === selectedCleaner.id) % CLEANER_COLORS.length] }]} />
                    <Text style={styles.cleanerNameSmall}>{selectedCleaner.username}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedCleaner(null)}>
                    <Text style={{ color: COLORS.danger, fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs }}>{t('change') || 'Change'}</Text>
                    </TouchableOpacity>
                </View>
                ) : (
                <View style={styles.cleanerPickerList}>
                    {activeCleaners.map((cleaner, idx) => (
                    <TouchableOpacity
                        key={cleaner.id}
                        style={styles.cleanerPickerChip}
                        onPress={() => setSelectedCleaner(cleaner)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.cleanerDot, { backgroundColor: CLEANER_COLORS[idx % CLEANER_COLORS.length] }]} />
                        <Text style={styles.cleanerPickerChipText}>{cleaner.username}</Text>
                    </TouchableOpacity>
                    ))}
                </View>
                )}
            </View>

            {selectedRoom?.type === 'dorm' && selectedRoom.beds?.length > 0 && (
                <View style={{ marginBottom: SPACING[5] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[2] }}>
                    <Label>{t('commonOnly')}</Label>
                    <TouchableOpacity onPress={() => setCommonOnly(!commonOnly)} style={[styles.checkbox, commonOnly && styles.checkboxActive]}>
                    {commonOnly && <Icon name="checkmark" size={16} color={COLORS.white} />}
                    </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>{commonOnly ? t('commonOnly') : t('scrollToSeeOptions')}</Text>

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
                                    style={[styles.toggleBtn, { backgroundColor: isActive ? state.bg : COLORS.white }, isActive && { borderColor: state.color, borderWidth: 2 }]}
                                    onPress={() => setBedAssignments(prev => ({ ...prev, [bed.id]: { status: state.key, reason: state.key } }))}
                                >
                                    <Text style={[styles.toggleText, { fontWeight: isActive ? '700' : '400' }, isActive && { color: state.color }]} numberOfLines={1}>
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
                    <TouchableOpacity key={attr} style={styles.attributeRow} onPress={() => setAssignmentAttributes(prev => ({ ...prev, [attr]: !prev[attr] }))}>
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
                <TouchableOpacity style={[styles.flagBtn, earlyCheckIn && { backgroundColor: '#FFFBEB', borderColor: '#D97706' }]} onPress={() => setEarlyCheckIn(!earlyCheckIn)}>
                <Text style={[styles.flagText, earlyCheckIn && { color: '#D97706' }]}>{t('earlyCheckInFlag')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.flagBtn, lateCheckOut && { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger }]} onPress={() => setLateCheckOut(!lateCheckOut)}>
                <Text style={[styles.flagText, lateCheckOut && { color: COLORS.danger }]}>{t('lateCheckOutFlag')}</Text>
                </TouchableOpacity>
            </View>

            <Label>{t('notesPlaceholder1')}</Label>
            <Input value={managerNotes} onChangeText={setManagerNotes} placeholder={t('notesPlaceholder2')} multiline style={{ marginBottom: SPACING[2] }} />
            </ScrollView>

            <View style={styles.panelFooter}>
            <TouchableOpacity onPress={closePanel} style={[styles.panelBtn, styles.panelBtnCancel]}>
                <Text style={styles.panelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleAssignFromPanel}
                disabled={!selectedCleaner}
                style={[styles.panelBtn, styles.panelBtnPrimary, !selectedCleaner && { opacity: 0.5 }]}
            >
                <Text style={[styles.panelBtnText, { color: COLORS.white }]}>{t('assign')}</Text>
            </TouchableOpacity>
            </View>
        </View>
        )}
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING[6], paddingVertical: SPACING[4],
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexWrap: 'wrap', gap: SPACING[3],
  },
  pageTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  subtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING[3], flexWrap: 'wrap' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    width: 240,
  },
  searchInput: { flex: 1, fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.text },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  toolBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.primary },

  body: { flex: 1, flexDirection: 'row' },
  roomAreaWrapper: { flex: 1 },
  roomArea: { flex: 1 },
  roomAreaContent: { padding: SPACING[6] },

  /* Persistent selection bar – card-like design */
  selectionBar: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING[6],
    marginTop: SPACING[4],
    marginBottom: 0,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[3],
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    flexDirection: 'column',
  },
  selectionBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionLeft: { flexDirection: 'row', alignItems: 'center', marginRight: SPACING[3] },
  selectionBarTitle: {
    fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.primary,
  },
  selectionScroll: { flex: 1 },
  selectionChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING[2], paddingVertical: 2,
    marginRight: SPACING[2],
    borderWidth: 1, borderColor: COLORS.primary,
  },
  selectionChipText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.primary },
  clearSelectionBtn: {
    marginLeft: SPACING[2],
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[1],
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  clearSelectionText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.primary },

  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[4] },
  roomCard: {
    width: 340,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING[4], ...SHADOW.sm,
  },
  roomCardSelected: { borderColor: COLORS.primary, borderWidth: 2 },

  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: SPACING[3],
  },
  cardTopActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2] },
  iconBtn: { padding: 4 },
  selectCheckbox: { padding: 2 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  roomName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text },
  bedCount: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  bedList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], marginBottom: SPACING[3] },
  bedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: RADIUS.sm, borderWidth: 1,
  },
  bedChipFrozen: {
    backgroundColor: COLORS.border,
    borderColor: COLORS.textMuted,
    opacity: 0.6,
  },
  bedChipName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.text },
  bedChipState: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.text },

  /* Private room attributes */
  attributeList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], marginBottom: SPACING[3] },
  attrChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  attrChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  attrChipText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  commonRow: { marginBottom: SPACING[3] },
  commonCheckRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2] },
  commonLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cleanerInfo: { flex: 1 },
  cleanerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2] },
  cleanerDot: { width: 10, height: 10, borderRadius: 5 },
  cleanerNameSmall: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.text },
  unassigned: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontStyle: 'italic' },

  cardActions: { flexDirection: 'row', gap: SPACING[2] },
  cardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  cardBtnText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  /* Sidebar narrower */
  sidebar: {
    width: 220, backgroundColor: COLORS.surface,
    borderLeftWidth: 1, borderLeftColor: COLORS.border,
    padding: SPACING[4],
  },
  sidebarTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING[3] },
  cleanerItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    paddingVertical: SPACING[2], paddingHorizontal: SPACING[2],
    borderRadius: RADIUS.sm,
  },
  cleanerColorDot: { width: 10, height: 10, borderRadius: 5 },
  cleanerItemName: { flex: 1, fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text },
  checkboxMini: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxMiniActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  bulkSection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING[3], marginTop: SPACING[2] },
  bulkLabel: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.text, marginBottom: SPACING[2] },
  bulkCleanerList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2] },
  bulkCleanerBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    borderWidth: 1, borderColor: COLORS.primary,
  },
  bulkCleanerText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.primary },

  /* Side panel */
  panel: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 440, backgroundColor: COLORS.surface,
    borderLeftWidth: 1, borderLeftColor: COLORS.border,
    ...SHADOW.lg, zIndex: 20,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: SPACING[5], borderBottomWidth: 1, borderBottomColor: COLORS.border,
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
  bedGroup: { paddingBottom: SPACING[3], borderBottomWidth: 1, borderBottomColor: COLORS.border },
  bedName: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING[2] },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2] },
  toggleBtn: {
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    minWidth: 78, alignItems: 'center',
  },
  toggleText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  attributeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2], marginBottom: SPACING[2] },
  attributeLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },

  flagBtn: {
    flex: 1, paddingVertical: SPACING[2], borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  flagText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  /* Cleaner picker inside panel */
    assignedCleanerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING[2], paddingHorizontal: SPACING[2],
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING[2],
    },
    cleanerPickerList: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2],
    },
    cleanerPickerChip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    paddingVertical: SPACING[2], paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    },
    cleanerPickerChipText: {
    fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text,
    },
});