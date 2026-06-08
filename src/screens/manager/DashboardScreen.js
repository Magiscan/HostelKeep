import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, SPACING } from '../../theme';
import {
  SectionTitle, Card, Badge, ProgressBar, EmptyState, Button, Chip, FloorHeader,
} from '../../components/UI';
import { useApp } from '../../contexts/AppContext';

const REASONS = {
  clean:    { label: 'Clean',      color: COLORS.success, bg: COLORS.successLight },
  stayover: { label: 'Stay‑over',  color: COLORS.amber,   bg: COLORS.amberLight },
  late:     { label: 'Late c/out', color: COLORS.danger,  bg: COLORS.dangerLight },
  early:    { label: 'Early c/in', color: COLORS.primary,      bg: COLORS.primaryLight },
  noone:    { label: 'No one',     color: COLORS.blue,    bg: COLORS.blueLight },
  common:   { label: 'Common',     color: COLORS.textMuted, bg: COLORS.surface },
};

// ─── Confirmation Modal ────────────────────────────────────────
function ConfirmModal({ visible, onConfirm, onCancel, title, message }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onCancel} style={[styles.modalBtn, styles.modalBtnCancel]}>
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={[styles.modalBtn, styles.modalBtnDanger]}>
              <Text style={[styles.modalBtnText, { color: COLORS.white }]}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Cleaner Detail Modal ──────────────────────────────────────
