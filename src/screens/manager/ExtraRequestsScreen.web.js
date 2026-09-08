import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useApp } from '../../contexts/AppContext';
import Icon from '../../components/Icon';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL, STATUS } from '../../theme/tokens';

/* The prototype maps pending → dirty, not waiting. Slightly warmer amber than
   STATUS.waiting; matching it keeps this pill identical to the bed chips. */
const STATUS_LOOK = {
  pending:  { bg: STATUS.dirty.bg,     fg: STATUS.dirty.text },
  approved: { bg: STATUS.inspected.bg, fg: STATUS.inspected.text },
  rejected: { bg: STATUS.error.bg,     fg: STATUS.error.text },
};

export default function ExtraRequestsScreen() {
  const { extraRequests, rooms, cleaners, approveExtraRoom, rejectExtraRoom, cleanupOldExtraRequests } = useApp();
  const [filter, setFilter] = useState('pending');
  const [imageViewer, setImageViewer] = useState(null);

  useEffect(() => {
    cleanupOldExtraRequests();
  }, []);

  const filteredRequests = extraRequests.filter(r => {
    const status = r.status || 'pending';
    return status === filter;
  });

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
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        <View style={styles.tabRow}>
          {tabs.map(tab => {
            const on = filter === tab;
            const count = extraRequests.filter(
              r => (r.status || 'pending') === tab
            ).length;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setFilter(tab)}
                style={[styles.tab, on && styles.tabOn]}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
                <Text style={[styles.tabCount, on && { color: BRAND.navy }]}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filteredRequests.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="inbox" size={32} color={NEUTRAL.text3} />
            <Text style={styles.emptyText}>No {filter} requests.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredRequests.map(req => {
              const room = rooms.find(r => r.id === req.id);
              const cleaner = cleaners.find(c => c.id === req.cleanerId);
              const status = req.status || 'pending';
              const look = STATUS_LOOK[status] || STATUS_LOOK.pending;
              const timestamp = req.requestedAt
                ? new Date(req.requestedAt).toLocaleString()
                : '';

              return (
                <View key={req.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.roomName} numberOfLines={1}>
                      {room?.name || 'Unknown room'}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: look.bg }]}>
                      <Text style={[styles.statusPillText, { color: look.fg }]}>
                        {status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text style={styles.byLine}>
                      Requested by {cleaner?.username || 'Unknown housekeeper'}
                    </Text>
                    {!!timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
                  </View>

                  {req.imageBase64 ? (
                    <View style={styles.photoRow}>
                      <Pressable
                        onPress={() => setImageViewer(`data:image/jpeg;base64,${req.imageBase64}`)}
                        style={styles.thumb}
                      >
                        <img
                          src={`data:image/jpeg;base64,${req.imageBase64}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </Pressable>
                      <TouchableOpacity
                        onPress={() => downloadImage(req.imageBase64)}
                        style={styles.downloadBtn}
                        activeOpacity={0.8}
                      >
                        <Icon name="download" size={17} color={BRAND.navy} />
                        <Text style={styles.downloadText}>Download</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {status === 'pending' && (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleApprove(req.id, req.cleanerId)}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.approveText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleReject(req.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.rejectText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Lightbox ── */}
      {imageViewer && (
        <View style={styles.lightboxOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setImageViewer(null)} />
          <View style={styles.lightboxContent}>
            <img
              src={imageViewer}
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, display: 'block' }}
            />
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
  container: { flex: 1, backgroundColor: NEUTRAL.appBg, position: 'relative' },

  page: { flex: 1 },
  pageContent: { paddingTop: 22, paddingHorizontal: 28, paddingBottom: 40 },

  tabRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    flexWrap: 'wrap', marginBottom: 20,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    height: 40, paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  tabOn: { backgroundColor: NEUTRAL.slateChip, borderColor: BRAND.navy },
  tabText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14, color: NEUTRAL.text2,
  },
  tabTextOn: { fontFamily: FONTS.semiBold, fontWeight: '600', color: BRAND.navy },
  tabCount: {
    fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text2,
    opacity: 0.75, fontVariant: ['tabular-nums'],
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: {
    flexGrow: 1, flexBasis: 360, minWidth: 360, maxWidth: '100%',
    gap: 12, padding: 18, borderRadius: 20,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12,
  },
  roomName: {
    flexShrink: 1, minWidth: 0,
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 18, color: NEUTRAL.text,
  },
  statusPill: {
    height: 24, paddingHorizontal: 10, borderRadius: 9, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  statusPillText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 11, letterSpacing: 0.66,
  },

  byLine: { fontFamily: FONTS.regular, fontSize: 13.5, color: NEUTRAL.text2 },
  timestamp: {
    marginTop: 3, fontFamily: FONTS.regular, fontSize: 12.5,
    color: NEUTRAL.text4, fontVariant: ['tabular-nums'],
  },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: {
    width: 96, height: 72, flexShrink: 0, borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.slateChip,
  },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 34, paddingHorizontal: 12, borderRadius: 11,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  downloadText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13, color: BRAND.navy,
  },

  actions: { flexDirection: 'row', gap: 9, marginTop: 2 },
  approveBtn: {
    flex: 1, height: 42, borderRadius: 13,
    backgroundColor: BRAND.navy, alignItems: 'center', justifyContent: 'center',
  },
  approveText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 14, color: '#FFFFFF',
  },
  rejectBtn: {
    flex: 1, height: 42, borderRadius: 13,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  rejectText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 14, color: '#B91C1C',
  },

  /* Dashed, not a filled card — the prototype keeps the empty state weightless
     so it doesn't read as a request that failed to load. */
  empty: {
    alignItems: 'center', gap: 12, paddingVertical: 64,
    borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1',
  },
  emptyText: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3 },

  /* Lightbox — not in the prototype. Kept, with the scrim moved to navy so it
     matches every other overlay in the app. */
  lightboxOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(11,31,58,0.85)',
    alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  lightboxContent: { alignItems: 'center', gap: 16 },
  lightboxActions: { flexDirection: 'row' },
  lightboxBtn: {
    height: 44, paddingHorizontal: 22, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxBtnText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 15, color: '#FFFFFF',
  },
});