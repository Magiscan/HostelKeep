import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, Alert,
} from 'react-native';
// SDK 54 shipped a rewrite of expo-file-system around new File/Directory
// classes. The old functional API (writeAsStringAsync, EncodingType) still
// exists on the default import, but now THROWS at runtime instead of working
// — that's the source of the "Cannot read property Base64 of undefined"
// error. Importing the explicit /legacy module keeps the old, working API.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../contexts/AppContext';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING, SHADOW } from '../../theme';
import { Card, EmptyState, SectionTitle } from '../../components/UI';

/**
 * Native counterpart to ExtraRequestsScreen.web.js.
 *
 * This screen did not previously exist on mobile — ManagerApp imported only
 * Dashboard, Setup, Team and Assign, so a manager on a phone could not approve
 * or reject an extra-room request at all. The web version uses <img> and
 * document.createElement, which crash on native, hence a separate file.
 */

const STATUS_COLORS = {
  pending: COLORS.accent,
  approved: COLORS.success,
  rejected: COLORS.danger,
};

export default function ExtraRequestsScreen() {
  const { t } = useTranslation();
  const { extraRequests, rooms, cleaners, approveExtraRoom, rejectExtraRoom } = useApp();
  const [filter, setFilter] = useState('pending');
  const [viewer, setViewer] = useState(null);

  const counts = {
    pending: extraRequests.filter(r => r.status === 'pending' || !r.status).length,
    approved: extraRequests.filter(r => r.status === 'approved').length,
    rejected: extraRequests.filter(r => r.status === 'rejected').length,
  };

  const visible = extraRequests.filter(
    r => r.status === filter || (filter === 'pending' && !r.status),
  );

  const shareImage = async (base64) => {
    try {
      const path = `${FileSystem.cacheDirectory}request_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'image/jpeg' });
      } else {
        Alert.alert('Sharing is not available on this device.');
      }
    } catch (e) {
      Alert.alert('Could not share the photo', e.message);
    }
  };

  const handleApprove = async (roomId, cleanerId) => {
    try {
      await approveExtraRoom(roomId, cleanerId);
    } catch (e) {
      Alert.alert(e.message);
    }
  };

  const handleReject = async (roomId) => {
    try {
      await rejectExtraRoom(roomId);
    } catch (e) {
      Alert.alert(e.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionTitle
          title={t('extraRequests') || 'Extra Requests'}
          subtitle={t('reviewCleanerRequests') || 'Review and manage cleaner requests'}
        />

        {/* Filter tabs */}
        <View style={styles.tabRow}>
          {['pending', 'approved', 'rejected'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, filter === tab && styles.tabActive]}
              onPress={() => setFilter(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab]})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {visible.length === 0 ? (
          <EmptyState
            icon="📋"
            title={`No ${filter} requests`}
            subtitle={
              filter === 'pending'
                ? 'Requests from your cleaners will appear here.'
                : undefined
            }
          />
        ) : (
          visible.map(req => {
            const room = rooms.find(r => r.id === req.id);
            const cleaner = cleaners.find(c => c.id === req.cleanerId);
            const status = req.status || 'pending';
            const statusColor = STATUS_COLORS[status] || COLORS.textSecondary;

            // requestedAt is an ISO string on the Spark build.
            let when = '';
            if (req.requestedAt) {
              const ms = new Date(req.requestedAt).getTime();
              if (Number.isFinite(ms)) when = new Date(ms).toLocaleString();
            }

            return (
              <Card key={req.id} style={styles.card}>
                <View style={styles.headerRow}>
                  <Text style={styles.roomName} numberOfLines={1}>
                    {room?.name || t('unknownRoom') || 'Unknown room'}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
                    <Text style={[styles.badgeText, { color: statusColor }]}>
                      {status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.meta}>
                  {t('requestedBy', {
                    name: cleaner?.username || t('unknownCleaner') || 'Unknown cleaner',
                  })}
                </Text>
                {when ? <Text style={styles.timestamp}>{when}</Text> : null}

                {req.imageBase64 ? (
                  <View style={styles.imageRow}>
                    <TouchableOpacity
                      onPress={() => setViewer(req.imageBase64)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${req.imageBase64}` }}
                        style={styles.thumb}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => shareImage(req.imageBase64)}
                      style={styles.shareBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.shareText}>{t('share') || 'Share'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {status === 'pending' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: COLORS.success }]}
                      onPress={() => handleApprove(req.id, req.cleanerId)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnText}>{t('approve') || 'Approve'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: COLORS.danger }]}
                      onPress={() => handleReject(req.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnText}>{t('reject') || 'Reject'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Full-screen photo viewer */}
      <Modal visible={!!viewer} transparent animationType="fade">
        <View style={styles.lightbox}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setViewer(null)}
          />
          {viewer && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${viewer}` }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            onPress={() => setViewer(null)}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.closeText}>{t('close') || 'Close'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING[4] },

  tabRow: { flexDirection: 'row', gap: SPACING[2], marginBottom: SPACING[4] },
  tab: {
    flex: 1,
    paddingVertical: SPACING[2],
    paddingHorizontal: SPACING[2],
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  tabText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  tabTextActive: { color: COLORS.primary, fontFamily: FONTS.bold },

  card: { padding: SPACING[4], marginBottom: SPACING[3] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roomName: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING[2],
  },
  badge: { paddingHorizontal: SPACING[2], paddingVertical: 3, borderRadius: RADIUS.sm },
  badgeText: { fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 0.4 },
  meta: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  timestamp: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[3],
    marginTop: SPACING[3],
  },
  thumb: { width: 96, height: 72, borderRadius: RADIUS.sm },
  shareBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  shareText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.primary },

  actions: { flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[4] },
  btn: {
    flex: 1,
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.white },

  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: { width: '92%', height: '70%' },
  closeBtn: {
    marginTop: SPACING[6],
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING[6],
    paddingVertical: SPACING[3],
    minHeight: 44,
    justifyContent: 'center',
  },
  closeText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.white },
});