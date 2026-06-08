import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, Pressable, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING } from '../theme';
import {
  Avatar, Badge, EmptyState, Label, Input, ProgressBar, FloorHeader, Button, SectionTitle, Card,
} from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const REASONS = {
  clean:    { label: 'To clean',   color: COLORS.success,      bg: COLORS.successLight,  icon: 'checkmark-circle' },
  stayover: { label: 'Stay‑over',  color: '#B45309',           bg: '#FEF3C7',            icon: 'bed-outline' },
  late:     { label: 'Late c/out', color: COLORS.danger,       bg: COLORS.dangerLight,   icon: 'time-outline' },
  early:    { label: 'Early c/in', color: COLORS.primary,      bg: COLORS.primaryLight,  icon: 'alarm-outline' },
  noone:    { label: 'No one',     color: COLORS.blue,         bg: COLORS.blueLight,     icon: 'person-remove-outline' },
  common:   { label: 'Common',     color: COLORS.textMuted,    bg: COLORS.surface,       icon: 'home-outline' },
};

// ------------------------------------------------------------------
// Kebab Menu (unchanged)
// ------------------------------------------------------------------
function KebabMenu({ onEditBeds, onUndo }) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.kebabBtn}>
        <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={{ flex: 1 }} onPress={() => setVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} />
        </Pressable>
        <View style={styles.kebabSheet}>
          <TouchableOpacity
            style={styles.kebabOption}
            onPress={() => { setVisible(false); onEditBeds(); }}
          >
            <Ionicons name="create-outline" size={18} color={COLORS.text} />
            <Text style={styles.kebabOptionText}>Edit beds</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.kebabOption}
            onPress={() => { setVisible(false); onUndo(); }}
          >
            <Ionicons name="refresh-circle-outline" size={18} color={COLORS.danger} />
            <Text style={[styles.kebabOptionText, { color: COLORS.danger }]}>Undo room</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ------------------------------------------------------------------
