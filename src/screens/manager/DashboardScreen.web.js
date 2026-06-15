import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Image,
  Pressable,
} from 'react-native';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING } from '../../theme';
import { Badge, ProgressBar, EmptyState, Button } from '../../components/UI';
import { useApp } from '../../contexts/AppContext';
import Icon from '../../components/Icon';

// ─── CSV generation helper ──────────────────────────────────────
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

// ─── Table row ──────────────────────────────────────────────────
function TableRow({ room, roomStatus, cleaners, onRoomPress }) {
  const status = roomStatus[room.id] || {};
  const cleaned = status.cleaned || false;
  const cleaner = cleaners.find(c => c.id === room.assignedTo);

  return (
    <TouchableOpacity
      style={styles.tableRow}
      onPress={() => onRoomPress(room)}
      activeOpacity={0.6}
    >
      <Text style={[styles.cell, styles.roomCell]}>{room.name}</Text>
      <Text style={styles.cell}>{room.type === 'private' ? 'Private' : 'Dorm'}</Text>
      <Text style={styles.cell}>{cleaner ? cleaner.username : '—'}</Text>
      <View style={[styles.cell, { flexDirection: 'row', gap: 4, flexWrap: 'wrap' }]}>
        <Badge label={cleaned ? 'Cleaned' : 'Pending'} type={cleaned ? 'clean' : 'extra'} />
        {status.extraCleaning && <Badge label="Extra" type="clean" />}
      </View>
      <Text style={styles.cell} numberOfLines={1}>{status.notes || '—'}</Text>
      <Text style={styles.cell} numberOfLines={1}>{status.extraTime ? `+${status.extraTime}m` : '—'}</Text>
    </TouchableOpacity>
  );
}

