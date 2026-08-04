import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, ScrollView, StyleSheet, Alert, TouchableOpacity, Text, Modal, Pressable, Image,
} from 'react-native';
import { useApp } from '../../contexts/AppContext';
import { useNotifications } from '../../contexts/NotificationContext';
import Header from '../../components/Dashboard/Header';
import KPICard from '../../components/Dashboard/KPICard';
import ProgressCard from '../../components/Dashboard/ProgressCard';
import SearchBar from '../../components/Dashboard/SearchBar';
import RoomTable from '../../components/Dashboard/RoomTable';
import CleanerWidget from '../../components/Dashboard/CleanerWidget';
import FloorProgress from '../../components/Dashboard/FloorProgress';
import RecentActivity from '../../components/Dashboard/RecentActivity';
import Footer from '../../components/Dashboard/Footer';
import AppCard from '../../components/Card/AppCard';
import { COLORS } from '../../theme/colors';
import { SPACING } from '../../theme/spacing';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { Badge } from '../../components/UI';   // if Badge is available, else skip
import Icon from '../../components/Icon';

/* ─── CSV helper (local copy) ──────────────────────────────── */
const generateCSV = (rooms, roomStatus, cleaners, extraRequests, floors) => {
  const headers = [
    'Room', 'Floor', 'Type', 'Cleaner', 'Status',
    'Notes', 'Extra Time (min)', 'Bed Details', 'Flags', 'Extra Request',
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
    const extraReqStr = extraReq ? `Requested by ${extraReq.cleanerId}` : '';

    return [
      `"${room.name}"`, `"${floorName}"`, room.type,
      `"${cleanerName}"`, cleaned, `"${notes}"`,
      extraTime, `"${bedDetails}"`, `"${flagsStr}"`, `"${extraReqStr}"`,
    ].join(',');
  });

  return [headers, ...rows].join('\n');
};

