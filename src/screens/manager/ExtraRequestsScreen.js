import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { useApp } from '../../contexts/AppContext';
import AppCard from '../../components/Card/AppCard';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';

const STATUS_COLORS = {
  pending: COLORS.warning,
  approved: COLORS.success,
  rejected: COLORS.danger,
};

export default function ExtraRequestsScreen() {
  const { extraRequests, rooms, cleaners, approveExtraRoom, rejectExtraRoom, cleanupOldExtraRequests } = useApp();
  const [filter, setFilter] = useState('pending');
  const [imageViewer, setImageViewer] = useState(null);

  useEffect(() => {
    cleanupOldExtraRequests();
  }, []);

  // Counts for summary
  const pendingCount = extraRequests.filter(r => r.status === 'pending' || !r.status).length;
  const approvedCount = extraRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = extraRequests.filter(r => r.status === 'rejected').length;

  const filteredRequests = extraRequests.filter(r => r.status === filter || (filter === 'pending' && !r.status));

  const handleApprove = (roomId, cleanerId) => approveExtraRoom(roomId, cleanerId);
  const handleReject = (roomId) => rejectExtraRoom(roomId);
  const downloadImage = (base64) => {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${base64}`;
    link.download = `request_${Date.now()}.jpg`;
    link.click();
  };

  const tabs = ['pending', 'approved', 'rejected'];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Extra Room Requests</Text>

      {/* ── Summary bar ── */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: COLORS.warning }]}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: COLORS.success }]}>{approvedCount}</Text>
          <Text style={styles.summaryLabel}>Approved</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: COLORS.danger }]}>{rejectedCount}</Text>
          <Text style={styles.summaryLabel}>Rejected</Text>
        </View>
      </View>

      {/* Status filter tabs */}
      <View style={styles.tabRow}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, filter === tab && styles.tabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.list}>
        {filteredRequests.length === 0 ? (
          <Text style={styles.emptyText}>No {filter} requests.</Text>
        ) : (
          filteredRequests.map(req => {
            const room = rooms.find(r => r.id === req.id);
            const cleaner = cleaners.find(c => c.id === req.cleanerId);
            const status = req.status || 'pending';
            const statusColor = STATUS_COLORS[status] || COLORS.textSecondary;
            const timestamp = req.requestedAt ? new Date(req.requestedAt).toLocaleString() : '';

            return (
              <AppCard key={req.id} style={styles.requestCard}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.headerRow}>
                      <Text style={styles.roomName}>{room?.name || 'Unknown room'}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cleanerName}>
                      Requested by {cleaner?.username || 'Unknown cleaner'}
                    </Text>
                    {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
                    {req.imageBase64 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity onPress={() => setImageViewer(`data:image/jpeg;base64,${req.imageBase64}`)}>
                          <img
                            src={`data:image/jpeg;base64,${req.imageBase64}`}
                            style={{ width: 80, height: 60, borderRadius: 8 }}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => downloadImage(req.imageBase64)}
                          style={{
                            backgroundColor: COLORS.primaryLight,
                            borderRadius: 8,
                            padding: 6,
                          }}
                        >
                          <Text style={{ fontFamily: FONTS.bold, fontSize: 12, color: COLORS.primary }}>
                            ⬇ Download
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                  {status === 'pending' && (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.btn, styles.approveBtn]}
                        onPress={() => handleApprove(req.id, req.cleanerId)}
                      >
                        <Text style={styles.approveText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btn, styles.rejectBtn]}
                        onPress={() => handleReject(req.id)}
                      >
                        <Text style={styles.rejectText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </AppCard>
            );
          })
        )}
      </ScrollView>

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
  container: { flex: 1, padding: SPACING.lg },
  title: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, marginBottom: SPACING.md },
  summaryBar: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    alignItems: 'center',
  },
  summaryNumber: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xxl,
  },
  summaryLabel: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  tabRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.background,
  },
  tabActive: { backgroundColor: COLORS.primaryLight },
  tabText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary, fontFamily: FONTS.bold },
  list: { flex: 1 },
  requestCard: { marginBottom: SPACING.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  roomName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text, marginRight: SPACING.sm },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: { fontFamily: FONTS.bold, fontSize: 10 },
  cleanerName: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  timestamp: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginLeft: SPACING.md, marginTop: SPACING.sm },
  btn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8 },
  approveBtn: { backgroundColor: COLORS.success },
  rejectBtn: { backgroundColor: COLORS.danger },
  approveText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: '#FFFFFF' },
  rejectText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: '#FFFFFF' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontFamily: FONTS.medium, color: COLORS.textSecondary, marginTop: SPACING.xl, textAlign: 'center' },
  imageModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    maxWidth: '90%',
    maxHeight: '90%',
    borderRadius: 8,
  },
});