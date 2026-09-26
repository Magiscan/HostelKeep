import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Alert,
  ActivityIndicator, Modal, Pressable,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Icon from '../../components/Icon';
import { useApp } from '../../contexts/AppContext';
import { COLORS } from '../../theme/colors';
import { FONTS, DISPLAY, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { RADIUS } from '../../theme/radius';
import { SHADOW } from '../../theme/shadows';
import { buildCleanerColors } from '../../utils/cleanerColor';
import BottomSheet from '../../components/BottomSheet';

/**
 * HostelKeep 2.0 extra-room requests (native).
 *
 * This screen previously did not exist on mobile at all — ManagerApp imported
 * only Dashboard/Setup/Team/Assign, so a manager on a phone could not approve
 * or reject anything. The .web.js version uses <img> and
 * document.createElement, which crash on native, hence the separate file.
 *
 * The photo matters here: a cleaner attaches one to justify the request, and
 * the manager needs to actually see it before deciding. Tapping the thumbnail
 * opens a full-screen viewer; the share button writes it to the cache and
 * hands it to the OS share sheet.
 */

const STATUS_META = {
  pending:  { accent: COLORS.accent,  label: 'pending' },
  approved: { accent: COLORS.success, label: 'approved' },
  rejected: { accent: COLORS.danger,  label: 'rejected' },
};

/* ─── Request card (memoised) ─────────────────────────────────── */
const RequestCard = React.memo(function RequestCard({
  req, room, cleaner, color, t, onApprove, onReject, onViewPhoto, busy,
}) {
  const status = req.status || 'pending';
  const meta = STATUS_META[status] || STATUS_META.pending;

  // requestedAt is an ISO string on the Spark build.
  let when = '';
  if (req.requestedAt) {
    const ms = new Date(req.requestedAt).getTime();
    if (Number.isFinite(ms)) when = new Date(ms).toLocaleString();
  }

  return (
    <View style={[styles.card, { borderLeftColor: meta.accent }]}>
      <View style={styles.cardRow}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>
            {(cleaner?.username || '?').charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cleanerName} numberOfLines={1}>
            {cleaner?.username || t('unknownCleaner') || 'Unknown cleaner'}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {when || (t('requestExtra') || 'Extra room request')}
          </Text>
        </View>

        <Text style={styles.roomName} numberOfLines={1}>
          {room?.name || t('unknownRoom') || '—'}
        </Text>
      </View>

      {req.imageBase64 ? (
        <TouchableOpacity
          onPress={() => onViewPhoto(req.imageBase64)}
          style={styles.photoRow}
          activeOpacity={0.85}
        >
          <Image
            source={{ uri: `data:image/jpeg;base64,${req.imageBase64}` }}
            style={styles.thumb}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.photoLabel}>{t('photo') || 'Photo attached'}</Text>
            <Text style={styles.photoHint}>{t('tapToView') || 'Tap to view'}</Text>
          </View>
          <Icon name="chevron_right" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>
      ) : null}

      {status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.approveBtn, busy && { opacity: 0.6 }]}
            onPress={() => onApprove(req.id, req.cleanerId)}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color={COLORS.onPrimary} size="small" />
              : (
                <>
                  <Icon name="check_circle" size={20} color={COLORS.onPrimary} filled />
                  <Text style={styles.approveText}>{t('approve')}</Text>
                </>
              )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rejectBtn, busy && { opacity: 0.6 }]}
            onPress={() => onReject(req.id, req.cleanerId)}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Icon name="cancel" size={20} color={COLORS.danger} />
            <Text style={styles.rejectText}>{t('reject')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}, (prev, next) => (
  prev.req.id === next.req.id
  && prev.req.status === next.req.status
  && prev.req.imageBase64 === next.req.imageBase64
  && prev.room?.name === next.room?.name
  && prev.cleaner?.id === next.cleaner?.id
  && prev.busy === next.busy
));