function RoomDetailModal({ visible, room, roomStatus, cleaners, floors, onClose }) {
  if (!room) return null;
  const status = roomStatus[room.id] || {};
  const cleaned = status.cleaned || false;
  const notes = status.notes;
  const extraTime = status.extraTime || 0;
  const bedStatus = status.bedStatus || {};
  const assignmentBedStatus = status.assignmentBedStatus || {};
  const managerNotes = status.managerNotes;
  const commonOnly = status.commonOnly || false;
  const assignmentAttributes = status.assignmentAttributes || {};
  const cleaner = cleaners.find(c => c.id === room.assignedTo);
  const floor = floors.find(f => f.id === room.floorId);
  const isEarly = status.earlyCheckIn === true;
  const isLate  = status.lateCheckOut === true;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{room.name}</Text>

          {/* Type & Floor */}
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Type</Text>
            <Badge label={room.type === 'private' ? 'Private' : 'Dormitory'} type={room.type === 'private' ? 'priv' : 'dorm'} />
          </View>
          {floor && (
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Floor</Text>
              <Text style={styles.modalValue}>{floor.name}</Text>
            </View>
          )}

          {/* Cleaner */}
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Cleaner</Text>
            <Text style={styles.modalValue}>{cleaner ? cleaner.username : 'Unassigned'}</Text>
          </View>

          {/* Status */}
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Status</Text>
            <Badge label={cleaned ? 'Cleaned' : 'Pending'} type={cleaned ? 'clean' : 'extra'} />
          </View>

          {/* Extra time */}
          {extraTime > 0 && (
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Extra Time</Text>
              <Text style={styles.modalValue}>+{extraTime} min</Text>
            </View>
          )}

          {/* Manager notes */}
          {managerNotes ? (
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Manager Note</Text>
              <Text style={styles.modalValue}>{managerNotes}</Text>
            </View>
          ) : null}

          {/* Cleaner notes */}
          {notes ? (
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Cleaner Note</Text>
              <Text style={[styles.modalValue, { fontStyle: 'italic' }]}>{notes}</Text>
            </View>
          ) : null}

          {/* Beds (dorm only) */}
          {room.type === 'dorm' && room.beds?.length > 0 && !commonOnly && (
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Beds</Text>
              <View style={{ flex: 1 }}>
                {room.beds.map(bed => {
                  const assignment = assignmentBedStatus[bed.id] || { status: 'clean', reason: 'clean' };
                  const bedClean = bedStatus[bed.id]?.status === 'cleaned';
                  const isSkipped = assignment.status === 'stayover' || assignment.status === 'noone';
                  return (
                    <Text key={bed.id} style={[styles.bedItem, { color: bedClean ? COLORS.success : isSkipped ? COLORS.warning : COLORS.textSecondary }]}>
                      {bed.name}: {bedClean ? '✓ Cleaned' : isSkipped ? '⊘ Skipped' : '○ To do'}
                    </Text>
                  );
                })}
              </View>
            </View>
          )}

          {/* Common areas only */}
          {commonOnly && (
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Common Areas</Text>
              <Text style={[styles.modalValue, { color: cleaned ? COLORS.success : COLORS.textSecondary }]}>
                {cleaned ? 'Cleaned' : 'Not yet cleaned'}
              </Text>
            </View>
          )}

          {/* Assignment attributes (private rooms) */}
          {room.type === 'private' && Object.keys(assignmentAttributes).length > 0 && (
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Features</Text>
              <View style={{ flex: 1 }}>
                {Object.entries(assignmentAttributes).map(([attr, val]) => (
                  <Text key={attr} style={styles.modalValue}>{attr}: {val ? 'Yes' : 'No'}</Text>
                ))}
              </View>
            </View>
          )}

          {/* Early / Late flags */}
          {(isEarly || isLate) && (
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Flags</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {isEarly && <Badge label="Early Check-in" type="extra" />}
                {isLate && <Badge label="Late Check-out" type="extra" />}
              </View>
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Main Dashboard Component ────────────────────────────── */
export default function DashboardScreen({ highlightRoomId, onRoomOpened, onNavigate }) {
  const {
    rooms = [], roomStatus = {}, hostel = {}, cleaners = [],
    extraRequests = [], floors = [],
    approveExtraRoom, rejectExtraRoom,
  } = useApp();
  const { t } = useTranslation();
  const { notifications, unreadCount, markAsRead, clearAll, deleteAllNotifications } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  const recentActivities = notifications.slice(0, 5).map(n => ({
    id: n.id,
    text: n.message,
    time: new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: n.type === 'room_cleaned' ? 'Cleaned' : n.type === 'extra_request' ? 'High' : 'Info',
  }));

  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [imageViewer, setImageViewer] = useState(null);
  const pendingExtraRequests = extraRequests.filter(r => r.status === 'pending' || !r.status); // safety: treat missing status as pending

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const term = search.toLowerCase();
    return rooms.filter(r => r.name.toLowerCase().includes(term));
  }, [rooms, search]);

  // Notification highlight effect
  useEffect(() => {
    if (highlightRoomId && rooms.length > 0) {
      const room = rooms.find(r => r.id === highlightRoomId);
      if (room) {
        setSelectedRoom(room);
        if (onRoomOpened) onRoomOpened();
      }
    }
  }, [highlightRoomId, rooms, onRoomOpened]);

  const handleExport = useCallback(() => {
    try {
      const csv = generateCSV(rooms, roomStatus, cleaners, extraRequests, floors);
      const fileName = `keepclean_report_${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      Alert.alert('Export failed', error.message);
    }
  }, [rooms, roomStatus, cleaners, extraRequests, floors]);

  const allRooms = rooms || [];
  const assignedRooms = allRooms.filter(r => r.assignedTo);
  const assignedCleaned = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const assignedPct = assignedRooms.length
    ? Math.round((assignedCleaned / assignedRooms.length) * 100)
    : 0;
  const pendingCount = assignedRooms.length - assignedCleaned;   

  const workingCleaners = cleaners.filter(c => {
    const assigned = rooms.filter(r => r.assignedTo === c.id);
    if (assigned.length === 0) return false;
    return assigned.some(r => !roomStatus[r.id]?.cleaned);
  }).length;

  const finishedCleaners = cleaners.length - workingCleaners;

  // Build attention items (requests + flagged rooms)
  const attentionItems = [];

  // Pending extra requests
  extraRequests
    .filter(r => r.status === 'pending' || !r.status)
    .forEach(req => {
      const room = rooms.find(r => r.id === req.id);
      const cleaner = cleaners.find(c => c.id === req.cleanerId);
      attentionItems.push({
        type: 'request',
        id: req.id,
        roomId: req.id,
        roomName: room?.name || 'Unknown room',
        cleanerName: cleaner?.username || 'Unknown cleaner',
        message: `Extra room requested by ${cleaner?.username || 'Unknown cleaner'}`,
        request: req,
      });
    });

  // Rooms with early/late flags, notes, or extra time
  rooms.forEach(room => {
    const status = roomStatus[room.id] || {};
    const cleaner = cleaners.find(c => c.id === room.assignedTo);

    if (status.earlyCheckIn) {
      attentionItems.push({
        type: 'flag',
        id: `early-${room.id}`,
        roomId: room.id,
        roomName: room.name,
        cleanerName: cleaner?.username || 'Unassigned',
        message: `Early check‑in for room ${room.name}`,
      });
    }

    if (status.lateCheckOut) {
      attentionItems.push({
        type: 'flag',
        id: `late-${room.id}`,
        roomId: room.id,
        roomName: room.name,
        cleanerName: cleaner?.username || 'Unassigned',
        message: `Late check‑out for room ${room.name}`,
      });
    }

    if (status.notes && status.notes.trim()) {
      attentionItems.push({
        type: 'note',
        id: `note-${room.id}`,
        roomId: room.id,
        roomName: room.name,
        cleanerName: cleaner?.username || 'Unassigned',
        message: `Note on room ${room.name}: "${status.notes.substring(0, 50)}${status.notes.length > 50 ? '…' : ''}"`,
      });
    }

    if (status.extraTime > 0) {
      attentionItems.push({
        type: 'extraTime',
        id: `extratime-${room.id}`,
        roomId: room.id,
        roomName: room.name,
        cleanerName: cleaner?.username || 'Unassigned',
        message: `Extra time requested for room ${room.name}: +${status.extraTime} min`,
      });
    }
  });

  return (
    <View style={styles.container}>
      <Header
        hostelName={hostel.name}
        unreadCount={unreadCount}
        onNotificationsPress={() => setShowNotifications(true)}
        onExportPress={handleExport}
      />

      <ScrollView style={styles.scrollArea}>
        {/* KPI Row */}
        <View style={styles.kpiRow}>
          <KPICard
            icon="🏨" value={allRooms.length} label="Total Rooms"
            sub={[{ label: `${pendingCount} Pending`, color: COLORS.warning }]}
            chipColor={COLORS.primary} chipBg={COLORS.primaryLight}
            chipBg={COLORS.primaryLight}
            onPress={() => onNavigate('rooms')}
          />
          <TouchableOpacity onPress={() => onNavigate('reports')} style={{ flex: 1, minWidth: 220 }} activeOpacity={0.7}>
            <ProgressCard pct={assignedPct} cleaned={assignedCleaned} total={assignedRooms.length} />
          </TouchableOpacity>
          <KPICard
              icon="👥" value={cleaners.length} label="Cleaners"
              sub={[
                { label: `${workingCleaners} Working`, color: COLORS.primary },
                { label: `${finishedCleaners} Finished`, color: COLORS.success },
              ]}
              chipColor={COLORS.primary} chipBg={COLORS.primaryLight}
              onPress={() => onNavigate('team')}
            />
          <KPICard
            icon="⚠"
            value={pendingExtraRequests.length}
            label="Extra Requests"
            sub={[
              { label: `${pendingExtraRequests.length} Pending`, color: COLORS.warning },
              { label: `${extraRequests.filter(r => r.status === 'approved').length} Approved`, color: COLORS.success },
              { label: `${extraRequests.filter(r => r.status === 'rejected').length} Rejected`, color: COLORS.danger },
            ]}
            chipColor={COLORS.warning}
            chipBg={`${COLORS.warning}22`}
            onPress={() => onNavigate('extraRequests')}
          />
        </View>

        {/* Search */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />

        {/* Main content: Table + Sidebar */}
        <View style={styles.mainRow}>
          <View style={styles.tableContainer}>
            <RoomTable
              rooms={filteredRooms}
              roomStatus={roomStatus}
              cleaners={cleaners}
              floors={floors}
              onRoomPress={setSelectedRoom}
            />
            <RecentActivity
              activities={recentActivities}
              viewAll="View all"
              onViewAll={() => onNavigate('reports')}
            />
          </View>
          <View style={styles.sidebar}>
            <CleanerWidget cleaners={cleaners} roomStatus={roomStatus} rooms={rooms} />
            <FloorProgress floors={floors} rooms={rooms} roomStatus={roomStatus} />
            <AppCard style={{ marginBottom: SPACING.md }}>
              <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.sm }}>
                Needs Attention
              </Text>

              {attentionItems.length === 0 && (
                <Text style={{ fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary }}>
                  Nothing needs attention right now.
                </Text>
              )}

              {attentionItems.map(item => {
                if (item.type === 'request') {
                  return (
                    <View key={item.id} style={styles.attentionRow}>
                      <View style={{ flex: 1 }}>
                        <TouchableOpacity onPress={() => setSelectedRoom(rooms.find(r => r.id === item.roomId))}>
                          <Text style={{ fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.text }}>
                            {item.roomName}
                          </Text>
                          <Text style={{ fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary }}>
                            {item.message}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => approveExtraRoom(item.request.id, item.request.cleanerId)}>
                          <Text style={{ color: COLORS.success, fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs }}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => rejectExtraRoom(item.request.id)}>
                          <Text style={{ color: COLORS.danger, fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs }}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                // Flags, notes, extra time – clickable to open room detail
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.attentionRow}
                    onPress={() => setSelectedRoom(rooms.find(r => r.id === item.roomId))}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.text }}>
                        {item.roomName}
                      </Text>
                      <Text style={{ fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary }}>
                        {item.message}
                      </Text>
                    </View>
                    <Icon name="chevron-forward-outline" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </AppCard>
          </View>
        </View>
      </ScrollView>
      <RoomDetailModal
        visible={!!selectedRoom}
        room={selectedRoom}
        roomStatus={roomStatus}
        cleaners={cleaners}
        floors={floors}
        onClose={() => setSelectedRoom(null)}
      />

      {/* ── Notification Modal ── */}
      <Modal visible={showNotifications} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowNotifications(false)}>
          <View style={[styles.modalCard, { maxWidth: 450, maxHeight: '70%' }]}>
            <View style={styles.notifHeaderRow}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={clearAll}>
                    <Text style={{ fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.primary }}>
                      Mark all read
                    </Text>
                  </TouchableOpacity>
                )}
                {notifications.length > 0 && (
                  <TouchableOpacity onPress={deleteAllNotifications}>
                    <Text style={{ fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.danger }}>
                      Delete all
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {notifications.length === 0 ? (
                <Text style={{ fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', marginTop: 20 }}>
                  No notifications yet.
                </Text>
              ) : (
                notifications.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.notifItem, item.read && { opacity: 0.6 }]}
                    onPress={() => {
                      markAsRead(item.id);
                      setShowNotifications(false);
                      setSelectedRoom(rooms.find(r => r.id === item.roomId));
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.notifMessage, item.read && { color: COLORS.textMuted }]}>
                        {item.message}
                      </Text>
                      <Text style={styles.notifTime}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {!item.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowNotifications(false)}
              style={{ marginTop: SPACING.md, alignSelf: 'center', padding: SPACING.sm }}
            >
              <Text style={{ fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.primary }}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollArea: { flex: 1 },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginVertical: SPACING.lg,
  },
  mainRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },
  tableContainer: { flex: 3 },
  sidebar: { flex: 1, minWidth: 280 },
  attentionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'auto',
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xl,
    marginBottom: SPACING.md,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  modalLabel: {
    width: 100,
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginRight: SPACING.md,
  },
  modalValue: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  bedItem: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    marginBottom: 4,
  },
  closeBtn: {
    marginTop: SPACING.md,
    alignSelf: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
  },
  closeBtnText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  notifMessage: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    flex: 1,
  },
  notifTime: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.sm,
  },
});