// ─── Room Detail Modal ─────────────────────────────────────────
function RoomDetailModal({ visible, room, roomStatus, cleaners, onClose }) {
  if (!room) return null;
  const status = roomStatus[room.id] || {};
  const cleaner = cleaners.find(c => c.id === room.assignedTo);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{room.name}</Text>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Type:</Text>
            <Text>{room.type === 'private' ? 'Private' : 'Dormitory'}</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Cleaner:</Text>
            <Text>{cleaner ? cleaner.username : 'Unassigned'}</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Status:</Text>
            <Badge label={status.cleaned ? 'Cleaned' : 'Pending'} type={status.cleaned ? 'clean' : 'extra'} />
          </View>
          {status.notes ? (
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Notes:</Text>
              <Text style={{ flex: 1 }}>{status.notes}</Text>
            </View>
          ) : null}
          {status.extraTime > 0 && (
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Extra time:</Text>
              <Text>+{status.extraTime} min</Text>
            </View>
          )}
          <Button title="Close" onPress={onClose} variant="secondary" style={{ marginTop: SPACING[4], alignSelf: 'center' }} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Dashboard Web ────────────────────────────────────────
export default function DashboardScreen({ highlightRoomId, onRoomOpened }) {
  const {
    rooms = [], roomStatus = {}, hostel = {}, cleaners = [],
    extraRequests = [], floors = [], approveExtraRoom, rejectExtraRoom,
  } = useApp();
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [imageViewer, setImageViewer] = useState(null);   // for full-screen photo

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>{hostel.name} – Dashboard</Text>
        <View style={styles.headerRight}>
          <View style={styles.headerStats}>
            <Text style={styles.statText}>{overallCleaned}/{rooms.length} rooms cleaned ({overallPct}%)</Text>
            <ProgressBar pct={overallPct} height={6} />
          </View>
          <TouchableOpacity onPress={handleExport} style={styles.exportBtn} activeOpacity={0.7}>
            <Icon name="download-outline" size={18} color={COLORS.white} />
            <Text style={styles.exportText}>{t('exportCSV')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Search bar */}
        <View style={styles.searchBar}>
          <Icon name="search-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search rooms…"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Extra Room Requests (now at the top) ── */}
        {extraRequests.length > 0 && (
          <View style={styles.extraSection}>
            <Text style={styles.sectionTitle}>Extra Room Requests</Text>
            {extraRequests.map(req => {
              const room = rooms.find(r => r.id === req.id);
              const cleaner = cleaners.find(c => c.id === req.cleanerId);
              return (
                <View key={req.id} style={styles.extraRow}>
                  <Text style={{ flex: 1 }}>
                    {room?.name || 'Unknown'} requested by {cleaner?.username || 'Unknown'}
                  </Text>
                  {req.imageBase64 ? (
                    <TouchableOpacity onPress={() => setImageViewer(`data:image/jpeg;base64,${req.imageBase64}`)}>
                      <img
                        src={`data:image/jpeg;base64,${req.imageBase64}`}
                        style={{ width: 60, height: 60, borderRadius: 8, marginLeft: 8 }}
                      />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approveExtraRoom(req.id, req.cleanerId)}>
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectExtraRoom(req.id)}>
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Table ── */}
        <View style={styles.tableContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.roomCell]}>Room</Text>
                <Text style={styles.headerCell}>Type</Text>
                <Text style={styles.headerCell}>Cleaner</Text>
                <Text style={styles.headerCell}>Status</Text>
                <Text style={styles.headerCell}>Notes</Text>
                <Text style={styles.headerCell}>Extra Time</Text>
              </View>
              {filteredRooms.map(room => (
                <TableRow
                  key={room.id}
                  room={room}
                  roomStatus={roomStatus}
                  cleaners={cleaners}
                  onRoomPress={setSelectedRoom}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Room detail modal */}
      <RoomDetailModal
        visible={!!selectedRoom}
        room={selectedRoom}
        roomStatus={roomStatus}
        cleaners={cleaners}
        onClose={() => setSelectedRoom(null)}
      />

      {/* Full-screen image viewer */}
      <Modal visible={!!imageViewer} transparent animationType="fade">
        <Pressable style={styles.imageModal} onPress={() => setImageViewer(null)}>
          <img src={imageViewer} style={styles.fullImage} />
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1, padding: SPACING[4] },
  header: {
    paddingHorizontal: SPACING[4], paddingVertical: SPACING[3],
    backgroundColor: COLORS.surface, borderBottomWidth: 1,
    borderBottomColor: COLORS.border, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: SPACING[2],
  },
  pageTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING[3] },
  headerStats: { alignItems: 'flex-end' },
  statText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: 4 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[1],
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
  },
  exportText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.white },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: SPACING[10] },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING[4],
    marginTop: SPACING[3], marginBottom: SPACING[2],
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING[3],
  },
  searchInput: { flex: 1, fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.text, paddingVertical: SPACING[2] },
  extraSection: { marginHorizontal: SPACING[4], marginTop: SPACING[3], marginBottom: SPACING[2] },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING[2] },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2], marginBottom: SPACING[2] },
  approveBtn: { backgroundColor: COLORS.success, borderRadius: RADIUS.sm, paddingHorizontal: SPACING[3], paddingVertical: SPACING[1] },
  approveText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xs, color: COLORS.white },
  rejectBtn: { backgroundColor: COLORS.danger, borderRadius: RADIUS.sm, paddingHorizontal: SPACING[3], paddingVertical: SPACING[1] },
  rejectText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xs, color: COLORS.white },
  tableContainer: {
    marginHorizontal: SPACING[4], marginBottom: SPACING[2],
    borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
  },
  table: { minWidth: 600 },
  tableHeader: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderBottomWidth: 2, borderBottomColor: COLORS.border, paddingVertical: SPACING[2],
  },
  headerCell: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, paddingHorizontal: SPACING[2], flex: 1 },
  tableRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingVertical: SPACING[2], alignItems: 'center', backgroundColor: COLORS.surface,
  },
  cell: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.text, paddingHorizontal: SPACING[2], flex: 1, minWidth: 80 },
  roomCell: { flex: 1.2, minWidth: 100 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: SPACING[6] },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING[5], width: '100%', maxWidth: 400 },
  modalTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: SPACING[3] },
  modalRow: { flexDirection: 'row', marginBottom: SPACING[2], alignItems: 'center' },
  modalLabel: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, width: 80 },
  // Image viewer styles
  imageModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    maxWidth: 600,
    maxHeight: '80%',
    width: 'auto',
    height: 'auto',
  },
});