/* ─── Screen ──────────────────────────────────────────────────── */
export default function ExtraRequestsScreen({ bottomPad = 0 }) {
  const { t } = useTranslation();
  const { extraRequests = [], rooms = [], cleaners = [], approveExtraRoom, rejectExtraRoom, cleanupOldExtraRequests, deleteExtraRequest, } = useApp();

  const [filter, setFilter] = useState('pending');
  const [viewer, setViewer] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    cleanupOldExtraRequests?.();
  }, []);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    extraRequests.forEach(r => {
      const s = r.status || 'pending';
      if (c[s] !== undefined) c[s] += 1;
    });
    return c;
  }, [extraRequests]);

  const visible = useMemo(
    () => extraRequests.filter(r => (r.status || 'pending') === filter),
    [extraRequests, filter],
  );

  const roomById = useMemo(() => {
    const m = {};
    rooms.forEach(r => { m[r.id] = r; });
    return m;
  }, [rooms]);

  const cleanerById = useMemo(() => {
    const colors = buildCleanerColors(cleaners);
    const m = {};
    cleaners.forEach(c => { m[c.id] = { cleaner: c, color: colors[c.id] }; });
    return m;
  }, [cleaners]);

  const handleApprove = useCallback(async (roomId, cleanerId) => {
    setBusyId(roomId);
    try {
      await approveExtraRoom(roomId, cleanerId);
    } catch (e) {
      Alert.alert(t('error') || 'Error', e.message);
    } finally {
      setBusyId(null);
    }
  }, [approveExtraRoom, t]);

  const handleReject = useCallback(async (roomId, cleanerId) => {
    setBusyId(roomId);
    try {
      await rejectExtraRoom(roomId, cleanerId);
    } catch (e) {
      Alert.alert(t('error') || 'Error', e.message);
    } finally {
      setBusyId(null);
    }
  }, [rejectExtraRoom, t]);

  const clearResolved = useCallback(async () => {
    const doomed = extraRequests.filter(r => (r.status || 'pending') === filter);
    await Promise.all(doomed.map(r => deleteExtraRequest(r.id)));
    setConfirmClear(false);
  }, [extraRequests, filter, deleteExtraRequest]);

  const sharePhoto = async (base64) => {
    try {
      const path = `${FileSystem.cacheDirectory}request_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'image/jpeg' });
      } else {
        Alert.alert(t('error') || 'Error', 'Sharing is not available on this device.');
      }
    } catch (e) {
      Alert.alert(t('error') || 'Error', e.message);
    }
  };

  const TABS = [
    { key: 'pending',  label: t('pending')  || 'Pending',  count: counts.pending },
    { key: 'approved', label: t('approved') || 'Approved', count: counts.approved },
    { key: 'rejected', label: t('rejected') || 'Rejected', count: counts.rejected },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>{t('extraRoomRequests') || 'Extra requests'}</Text>

        {/* Stat strip — pending is the only one styled in gold, because it's
            the only one that needs the manager to do something. */}
        <View style={styles.statRow}>
          <View style={[styles.statCell, styles.statCellPending]}>
            <Text style={[styles.statNum, { color: COLORS.accentDark }]}>{counts.pending}</Text>
            <Text style={[styles.statLbl, { color: '#92400E' }]}>
              {t('pending') || 'Pending'}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: COLORS.success }]}>{counts.approved}</Text>
            <Text style={styles.statLbl}>{t('approved') || 'Approved'}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: COLORS.danger }]}>{counts.rejected}</Text>
            <Text style={styles.statLbl}>{t('rejected') || 'Rejected'}</Text>
          </View>
        </View>

        {/* Filter tabs */}
        <View style={styles.tabRow}>
          {TABS.map(tab => {
            const active = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setFilter(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filter !== 'pending' && visible.length > 0 && (
          <TouchableOpacity
            onPress={() => setConfirmClear(true)}
            style={styles.clearBtn}
            activeOpacity={0.8}
          >
            <Icon name="delete_sweep" size={20} color={COLORS.danger} />
            <Text style={styles.clearBtnText}>
              {t('clearHistory') || `Clear ${filter} requests`}
            </Text>
          </TouchableOpacity>
        )}

        {visible.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Icon name="inbox" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>
              {t('noRequests') || `No ${filter} requests`}
            </Text>
            {filter === 'pending' && (
              <Text style={styles.emptySub}>
                {t('requestsEmptyHint')
                  || 'When a cleaner asks for an extra room, it lands here.'}
              </Text>
            )}
          </View>
        ) : (
          visible.map(req => {
            const entry = cleanerById[req.cleanerId];
            return (
              <RequestCard
                key={req.id}
                req={req}
                room={roomById[req.id]}
                cleaner={entry?.cleaner || null}
                color={entry?.color || COLORS.textMuted}
                t={t}
                busy={busyId === req.id}
                onApprove={handleApprove}
                onReject={handleReject}
                onViewPhoto={setViewer}
              />
            );
          })
        )}
      </ScrollView>

      {/* ── Full-screen photo viewer ── */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.lightbox}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewer(null)} />
          {viewer && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${viewer}` }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.lightboxActions}>
            <TouchableOpacity
              onPress={() => sharePhoto(viewer)}
              style={styles.lightboxBtn}
              activeOpacity={0.8}
            >
              <Icon name="share" size={22} color={COLORS.onPrimary} />
              <Text style={styles.lightboxBtnText}>{t('share') || 'Share'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewer(null)}
              style={styles.lightboxBtn}
              activeOpacity={0.8}
            >
              <Icon name="close" size={22} color={COLORS.onPrimary} />
              <Text style={styles.lightboxBtnText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomSheet visible={confirmClear} onClose={() => setConfirmClear(false)} maxHeightRatio={0.45}>
        <Text style={styles.sheetTitle}>{t('clearHistory') || 'Clear history?'}</Text>
        <Text style={styles.sheetSub}>
          {t('clearHistoryMsg')
            || `This removes ${filter} requests from the list, but does not undo any room assignments already made.`}
        </Text>
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
          <TouchableOpacity onPress={() => setConfirmClear(false)} style={[styles.halfBtn, styles.halfBtnGhost]}>
            <Text style={styles.halfBtnGhostText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearResolved} style={[styles.halfBtn, { backgroundColor: COLORS.danger }]}>
            <Text style={styles.halfBtnText}>{t('confirm') || 'Confirm'}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xs },
  pageTitle: {
    fontFamily: DISPLAY.semiBold,
    fontSize: FONT_SIZE.xxxl,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },

  statRow: { flexDirection: 'row', gap: SPACING.xs },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    padding: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  statCellPending: { backgroundColor: COLORS.accentLight, borderColor: COLORS.accent },
  statNum: { fontFamily: DISPLAY.semiBold, fontSize: 26, lineHeight: 28 },
  statLbl: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  tabRow: { flexDirection: 'row', gap: SPACING.xs, marginVertical: SPACING.sm },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: 'rgba(15,23,42,0.06)', borderColor: COLORS.border },
  tabTextActive: { color: COLORS.text, fontFamily: FONTS.semiBold },
  tabText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },

  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 6,
    borderRadius: RADIUS.xxl,
    padding: 15,
    marginBottom: 11,
    gap: 12,
    ...SHADOW.card,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: DISPLAY.semiBold, fontSize: 16, color: COLORS.onPrimary },
  cleanerName: { fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.primary },
  cardSub: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  roomName: { fontFamily: DISPLAY.semiBold, fontSize: 26, color: COLORS.primary },

  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSunken,
    borderRadius: RADIUS.lg,
    padding: SPACING.xs,
  },
  thumb: { width: 56, height: 56, borderRadius: RADIUS.md },
  photoLabel: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },
  photoHint: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  actions: { flexDirection: 'row', gap: SPACING.xs },
  approveBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  approveText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.onPrimary },
  rejectBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  rejectText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.danger },

  emptyWrap: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.xs },
  emptyTitle: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.xl, color: COLORS.primary },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: SPACING.md,
  },

  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: { width: '92%', height: '68%' },
  lightboxActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  lightboxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 48,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  lightboxBtnText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.md, color: COLORS.onPrimary },
    clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.surface,
    marginBottom: 12,
  },
  clearBtnText: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.danger },
  sheetTitle: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.xxl, color: COLORS.primary },
  sheetSub: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  halfBtn: { flex: 1, height: 52, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center' },
  halfBtnGhost: { backgroundColor: COLORS.surfaceMuted },
  halfBtnGhostText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.lg, color: COLORS.primary },
  halfBtnText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.lg, color: COLORS.onPrimary },
});