// Room Card (redesigned bed grid, clean all, extra time toggle)
// ------------------------------------------------------------------
function RoomCard({ room, status, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(status.notes || '');

  // Extra time – toggle + free number input
  const [extraEnabled, setExtraEnabled] = useState(!!status.extraTime);
  const [extraMinutes, setExtraMinutes] = useState(status.extraTime?.toString() || '0');

  const isDorm = room.type === 'dorm';
  const beds = room.beds || [];
  const bedStatus = status.bedStatus || {};
  const assignmentBedStatus = status.assignmentBedStatus || {};
  const managerNotes = status.managerNotes;
  const commonOnly = status.commonOnly || false;
  const assignmentAttributes = status.assignmentAttributes || {};
  const isExtra = status.extraCleaning === true;
  const isEarly = status.earlyCheckIn === true;
  const isLate  = status.lateCheckOut === true;

  const hasEarlyBed = isDorm && beds.some(b => (assignmentBedStatus[b.id] || {}).status === 'early');
  const hasLateBed  = isDorm && beds.some(b => (assignmentBedStatus[b.id] || {}).status === 'late');
  const showEarly = isEarly || hasEarlyBed;
  const showLate  = isLate  || hasLateBed;

  // Get effective bed state (same logic as before)
  const getEffectiveBedState = (bedId) => {
    const assignment = assignmentBedStatus[bedId] || { status: 'clean', reason: 'clean' };
    if (commonOnly) return { ...assignment, status: 'common' };
    if (assignment.status === 'early' || assignment.status === 'late') {
      const cleanedByCleaner = bedStatus[bedId]?.status === 'cleaned';
      return { ...assignment, status: cleanedByCleaner ? 'cleaned' : 'pending' };
    }
    if (assignment.status === 'stayover' || assignment.status === 'noone') {
      return assignment;
    }
    return { ...assignment, status: bedStatus[bedId]?.status || 'pending' };
  };

  const allBedsDone = isDorm && beds.length > 0
    ? beds.every(b => {
        const state = getEffectiveBedState(b.id);
        return state.status === 'cleaned' || state.status === 'common' || state.status !== 'pending';
      })
    : true;

  const cleaned = isDorm ? allBedsDone && status.cleaned : !!status.cleaned;
  const canMarkCleaned = allBedsDone || !isDorm;

  const handleOpen = () => {
    if (!cleaned) {
      setOpen(!open);
      if (!open) setEditing(true);
    } else {
      setOpen(!open);
      setEditing(false);
    }
  };

  // Toggle a single bed
  const toggleBed = (bedId) => {
    const assignment = assignmentBedStatus[bedId] || { status: 'clean', reason: 'clean' };
    if (assignment.status === 'stayover' || assignment.status === 'noone') return; // locked

    if (cleaned && !editing) {
      startEditing();
    }
    if (!editing) return;

    const current = bedStatus[bedId]?.status || 'pending';
    const nextStatus = current === 'cleaned' ? 'pending' : 'cleaned';
    const newBS = { ...bedStatus, [bedId]: { status: nextStatus } };
    onUpdate({ bedStatus: newBS, cleaned: false, notes: note, extraTime: extraEnabled ? parseInt(extraMinutes, 10) || 0 : 0 });
  };

  // Mark all cleanable beds as cleaned (bulk action)
  const cleanAllBeds = () => {
    if (!editing) return;
    const newBS = { ...bedStatus };
    beds.forEach(b => {
      const assignment = assignmentBedStatus[b.id] || { status: 'clean', reason: 'clean' };
      if (assignment.status === 'stayover' || assignment.status === 'noone') return; // skip locked
      newBS[b.id] = { status: 'cleaned' };
    });
    onUpdate({ bedStatus: newBS, cleaned: false, notes: note, extraTime: extraEnabled ? parseInt(extraMinutes, 10) || 0 : 0 });
  };

  const markCleaned = () => {
    if (!canMarkCleaned) {
      Alert.alert('Beds not ready', 'All assigned beds must be cleaned or skipped before finishing the room.');
      return;
    }
    if (isDorm) {
      const newBS = { ...bedStatus };
      beds.forEach(b => {
        const state = getEffectiveBedState(b.id);
        if (state.status === 'pending') newBS[b.id] = { status: 'cleaned' };
        else newBS[b.id] = { status: state.status };
      });
      onUpdate({ cleaned: true, bedStatus: newBS, notes: note, extraTime: extraEnabled ? parseInt(extraMinutes, 10) || 0 : 0 });
    } else {
      onUpdate({ cleaned: true, notes: note, extraTime: extraEnabled ? parseInt(extraMinutes, 10) || 0 : 0 });
    }
    setOpen(true);
    setEditing(false);
  };

  const undo = () => {
    if (isDorm) {
      const newBS = {};
      beds.forEach(b => {
        const assignment = assignmentBedStatus[b.id] || { status: 'clean', reason: 'clean' };
        if (assignment.status === 'stayover' || assignment.status === 'noone') {
          newBS[b.id] = { status: assignment.status };
        } else {
          newBS[b.id] = { status: 'pending' };
        }
      });
      onUpdate({ cleaned: false, bedStatus: newBS });
    } else {
      onUpdate({ cleaned: false });
    }
    setEditing(true);
  };

  const startEditing = () => {
    onUpdate({ cleaned: false, bedStatus, notes: note, extraTime: extraEnabled ? parseInt(extraMinutes, 10) || 0 : 0 });
    setOpen(true);
    setEditing(true);
  };

  // Priority color for left border
  const priorityColor = showEarly ? COLORS.primary : showLate ? COLORS.danger : (cleaned ? COLORS.success : extraEnabled ? COLORS.danger : COLORS.accent);

  // Colors for a bed card
  const bedCardStyle = (bedId) => {
    const state = getEffectiveBedState(bedId);
    const reason = REASONS[state.reason] || REASONS.clean;
    const isPending = state.status === 'pending';
    return {
      backgroundColor: isPending ? COLORS.surface : reason.bg,
      borderColor: isPending ? COLORS.border : reason.color,
      textColor: isPending ? COLORS.textSecondary : reason.color,
    };
  };

  const bedStateLabel = (bedId) => {
    const state = getEffectiveBedState(bedId);
    const isCleaned = state.status === 'cleaned';
    const prefix = isCleaned ? '✓ ' : '';

    if (state.status === 'common') return 'Common';
    if (state.reason === 'early') return prefix + 'Early c/in';
    if (state.reason === 'late')  return prefix + 'Late c/out';
    if (state.reason === 'stayover') return 'Stay‑over';
    if (state.reason === 'noone') return 'No one';
    if (isCleaned) return '✓ Cleaned';
    return 'To clean';
  };

  return (
    <View style={[styles.roomCard, { borderLeftColor: priorityColor }, cleaned && { opacity: 0.85 }]}>
      <View style={styles.roomHeaderRow}>
        <TouchableOpacity onPress={handleOpen} style={{ flex: 1 }} activeOpacity={0.75}>
          <View style={styles.roomLeft}>
            <View style={[styles.statusDot, { backgroundColor: priorityColor }]} />
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING[2] }}>
                <Text style={styles.roomName}>{room.name}</Text>
                {isExtra && <Badge label="Extra" type="clean" />}
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
              <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: 6 }}>
                <Badge label={room.type === 'private' ? 'Private' : 'Dorm'} type={room.type === 'private' ? 'priv' : 'dorm'} />
                {cleaned && <Badge label="Cleaned" type="clean" />}
                {extraEnabled && !cleaned && <Badge label={`+${extraMinutes}m`} type="extra" />}
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {cleaned && isDorm ? (
          <KebabMenu onEditBeds={startEditing} onUndo={undo} />
        ) : cleaned && !isDorm ? (
          <TouchableOpacity onPress={undo} style={styles.undoBtn}>
            <Text style={styles.undoText}>Undo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleOpen} style={{ padding: 4 }}>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {cleaned && status.notes ? <Text style={styles.savedNote}>Note: "{status.notes}"</Text> : null}
      {cleaned && status.extraTime > 0 && (
        <Text style={styles.savedNote}>Extra time: +{status.extraTime}m</Text>
      )}

      {open && (
        <View style={styles.roomBody}>
          {managerNotes ? (
            <View style={styles.managerNotesBox}>
              <Text style={styles.managerNotesLabel}>📋 Manager note:</Text>
              <Text style={styles.managerNotesText}>{managerNotes}</Text>
            </View>
          ) : null}

          {commonOnly && !cleaned && (
            <View style={styles.commonBanner}>
              <Text style={styles.commonBannerText}>🧹 Common areas only – no bed cleaning required</Text>
            </View>
          )}
          {commonOnly && cleaned && (
            <View style={[styles.commonBanner, { backgroundColor: COLORS.successLight }]}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.success} style={{ marginRight: SPACING[2] }} />
              <Text style={[styles.commonBannerText, { color: COLORS.success }]}>Common areas cleaned</Text>
            </View>
          )}

          {/* ---- New bed grid ---- */}
          {isDorm && beds.length > 0 && !commonOnly && (
            <View style={{ marginBottom: SPACING[4] }}>
              <Label>Beds</Label>
              <View style={styles.bedGrid}>
                {beds.map(b => {
                  const state = getEffectiveBedState(b.id);
                  const colors = bedCardStyle(b.id);
                  const isLocked = state.status === 'stayover' || state.status === 'noone';
                  const label = bedStateLabel(b.id);
                  const isEarlyLate = state.reason === 'early' || state.reason === 'late';
                  const isCleaned = state.status === 'cleaned';

                  // When cleaned, use green; otherwise use the reason's color
                  const bgColor = isCleaned ? COLORS.successLight : colors.backgroundColor;
                  const borderColor = isCleaned ? COLORS.success : colors.borderColor;
                  const textColor = isCleaned ? COLORS.success : colors.textColor;

                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.bedCard,
                        {
                          backgroundColor: bgColor,
                          borderColor: borderColor,
                          borderWidth: isEarlyLate && !isCleaned ? 2.5 : 1.5,
                        },
                      ]}
                      onPress={isLocked ? undefined : () => toggleBed(b.id)}
                      disabled={isLocked || !editing}
                      activeOpacity={isLocked ? 1 : 0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.bedCardLetter, { color: textColor }]}>
                          {b.name}
                        </Text>
                        {isEarlyLate && (
                          <Ionicons
                            name={state.reason === 'early' ? 'alarm-outline' : 'time-outline'}
                            size={18}
                            color={isCleaned ? COLORS.success : colors.textColor}
                            style={{ marginLeft: 4 }}
                          />
                        )}
                        {isCleaned && (
                          <Ionicons name="checkmark-circle" size={18} color={COLORS.success} style={{ marginLeft: 4 }} />
                        )}
                      </View>
                      <Text style={[styles.bedCardStatus, { color: textColor, fontFamily: (isEarlyLate && !isCleaned) ? FONTS.bold : FONTS.medium }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Clean all button */}
              {editing && beds.some(b => {
                const assignment = assignmentBedStatus[b.id] || { status: 'clean', reason: 'clean' };
                return assignment.status === 'clean' || assignment.status === 'early' || assignment.status === 'late';
              }) && (
                <TouchableOpacity style={styles.cleanAllBtn} onPress={cleanAllBeds}>
                  <Ionicons name="checkmark-done-outline" size={18} color={COLORS.white} />
                  <Text style={styles.cleanAllText}>All beds are cleaned</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ---- Room features for private ---- */}
          {!isDorm && Object.keys(assignmentAttributes).length > 0 && (
            <View style={{ marginBottom: SPACING[4] }}>
              <Label>Room features</Label>
              {Object.entries(assignmentAttributes)
                .filter(([, v]) => v)
                .map(([attr, value]) => (
                  <View key={attr} style={styles.attributeRow}>
                    <Ionicons
                      name={value ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={value ? COLORS.success : COLORS.textMuted}
                      style={{ marginRight: SPACING[2] }}
                    />
                    <Text style={styles.attributeText}>{attr}</Text>
                  </View>
                ))}
            </View>
          )}

          {/* ---- Extra time – toggle + free input ---- */}
          {!cleaned && (
            <View style={{ marginBottom: SPACING[4] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING[2] }}>
                <TouchableOpacity
                  onPress={() => setExtraEnabled(!extraEnabled)}
                  style={[styles.checkbox, extraEnabled && styles.checkboxActive]}
                >
                  {extraEnabled && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
                </TouchableOpacity>
                <Text style={{ marginLeft: SPACING[2], fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text }}>
                  Extra time needed
                </Text>
              </View>
              {extraEnabled && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING[2] }}>
                  <TextInput
                    value={extraMinutes}
                    onChangeText={setExtraMinutes}
                    keyboardType="number-pad"
                    placeholder="0"
                    style={styles.minutesInput}
                  />
                  <Text style={{ fontFamily: FONTS.medium, color: COLORS.textSecondary }}>minutes</Text>
                </View>
              )}
            </View>
          )}

          {/* ---- Notes ---- */}
          {!cleaned && (
            <View style={{ marginBottom: SPACING[4] }}>
              <Label>Notes (optional)</Label>
              <Input
                value={note}
                onChangeText={setNote}
                placeholder="e.g. missing towel, broken lock…"
                multiline numberOfLines={2}
              />
            </View>
          )}

          {/* ---- Mark as cleaned button ---- */}
          {!cleaned && (
            <TouchableOpacity
              style={[styles.cleanBtn, SHADOW.glow, !canMarkCleaned && { opacity: 0.5 }]}
              onPress={markCleaned}
              activeOpacity={0.9}
            >
              <Ionicons name="checkmark-circle" size={22} color={COLORS.white} />
              <Text style={styles.cleanBtnText}>
                {canMarkCleaned ? 'All Done' : 'Finish all beds first'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------------
// Request Extra Room Modal (unchanged)
// ------------------------------------------------------------------
function RequestExtraModal({ visible, rooms, floors, roomStatus, extraRequests, onClose, onRequest }) {
  const [loadingRoomId, setLoadingRoomId] = useState(null);
  const sortedFloors = useMemo(() => {
    if (!floors) return [];
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

  const requestedRoomIds = (extraRequests || []).map(r => r.id);
  const eligibleRooms = (rooms || []).filter(
    r => !r.assignedTo && !(roomStatus?.[r.id]?.extraCleaning) && !requestedRoomIds.includes(r.id)
  );

  const handlePress = async (room) => {
    setLoadingRoomId(room.id);
    try {
      await onRequest(room);
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoadingRoomId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Request extra room</Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING[3] }}>
            Tap a room to send a request to the manager.
          </Text>
          <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
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
                        style={styles.roomOption}
                        onPress={() => handlePress(room)}
                        disabled={isLoading}
                      >
                        <Text style={styles.roomOptionText}>
                          {room.name} ({room.type === 'private' ? 'Private' : 'Dorm'})
                          {isLoading ? '  ⏳' : ''}
                        </Text>
                        <Ionicons
                          name={isLoading ? 'hourglass-outline' : 'send-outline'}
                          size={20}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
          <Button title="Close" onPress={onClose} variant="secondary" style={{ marginTop: SPACING[4], alignSelf: 'center' }} />
        </View>
      </View>
    </Modal>
  );
}

// ------------------------------------------------------------------
// Main Cleaner Screen
// ------------------------------------------------------------------
export default function CleanerScreen() {
  const { user, logout } = useAuth();
  const { hostel, floors = [], rooms = [], roomStatus = {}, updateRoomStatus, requestExtraRoom, extraRequests, cancelExtraRoomRequest } = useApp();

  const myRooms = rooms.filter(r => r.assignedTo === user.uid);

  // Priority sorting: early → both → none → late, then by room number
  const sortedRooms = useMemo(() => {
    const numericName = (name) => {
      const num = parseInt(name, 10);
      return isNaN(num) ? name : num;
    };

    return [...myRooms].sort((a, b) => {
      const statusA = roomStatus[a.id] || {};
      const statusB = roomStatus[b.id] || {};
      const bedsA = a.beds || [];
      const bedsB = b.beds || [];
      const assignmentsA = statusA.assignmentBedStatus || {};
      const assignmentsB = statusB.assignmentBedStatus || {};

      const earlyA = statusA.earlyCheckIn === true;
      const earlyB = statusB.earlyCheckIn === true;
      const lateA = statusA.lateCheckOut === true;
      const lateB = statusB.lateCheckOut === true;

      const hasEarlyBedA = bedsA.some(b => (assignmentsA[b.id] || {}).status === 'early');
      const hasEarlyBedB = bedsB.some(b => (assignmentsB[b.id] || {}).status === 'early');
      const hasLateBedA  = bedsA.some(b => (assignmentsA[b.id] || {}).status === 'late');
      const hasLateBedB  = bedsB.some(b => (assignmentsB[b.id] || {}).status === 'late');

      const isEarlyA = earlyA || hasEarlyBedA;
      const isEarlyB = earlyB || hasEarlyBedB;
      const isLateA  = lateA  || hasLateBedA;
      const isLateB  = lateB  || hasLateBedB;

      const getCategory = (early, late) => {
        if (early && !late) return 0;
        if (early && late)  return 1;
        if (!early && !late) return 2;
        return 3;
      };

      const catA = getCategory(isEarlyA, isLateA);
      const catB = getCategory(isEarlyB, isLateB);

      if (catA !== catB) return catA - catB;

      const nameA = numericName(a.name);
      const nameB = numericName(b.name);
      if (typeof nameA === 'number' && typeof nameB === 'number') return nameA - nameB;
      if (typeof nameA === 'number') return -1;
      if (typeof nameB === 'number') return 1;
      return String(nameA).localeCompare(String(nameB));
    });
  }, [myRooms, roomStatus]);

  const regularRooms = sortedRooms.filter(r => !roomStatus[r.id]?.extraCleaning);
  const extraRooms = sortedRooms.filter(r => roomStatus[r.id]?.extraCleaning === true);

  const cleaned = myRooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const total = myRooms.length;
  const pct = total ? Math.round((cleaned / total) * 100) : 0;

  const pendingRequests = extraRequests.filter(req => req.cleanerId === user.uid && req.status === 'pending');

  const [showRequestModal, setShowRequestModal] = useState(false);

  const handleRequestExtra = async (room) => {
    await requestExtraRoom(room.id, user.uid);
    Alert.alert('Request sent', 'The manager has been notified.');
  };

  const sortedFloors = useMemo(() => {
    if (!floors) return [];
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

  const [expandedFloors, setExpandedFloors] = useState({});
  const toggleFloor = (floorId) => setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Avatar name={user.username} size={40} color={COLORS.primary} />
          <View>
            <Text style={styles.greeting}>Ciao, {user.username} 👋</Text>
            <Text style={styles.greetingSub}>{hostel.name || 'Today'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={styles.signOutBtn}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* ── Progress ── */}
      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>{cleaned} of {total} rooms done</Text>
          <Text style={styles.progressPct}>{pct}%</Text>
        </View>
        <ProgressBar pct={pct} />
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <View style={{ marginBottom: SPACING[4] }}>
            <SectionTitle title="Pending Requests" subtitle="Waiting for manager approval" />
            {pendingRequests.map(req => {
              const room = rooms.find(r => r.id === req.id);
              return (
                <Card key={req.id} style={styles.pendingCard}>
                  <View style={styles.pendingRow}>
                    <Ionicons name="time-outline" size={18} color={COLORS.amber} style={{ marginRight: SPACING[2] }} />
                    <Text style={styles.pendingText}>{room?.name || 'Unknown room'}</Text>
                    {/* Cancel button */}
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          'Cancel request',
                          `Remove the extra room request for "${room?.name || 'this room'}"?`,
                          [
                            { text: 'Keep', style: 'cancel' },
                            { text: 'Cancel Request', style: 'destructive', onPress: () => cancelExtraRoomRequest(req.id) },
                          ]
                        );
                      }}
                      style={{ padding: 4, marginLeft: 'auto' }}
                    >
                      <Ionicons name="close-circle-outline" size={22} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* My Rooms */}
        {regularRooms.length > 0 && (
          <View style={{ marginBottom: SPACING[4] }}>
            <SectionTitle title="My Rooms" subtitle="Assigned to you" />
            {sortedFloors.map(floor => {
              const floorRooms = regularRooms.filter(r => r.floorId === floor.id);
              if (!floorRooms.length) return null;
              const isExpanded = expandedFloors[floor.id] !== false;
              return (
                <View key={floor.id}>
                  <TouchableOpacity onPress={() => toggleFloor(floor.id)} style={styles.floorHeaderRow} activeOpacity={0.7}>
                    <FloorHeader label={floor.name} />
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={{ gap: SPACING[4], marginBottom: SPACING[4] }}>
                      {floorRooms.map(room => (
                        <RoomCard
                          key={room.id}
                          room={room}
                          status={roomStatus[room.id] || {}}
                          onUpdate={upd =>
                            updateRoomStatus(room.id, { ...roomStatus[room.id], ...upd })
                          }
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Extra Rooms */}
        {extraRooms.length > 0 && (
          <View style={{ marginBottom: SPACING[4] }}>
            <SectionTitle title="Extra Rooms" subtitle="Approved extra cleanings" />
            {sortedFloors.map(floor => {
              const floorRooms = extraRooms.filter(r => r.floorId === floor.id);
              if (!floorRooms.length) return null;
              const isExpanded = expandedFloors[floor.id] !== false;
              return (
                <View key={floor.id}>
                  <TouchableOpacity onPress={() => toggleFloor(floor.id)} style={styles.floorHeaderRow} activeOpacity={0.7}>
                    <FloorHeader label={floor.name} />
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={{ gap: SPACING[4], marginBottom: SPACING[4] }}>
                      {floorRooms.map(room => (
                        <RoomCard
                          key={room.id}
                          room={room}
                          status={roomStatus[room.id] || {}}
                          onUpdate={upd =>
                            updateRoomStatus(room.id, { ...roomStatus[room.id], ...upd })
                          }
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Empty state */}
        {myRooms.length === 0 && pendingRequests.length === 0 && (
          <EmptyState icon="✨" title="No rooms assigned" subtitle="The manager hasn't assigned rooms to you yet" />
        )}

        {/* All done */}
        {myRooms.length > 0 && cleaned === total && (
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>🎉</Text>
            <Text style={styles.doneTitle}>All done!</Text>
            <Text style={styles.doneSub}>Amazing work today, {user.username}.</Text>
          </View>
        )}

        {/* Extra bottom padding so content isn't hidden behind the footer */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Footer always visible ── */}
      {myRooms.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Need an extra room?</Text>
          <TouchableOpacity
            onPress={() => setShowRequestModal(true)}
            style={styles.footerBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color={COLORS.white} />
            <Text style={styles.footerBtnText}>Extra</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modals */}
      <RequestExtraModal
        visible={showRequestModal}
        rooms={rooms}
        floors={floors}
        roomStatus={roomStatus}
        extraRequests={extraRequests}
        onClose={() => setShowRequestModal(false)}
        onRequest={handleRequestExtra}
      />
    </SafeAreaView>
  );
}

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING[4], paddingVertical: SPACING[3],
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING[3] },
  greeting: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text },
  greetingSub: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[1],
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  signOutText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  progressWrap: {
    paddingHorizontal: SPACING[4], paddingVertical: SPACING[3],
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING[2] },
  progressLabel: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  progressPct: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.primary },
  scroll: { padding: SPACING[4], paddingBottom: SPACING[10] },
  roomCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 5, overflow: 'hidden',
    ...SHADOW.md,
  },
  roomHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING[4] },
  roomLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING[3] },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  roomName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  undoBtn: {
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[1],
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  undoText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  savedNote: {
    fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary, fontStyle: 'italic',
    paddingHorizontal: SPACING[4], paddingBottom: SPACING[3],
  },
  roomBody: {
    paddingHorizontal: SPACING[4], paddingBottom: SPACING[4],
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING[4],
  },
  bedGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2],
  },
  bedCard: {
    width: '48%',
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  bedCardLetter: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    marginBottom: 4,
  },
  bedCardStatus: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
  },
  cleanAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING[2],
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING[2],
    marginTop: SPACING[3],
  },
  cleanAllText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.md,
    color: COLORS.white,
  },
  minutesInput: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING[2],
    paddingVertical: SPACING[1],
    width: 80,
    textAlign: 'center',
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  cleanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING[2], backgroundColor: COLORS.success, borderRadius: RADIUS.lg,
    paddingVertical: SPACING[4], marginTop: 6,
  },
  cleanBtnText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.white },
  managerNotesBox: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    padding: SPACING[2], marginBottom: SPACING[3],
  },
  managerNotesLabel: {
    fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm,
    color: COLORS.primaryDark, marginBottom: SPACING[1],
  },
  managerNotesText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.primaryDark },
  commonBanner: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    padding: SPACING[2],
    marginBottom: SPACING[3],
    flexDirection: 'row',
    alignItems: 'center',
  },
  commonBannerText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.primaryDark },
  attributeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING[1],
  },
  attributeText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  kebabBtn: { padding: 6 },
  kebabSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    padding: SPACING[4], gap: SPACING[2], ...SHADOW.md,
  },
  kebabOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[3],
    paddingVertical: SPACING[3], paddingHorizontal: SPACING[2],
    borderRadius: RADIUS.sm,
  },
  kebabOptionText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  floorHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING[6], marginBottom: SPACING[3],
  },
  doneBox: {
    alignItems: 'center', marginTop: SPACING[6], paddingVertical: SPACING[8],
    paddingHorizontal: SPACING[4], backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.success,
  },
  doneIcon: { fontSize: 40, marginBottom: SPACING[3] },
  doneTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xxl, color: COLORS.success },
  doneSub: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.success, marginTop: SPACING[1], opacity: 0.8 },
  pendingCard: { padding: SPACING[3], marginBottom: SPACING[2], backgroundColor: COLORS.amberLight, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.amber },
  pendingRow: { flexDirection: 'row', alignItems: 'center' },
  pendingText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[2],
    paddingBottom: SPACING[2],
  },
  footerText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[1],
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[1],
  },
  footerBtnText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.white,
  },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING[6],
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING[5], width: '100%', maxWidth: 400, ...SHADOW.md,
  },
  modalTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: SPACING[3] },
  floorLabel: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.primary, marginTop: SPACING[3], marginBottom: SPACING[2] },
  roomOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING[2], paddingHorizontal: SPACING[2],
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  roomOptionText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  modalActions: { flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[4] },
});