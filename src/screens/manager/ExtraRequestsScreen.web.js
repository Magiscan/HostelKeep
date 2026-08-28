import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp } from '../../contexts/AppContext';
import AppCard from '../../components/Card/AppCard';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { STATUS } from '../../theme/colors';

const STATUS_META = {
  pending:  STATUS.waiting,
  approved: STATUS.inspected,
  rejected: STATUS.error,
};

function SummaryChip({ label, value, color }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={[styles.summaryNumber, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

export default function ExtraRequestsScreen() {
  const { extraRequests, rooms, cleaners, approveExtraRoom, rejectExtraRoom, cleanupOldExtraRequests } = useApp();
  const [filter, setFilter] = useState('pending');
  const [imageViewer, setImageViewer] = useState(null);

  useEffect(() => {
    cleanupOldExtraRequests();
  }, []);

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
      {/* ── Toolbar ── */}
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.title}>Extra Room Requests</Text>
          <Text style={styles.subtitle}>Review and manage cleaner requests</Text>
        </View>
        <View style={styles.summaryRow}>
          <SummaryChip label="Pending" value={pendingCount} color={COLORS.warning} />
          <SummaryChip label="Approved" value={approvedCount} color={COLORS.success} />
          <SummaryChip label="Rejected" value={rejectedCount} color={COLORS.danger} />
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

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filteredRequests.length === 0 ? (
          <Text style={styles.emptyText}>No {filter} requests.</Text>
        ) : (
          <View style={styles.grid}>
            {filteredRequests.map(req => {
              const room = rooms.find(r => r.id === req.id);
              const cleaner = cleaners.find(c => c.id === req.cleanerId);
              const status = req.status || 'pending';
              const meta = STATUS_META[status] || STATUS_META.pending;
              const timestamp = req.requestedAt ? new Date(req.requestedAt).toLocaleString() : '';

              return (
                <AppCard key={req.id} style={styles.requestCard}>
                  <View style={styles.headerRow}>
                    <Text style={styles.roomName} numberOfLines={1}>{room?.name || 'Unknown room'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusText, { color: meta.text }]}>{status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.cleanerName}>Requested by {cleaner?.username || 'Unknown cleaner'}</Text>
                  {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}

                  {req.imageBase64 ? (
                    <View style={styles.imageRow}>
                      <TouchableOpacity onPress={() => setImageViewer(`data:image/jpeg;base64,${req.imageBase64}`)}>
                        <img
                          src={`data:image/jpeg;base64,${req.imageBase64}`}
                          style={{ width: 96, height: 72, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => downloadImage(req.imageBase64)} style={styles.downloadBtn}>
                        <Text style={styles.downloadText}>⬇ Download</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {status === 'pending' && (
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => handleApprove(req.id, req.cleanerId)}>
                        <Text style={styles.approveText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => handleReject(req.id)}>
                        <Text style={styles.rejectText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </AppCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Lightbox ── */}
      {imageViewer && (
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setImageViewer(null)} />
          <View style={styles.lightboxContent}>
            <img src={imageViewer} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, display: 'block' }} />
            <View style={styles.lightboxActions}>
              <TouchableOpacity onPress={() => setImageViewer(null)} style={styles.lightboxBtn}>
                <Text style={styles.lightboxBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, position: 'relative' },

  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  subtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },

  summaryRow: { flexDirection: 'row', gap: SPACING.md },
  summaryChip: {
    alignItems: 'center', backgroundColor: COLORS.background,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
  },
  summaryNumber: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl },
  summaryLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },

  tabRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginTop: SPACING.lg, marginBottom: SPACING.md },
  tab: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: 'rgba(15,23,42,0.06)', borderColor: COLORS.border },
  tabText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.text, fontFamily: FONTS.semiBold },

  list: { flex: 1 },
  listContent: { padding: SPACING.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },

  requestCard: { width: 340 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  roomName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text, flex: 1, marginRight: SPACING.sm },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontFamily: FONTS.bold, fontSize: 10 },
  cleanerName: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  timestamp: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },

  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.sm },
  downloadBtn: { backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs || 4 },
  downloadText: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.primary },

  actions: { flexDirection: 'row', gap: 8, marginTop: SPACING.md },
  btn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: 8, alignItems: 'center' },
  approveBtn: { backgroundColor: COLORS.primary },
  rejectBtn: { backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.dangerBorder },
  approveText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.onPrimary },
  rejectText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.danger },

  emptyText: { fontFamily: FONTS.medium, color: COLORS.textSecondary, marginTop: SPACING.xl, textAlign: 'center' },

  lightboxOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  lightboxContent: { alignItems: 'center', gap: SPACING.md },
  lightboxActions: { flexDirection: 'row' },
  lightboxBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  lightboxBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: '#FFFFFF' },
});