function CleanerDetailModal({ visible, cleaner, rooms = [], roomStatus, onClose }) {
  if (!cleaner) return null;
  const assignedRooms = rooms.filter(r => r.assignedTo === cleaner.id);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitle}>{cleaner.username}'s Rooms</Text>
          <ScrollView style={{ marginBottom: SPACING[4] }}>
            {assignedRooms.length === 0 ? (
              <Text style={styles.emptyText}>No rooms assigned yet.</Text>
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
                const isLate  = status.lateCheckOut === true;
                // check dorm beds for early/late
                const hasEarlyBed = room.type === 'dorm' && room.beds?.some(b => (assignmentBedStatus[b.id] || {}).status === 'early');
                const hasLateBed  = room.type === 'dorm' && room.beds?.some(b => (assignmentBedStatus[b.id] || {}).status === 'late');
                const showEarly = isEarly || hasEarlyBed;
                const showLate  = isLate  || hasLateBed;

                return (
                  <View key={room.id} style={styles.cleanerRoomCard}>
                    <View style={styles.roomHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.roomName}>{room.name}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {status.extraCleaning && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              <Text style={{ fontSize: 14 }}>⭐</Text>
                              <Text style={{ fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.primary }}>Extra</Text>
                            </View>
                          )}
                          {showEarly && (
                            <View style={{ backgroundColor: COLORS.blueLight, paddingHorizontal: SPACING[1], paddingVertical: 1, borderRadius: RADIUS.sm }}>
                              <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.xs, color: COLORS.blue }}>Early c/in</Text>
                            </View>
                          )}
                          {showLate && (
                            <View style={{ backgroundColor: COLORS.dangerLight, paddingHorizontal: SPACING[1], paddingVertical: 1, borderRadius: RADIUS.sm }}>
                              <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.xs, color: COLORS.danger }}>Late c/out</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Badge label={cleaned ? 'Cleaned' : 'Pending'} type={cleaned ? 'clean' : 'extra'} />
                    </View>
                    {managerNotes ? (
                      <View style={styles.managerNotesBox}>
                        <Text style={styles.managerNotesText}>📋 {managerNotes}</Text>
                      </View>
                    ) : null}
                    {extraTime > 0 && <Text style={styles.detailLine}>Extra time: +{extraTime} min</Text>}
                    {notes ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesText}>📝 “{notes}”</Text>
                      </View>
                    ) : null}
                    {room.type === 'private' && Object.keys(assignmentAttributes).length > 0 && (
                      <View style={styles.attributeSection}>
                        <Text style={styles.detailLine}>Room features:</Text>
                        {Object.entries(assignmentAttributes).map(([attr]) => (
                          <View key={attr} style={styles.attributeRow}>
                            <Ionicons
                              name={cleaned ? 'checkmark-circle' : 'ellipse-outline'}
                              size={16}
                              color={cleaned ? COLORS.success : COLORS.textMuted}
                              style={{ marginRight: SPACING[1] }}
                            />
                            <Text style={styles.attributeText}>{attr}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {isCommon ? (
                      <View style={styles.commonIndicator}>
                        <Ionicons
                          name={cleaned ? 'checkmark-circle' : 'ellipse-outline'}
                          size={18}
                          color={cleaned ? COLORS.success : COLORS.textMuted}
                        />
                        <Text style={[styles.commonText, cleaned && { color: COLORS.success }]}>
                          {cleaned ? 'Common areas cleaned' : 'Common areas not yet cleaned'}
                        </Text>
                      </View>
                    ) : (
                      room.type === 'dorm' && room.beds?.length > 0 && (
                        <View style={styles.bedSummary}>
                          {room.beds.map(bed => {
                            const assignment = assignmentBedStatus[bed.id] || { status: 'clean', reason: 'clean' };
                            const reasonKey = assignment.reason || assignment.status || 'clean';
                            const reason = REASONS[reasonKey] || REASONS.clean;

                            // The cleaner's own cleaning mark
                            const bedClean = bedStatus[bed.id]?.status === 'cleaned';

                            // Beds that are locked and never cleaned by the cleaner
                            const isSkipped = assignment.status === 'stayover' || assignment.status === 'noone';

                            // All other beds can be cleaned – show checkmark if the cleaner did it
                            const isCleaned = !isSkipped && bedClean;

                            return (
                              <Chip
                                key={bed.id}
                                label={`${isCleaned ? '✓' : isSkipped ? '⊘' : '○'} ${bed.name}`}
                                colorText={isCleaned ? COLORS.success : reason.color}
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
          <Button title="Close" onPress={onClose} variant="secondary" style={{ alignSelf: 'center' }} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Room Detail Modal ──────────────────────────────────────────
function RoomDetailModal({ visible, room, roomStatus, cleaners, onClose }) {
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
  const isLate  = status.lateCheckOut === true;
  const hasEarlyBed = room.type === 'dorm' && room.beds?.some(b => (assignmentBedStatus[b.id] || {}).status === 'early');
  const hasLateBed  = room.type === 'dorm' && room.beds?.some(b => (assignmentBedStatus[b.id] || {}).status === 'late');
  const showEarly = isEarly || hasEarlyBed;
  const showLate  = isLate  || hasLateBed;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitle}>{room.name}</Text>
          <View style={styles.roomHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.roomName}>{room.name}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {status.extraCleaning && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={{ fontSize: 14 }}>⭐</Text>
                    <Text style={{ fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.primary }}>Extra</Text>
                  </View>
                )}
                {showEarly && (
                  <View style={{ backgroundColor: COLORS.blueLight, paddingHorizontal: SPACING[1], paddingVertical: 1, borderRadius: RADIUS.sm }}>
                    <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.xs, color: COLORS.blue }}>Early c/in</Text>
                  </View>
                )}
                {showLate && (
                  <View style={{ backgroundColor: COLORS.dangerLight, paddingHorizontal: SPACING[1], paddingVertical: 1, borderRadius: RADIUS.sm }}>
                    <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.xs, color: COLORS.danger }}>Late c/out</Text>
                  </View>
                )}
              </View>
            </View>
            <Badge label={cleaned ? 'Cleaned' : 'Pending'} type={cleaned ? 'clean' : 'extra'} />
          </View>
          <ScrollView style={{ marginBottom: SPACING[4] }}>
            <Text style={styles.detailLine}>Cleaner: {cleaner ? cleaner.username : 'Unassigned'}</Text>
            {managerNotes ? (
              <View style={styles.managerNotesBox}>
                <Text style={styles.managerNotesText}>📋 {managerNotes}</Text>
              </View>
            ) : null}
            {extraTime > 0 && <Text style={styles.detailLine}>Extra time: +{extraTime} min</Text>}
            {notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>📝 “{notes}”</Text>
              </View>
            ) : null}
            {room.type === 'private' && Object.keys(assignmentAttributes).length > 0 && (
              <View style={styles.attributeSection}>
                <Text style={styles.detailLine}>Room features:</Text>
                {Object.entries(assignmentAttributes).map(([attr]) => (
                  <View key={attr} style={styles.attributeRow}>
                    <Ionicons
                      name={cleaned ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={cleaned ? COLORS.success : COLORS.textMuted}
                      style={{ marginRight: SPACING[1] }}
                    />
                    <Text style={styles.attributeText}>{attr}</Text>
                  </View>
                ))}
              </View>
            )}
            {isCommon ? (
              <View style={styles.commonIndicator}>
                <Ionicons
                  name={cleaned ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={cleaned ? COLORS.success : COLORS.textMuted}
                />
                <Text style={[styles.commonText, cleaned && { color: COLORS.success }]}>
                  {cleaned ? 'Common areas cleaned' : 'Common areas not yet cleaned'}
                </Text>
              </View>
            ) : (
              room.type === 'dorm' && room.beds?.length > 0 && (
                <View style={styles.bedSummary}>
                  {room.beds.map(bed => {
                    const assignment = assignmentBedStatus[bed.id] || { status: 'clean', reason: 'clean' };
                    const reasonKey = assignment.reason || assignment.status || 'clean';
                    const reason = REASONS[reasonKey] || REASONS.clean;

                    // The cleaner's own cleaning mark
                    const bedClean = bedStatus[bed.id]?.status === 'cleaned';

                    // Beds that are locked and never cleaned by the cleaner
                    const isSkipped = assignment.status === 'stayover' || assignment.status === 'noone';

                    // All other beds can be cleaned – show checkmark if the cleaner did it
                    const isCleaned = !isSkipped && bedClean;

                    return (
                      <Chip
                        key={bed.id}
                        label={`${isCleaned ? '✓' : isSkipped ? '⊘' : '○'} ${bed.name}`}
                        colorText={isCleaned ? COLORS.success : reason.color}
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
          <Button title="Close" onPress={onClose} variant="secondary" style={{ alignSelf: 'center' }} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Dashboard Screen ──────────────────────────────────────
export default function DashboardScreen() {
  const {
    rooms = [], roomStatus = {}, hostel = {}, floors = [], cleaners = [],
    updateRoomStatus, resetAllRoomStatus,
    extraRequests = [],
    approveExtraRoom, rejectExtraRoom,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);

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

  const confirmResetAll = () => { resetAllRoomStatus(); setResetAllModal(false); };
  const confirmResetSingle = () => {
    if (resetSingleModal) {
      updateRoomStatus(resetSingleModal, { cleaned: false, notes: '', extraTime: 0, bedStatus: {} });
      setResetSingleModal(null);
    }
  };

  const toggleFloor = (floorId) => setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));

  if (!hostel.name) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <EmptyState icon="🏠" title="No property" subtitle="Create a hostel first" />
      </ScrollView>
    );
  }

  const overallCleaned = rooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const overallPct = rooms.length ? Math.round((overallCleaned / rooms.length) * 100) : 0;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headRow}>
        <SectionTitle title="Today’s Overview" subtitle={hostel.name} />
        <TouchableOpacity onPress={() => setResetAllModal(true)} style={styles.resetAllBtn}>
          <Ionicons name="refresh" size={18} color={COLORS.danger} />
          <Text style={styles.resetAllText}>Reset all rooms</Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.overviewCard}>
        <Text style={styles.overviewText}>{overallCleaned} of {rooms.length} rooms cleaned ({overallPct}%)</Text>
        <ProgressBar pct={overallPct} />
      </Card>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={{ marginRight: SPACING[2] }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search for a room…"
          placeholderTextColor={COLORS.textMuted}
          style={styles.searchInput}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {filteredRooms !== null && (
        <View style={{ marginBottom: SPACING[4] }}>
          <SectionTitle
            title={`Search Results (${filteredRooms.length})`}
            subtitle={search.trim() ? `Matching "${search.trim()}"` : ''}
          />
          {filteredRooms.length === 0 ? (
            <Text style={styles.emptyText}>No rooms found.</Text>
          ) : (
            filteredRooms.map(room => {
              const status = roomStatus[room.id] || {};
              const cleaned = status.cleaned || false;
              const cleaner = cleaners.find(c => c.id === room.assignedTo);
              const isEarly = status.earlyCheckIn === true;
              const isLate  = status.lateCheckOut === true;
              const assignmentBedStatus = status.assignmentBedStatus || {};
              const hasEarlyBed = room.type === 'dorm' && room.beds?.some(b => (assignmentBedStatus[b.id] || {}).status === 'early');
              const hasLateBed  = room.type === 'dorm' && room.beds?.some(b => (assignmentBedStatus[b.id] || {}).status === 'late');
              const showEarly = isEarly || hasEarlyBed;
              const showLate  = isLate  || hasLateBed;
              return (
                <TouchableOpacity key={room.id} onPress={() => setSelectedRoom(room)} activeOpacity={0.7}>
                  <Card style={styles.roomDetailCard}>
                    <View style={styles.roomHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING[2] }}>
                        <Text style={styles.roomName}>{room.name}</Text>
                        {showEarly && (
                          <View style={{ backgroundColor: COLORS.blueLight, paddingHorizontal: SPACING[2], paddingVertical: 2, borderRadius: RADIUS.sm }}>
                            <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.xs, color: COLORS.blue }}>Early c/in</Text>
                          </View>
                        )}
                        {showLate && (
                          <View style={{ backgroundColor: COLORS.dangerLight, paddingHorizontal: SPACING[2], paddingVertical: 2, borderRadius: RADIUS.sm }}>
                            <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.xs, color: COLORS.danger }}>Late c/out</Text>
                          </View>
                        )}
                      </View>
                      <Badge label={cleaned ? 'Cleaned' : 'Pending'} type={cleaned ? 'clean' : 'extra'} />
                    </View>
                    <Text style={styles.detailLine}>
                      Cleaner: {cleaner ? cleaner.username : 'Unassigned'}
                    </Text>
                    {status.extraCleaning && (
                      <Text style={[styles.detailLine, { color: COLORS.primary }]}>⭐ Extra</Text>
                    )}
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {extraRequests.length > 0 && !search.trim() && (
        <View style={{ marginBottom: SPACING[4] }}>
          <SectionTitle title="Extra Room Requests" subtitle="Cleaners asking to clean extra rooms" />
          {extraRequests.map(req => {
            const room = rooms.find(r => r.id === req.id);
            const cleaner = cleaners.find(c => c.id === req.cleanerId);
            return (
              <Card key={req.id} style={styles.requestCard}>
                <View style={styles.requestRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestRoomName}>{room?.name || 'Unknown room'}</Text>
                    <Text style={styles.requestCleaner}>
                      Requested by: {cleaner?.username || 'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => approveExtraRoom(req.id, req.cleanerId)}
                    >
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => rejectExtraRoom(req.id)}
                    >
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {!search.trim() && cleaners.length > 0 && (
        <>
          <SectionTitle title="Cleaner Progress" subtitle="Tap a cleaner to see details" />
          {cleaners.map(c => {
            const assigned = rooms.filter(r => r.assignedTo === c.id);
            const done = assigned.filter(r => roomStatus[r.id]?.cleaned).length;
            const pct = assigned.length ? Math.round((done / assigned.length) * 100) : 0;
            const extraCount = rooms.filter(r => {
              const status = roomStatus[r.id] || {};
              return status.extraCleaning && status.extraCleaningBy === c.id;
            }).length;

            return (
              <TouchableOpacity key={c.id} activeOpacity={0.7} onPress={() => setSelectedCleaner(c)}>
                <Card style={styles.cleanerCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cleanerName}>{c.username}</Text>
                      <Text style={styles.cleanerStats}>{done}/{assigned.length} rooms cleaned</Text>
                      <ProgressBar pct={pct} />
                    </View>
                    {extraCount > 0 && (
                      <View style={styles.extraBadge}>
                        <Text style={styles.extraBadgeText}>{extraCount}</Text>
                      </View>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {!search.trim() && (
        <>
          <SectionTitle title="Unassigned Rooms" subtitle="Rooms not yet assigned to a cleaner" />
          {rooms.length === 0 ? (
            <EmptyState icon="🚪" title="No rooms yet" />
          ) : (
            sortedFloors.map(floor => {
              const floorRooms = rooms.filter(r => r.floorId === floor.id && !r.assignedTo);
              if (!floorRooms.length) return null;
              const isExpanded = expandedFloors[floor.id] !== false;
              return (
                <View key={floor.id}>
                  <TouchableOpacity onPress={() => toggleFloor(floor.id)} style={styles.floorHeaderRow} activeOpacity={0.7}>
                    <FloorHeader label={floor.name} />
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={{ gap: SPACING[2], marginBottom: SPACING[4] }}>
                      {floorRooms.map(room => {
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
                              <Text style={styles.roomName}>{room.name}</Text>
                              <View style={{ flexDirection: 'row', gap: SPACING[2] }}>
                                <Badge label={cleaned ? 'Cleaned' : 'Pending'} type={cleaned ? 'clean' : 'extra'} />
                                <TouchableOpacity onPress={() => setResetSingleModal(room.id)}>
                                  <Ionicons name="refresh-circle" size={24} color={COLORS.danger} />
                                </TouchableOpacity>
                              </View>
                            </View>
                            {managerNotes ? (
                              <View style={styles.managerNotesBox}>
                                <Text style={styles.managerNotesText}>📋 {managerNotes}</Text>
                              </View>
                            ) : null}
                            <Text style={styles.detailLine}>Cleaner: Unassigned</Text>
                            {extraTime > 0 && <Text style={styles.detailLine}>Extra time: +{extraTime} min</Text>}
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
                                <Text style={styles.detailLine}>Room features:</Text>
                                {Object.entries(assignmentAttributes).map(([attr, value]) => (
                                  <View key={attr} style={styles.attributeRow}>
                                    <Ionicons
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
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </>
      )}

      <ConfirmModal
        visible={resetAllModal}
        onConfirm={confirmResetAll}
        onCancel={() => setResetAllModal(false)}
        title="Reset all rooms"
        message="Mark every room as not cleaned and remove all notes?"
      />
      <ConfirmModal
        visible={!!resetSingleModal}
        onConfirm={confirmResetSingle}
        onCancel={() => setResetSingleModal(null)}
        title="Reset room"
        message="Mark this room as not cleaned?"
      />
      <CleanerDetailModal
        visible={!!selectedCleaner}
        cleaner={selectedCleaner}
        rooms={rooms}
        roomStatus={roomStatus}
        onClose={() => setSelectedCleaner(null)}
      />
      <RoomDetailModal
        visible={!!selectedRoom}
        room={selectedRoom}
        roomStatus={roomStatus}
        cleaners={cleaners}
        onClose={() => setSelectedRoom(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING[4], paddingBottom: SPACING[10] },
  headRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: SPACING[3],
  },
  resetAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[1],
    backgroundColor: COLORS.dangerLight, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  resetAllText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.danger },
  overviewCard: { marginBottom: SPACING[4], padding: SPACING[4] },
  overviewText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING[3] },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING[3], marginBottom: SPACING[4],
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular, fontSize: FONT_SIZE.md,
    color: COLORS.text, paddingVertical: SPACING[2],
  },
  cleanerCard: { marginBottom: SPACING[3], padding: SPACING[3] },
  cleanerName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text },
  cleanerStats: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING[3] },
  roomDetailCard: { marginBottom: SPACING[3], padding: SPACING[3] },
  roomHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING[3],
  },
  roomName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text },
  detailLine: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: 4 },
  notesBox: { backgroundColor: COLORS.accentLight, borderRadius: RADIUS.sm, padding: SPACING[2], marginTop: SPACING[2] },
  notesText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.text, fontStyle: 'italic' },
  bedSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], marginTop: SPACING[3] },
  floorHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING[6], marginBottom: SPACING[3],
  },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: SPACING[4] },
  cleanerRoomCard: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING[3], marginBottom: SPACING[2],
  },
  managerNotesBox: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    padding: SPACING[2], marginTop: SPACING[2],
  },
  managerNotesText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.primaryDark },
  commonIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    paddingVertical: SPACING[2],
  },
  commonText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  attributeSection: { marginTop: SPACING[2], marginBottom: SPACING[2] },
  attributeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING[1] },
  attributeText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  requestCard: { padding: SPACING[3], marginBottom: SPACING[2] },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestRoomName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text },
  requestCleaner: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  requestActions: { flexDirection: 'row', gap: SPACING[2] },
  approveBtn: {
    backgroundColor: COLORS.success, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
  },
  approveBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.white },
  rejectBtn: {
    backgroundColor: COLORS.danger, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
  },
  rejectBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.white },
  extraBadge: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING[2],
  },
  extraBadgeText: { fontFamily: 'System', fontWeight: '700', fontSize: 12, color: COLORS.white },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING[6],
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING[5], width: '100%', maxWidth: 400, ...SHADOW.md,
  },
  modalTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: SPACING[3] },
  modalMessage: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING[5] },
  modalActions: { flexDirection: 'row', gap: SPACING[2] },
  modalBtn: { flex: 1, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  modalBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  modalBtnDanger: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  modalBtnText: { fontFamily: 'System', fontWeight: '600', fontSize: 16, color: COLORS.primary },
});