import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { useApp } from '../../contexts/AppContext';
import { db } from '../../firebase';
import AppCard from '../../components/Card/AppCard';
import { Badge, EmptyState } from '../../components/UI';
import Icon from '../../components/Icon';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING, RADIUS } from '../../theme';
import * as XLSX from 'xlsx';
import { generateDailyReport } from '../../utils/dailyReport';

const CLEANER_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#0891B2', '#16A34A', '#4F46E5', '#DC2626',
];

const getToday = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDate = (dateString) => {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

const getInitials = (name) =>
  name
    ? name.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0)).join('').toUpperCase()
    : '?';

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const {
    hostelCode,
    rooms,
    roomStatus,
    cleaners,
    floors,
    extraRequests,
    hostel,
  } = useApp();
  const today = getToday();

  const [selectedDate, setSelectedDate] = useState(today);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCleaners, setExpandedCleaners] = useState(new Set());

  const text = (key, fallback) => {
    const translated = t(key);
    return !translated || translated === key ? fallback : translated;
  };

  const loadHistory = useCallback(async (date) => {
    if (!hostelCode) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'hostels', hostelCode, 'dailyLogs', date));
      setHistory(snap.exists() ? snap.data() : null);
    } catch (error) {
      console.error('History loading error:', error);
      setHistory(null);
      Alert.alert(text('error', 'Error'), error.message || text('historyLoadFailed', 'Unable to load history.'));
    } finally {
      setLoading(false);
    }
  }, [hostelCode]);

  useEffect(() => {
    loadHistory(selectedDate);
  }, [selectedDate, loadHistory]);

  const changeDate = (amount) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    current.setDate(current.getDate() + amount);

    const nextYear = current.getFullYear();
    const nextMonth = String(current.getMonth() + 1).padStart(2, '0');
    const nextDay = String(current.getDate()).padStart(2, '0');
    const nextDate = `${nextYear}-${nextMonth}-${nextDay}`;

    if (nextDate > today) return;

    setSelectedDate(nextDate);
    setSearch('');
  };

  const cleanerStats = useMemo(() => {
    if (!history?.cleaners) return [];
    return Object.entries(history.cleaners).map(([cleanerId, cleaner], index) => {
      const rooms = cleaner.rooms || [];
      const cleaned = rooms.filter(r => r.cleaned).length;
      const total = rooms.length;
      const percentage = total > 0 ? Math.round((cleaned / total) * 100) : 0;
      const extraTime = rooms.reduce((sum, r) => sum + Number(r.extraTime || 0), 0);
      return {
        id: cleanerId,
        name: cleaner.cleanerName || cleaner.name || cleanerId,
        rooms,
        cleaned,
        total,
        percentage,
        extraTime,
        color: CLEANER_COLORS[index % CLEANER_COLORS.length],
      };
    });
  }, [history]);

  const visibleCleaners = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cleanerStats;
    return cleanerStats.map(cleaner => {
      const cleanerMatches = cleaner.name.toLowerCase().includes(query);
      if (cleanerMatches) return cleaner;
      const matchingRooms = cleaner.rooms.filter(r =>
        String(r.roomName || '').toLowerCase().includes(query)
      );
      if (!matchingRooms.length) return null;
      return { ...cleaner, rooms: matchingRooms };
    }).filter(Boolean);
  }, [cleanerStats, search]);

  const stats = useMemo(() => {
    const total = cleanerStats.reduce((sum, c) => sum + c.total, 0);
    const cleaned = cleanerStats.reduce((sum, c) => sum + c.cleaned, 0);
    const extraTime = cleanerStats.reduce((sum, c) => sum + c.extraTime, 0);
    return {
      total,
      cleaned,
      pending: Math.max(0, total - cleaned),
      extraTime,
      percentage: total > 0 ? Math.round((cleaned / total) * 100) : 0,
    };
  }, [cleanerStats]);

  const toggleCleaner = (id) => {
    setExpandedCleaners(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    if (!history) return;
    try {
      let reportData;

      if (history.roomsSnapshot && history.roomStatusSnapshot && history.cleanersSnapshot) {
        // New logs: use the full snapshot
        reportData = {
          date: selectedDate,
          hostelName: history.hostelName || hostel?.name || 'KeepClean',
          rooms: history.roomsSnapshot,
          roomStatus: history.roomStatusSnapshot,
          cleaners: history.cleanersSnapshot,
          floors: history.floorsSnapshot || [],
          extraRequests: history.extraRequestsSnapshot || [],
          lang: i18n.language.startsWith('it') ? 'it' : 'en',
        };
      } else {
        // Old logs: reconstruct minimal data from the stored cleaner summary
        const reconstructedCleaners = [];
        const reconstructedRooms = [];
        const reconstructedRoomStatus = {};

        Object.entries(history.cleaners || {}).forEach(([cleanerId, cleaner]) => {
          const cleanerName = cleaner.cleanerName || cleanerId;
          reconstructedCleaners.push({
            id: cleanerId,
            username: cleanerName,
          });

          (cleaner.rooms || []).forEach(room => {
            reconstructedRooms.push({
              id: room.roomId,
              name: room.roomName || 'Unknown',
              floorId: null,
              type: room.type || 'private',
              beds: [],
              assignedTo: cleanerId,
            });

            reconstructedRoomStatus[room.roomId] = {
              cleaned: room.cleaned || false,
              notes: room.notes || '',
              extraTime: room.extraTime || 0,
              managerNotes: room.managerNotes || '',
              commonOnly: room.commonOnly || false,
              assignmentAttributes: room.assignmentAttributes || {},
              assignmentBedStatus: room.assignmentBedStatus || {},
              bedStatus: room.bedStatus || {},
              earlyCheckIn: false,
              lateCheckOut: false,
              extraCleaning: room.extraCleaning || false,
            };
          });
        });

        reportData = {
          date: selectedDate,
          hostelName: history.hostelName || hostel?.name || 'KeepClean',
          rooms: reconstructedRooms,
          roomStatus: reconstructedRoomStatus,
          cleaners: reconstructedCleaners,
          floors: [],
          extraRequests: [],
          lang: i18n.language.startsWith('it') ? 'it' : 'en',
        };
      }

      const wb = generateDailyReport(reportData);
      const fileName = `KeepClean_Report_${selectedDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        text('error', 'Error'),
        text('exportFailed', 'Could not export the history.')
      );
    }
  };

  return (
    <View style={styles.page}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.pageTitle}>{text('dailyHistory', 'Daily history')}</Text>
          <Text style={styles.subtitle}>{text('historySubtitle', 'Review completed cleaning work and room activity.')}</Text>
        </View>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={exportCSV}
          disabled={!history}
          activeOpacity={0.8}
        >
          <Icon name="download-outline" size={17} color={history ? '#FFFFFF' : COLORS.textMuted} />
          <Text style={[styles.exportButtonText, !history && styles.disabledButtonText]}>
            {text('downloadCSV', 'Download Report')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Controls: date picker + search */}
        <View style={styles.controls}>
          <View style={styles.dateArea}>
            <Text style={styles.controlLabel}>DATE</Text>
            <View style={styles.dateRow}>
              {/* Previous day arrow */}
              <TouchableOpacity style={styles.arrowButton} onPress={() => changeDate(-1)} activeOpacity={0.75}>
                <Icon name="arrow-back" size={18} color={COLORS.text} />
              </TouchableOpacity>

              {/* Native date input – allows selecting any date */}
              <View style={styles.dateDisplay}>
                <Icon name="calendar-outline" size={17} color={COLORS.primary} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value && e.target.value <= today) {
                      setSelectedDate(e.target.value);
                      setSearch('');
                    }
                  }}
                  max={today}
                  style={styles.dateInput}
                />
              </View>

              {/* Next day arrow */}
              <TouchableOpacity
                style={[styles.arrowButton, selectedDate === today && styles.disabledArrow]}
                onPress={() => changeDate(1)}
                disabled={selectedDate === today}
                activeOpacity={0.75}
              >
                <Icon name="arrow-forward" size={18} color={selectedDate === today ? COLORS.textMuted : COLORS.text} />
              </TouchableOpacity>

              {selectedDate !== today && (
                <TouchableOpacity style={styles.todayButton} onPress={() => { setSelectedDate(today); setSearch(''); }} activeOpacity={0.75}>
                  <Text style={styles.todayButtonText}>Today</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Text style={styles.controlLabel}>SEARCH</Text>
            <View style={styles.searchBox}>
              <Icon name="search-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search rooms or cleaners..."
                placeholderTextColor={COLORS.textMuted}
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Icon name="close-circle" size={17} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        )}

        {/* No history */}
        {!loading && !history && (
          <View style={styles.noHistory}>
            <View style={styles.emptyIcon}>
              <Icon name="calendar-outline" size={30} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No history for this date</Text>
            <Text style={styles.emptyText}>
              There is no cleaning activity recorded for {formatDate(selectedDate)}.
            </Text>
          </View>
        )}

        {/* History content */}
        {!loading && history && (
          <>
            {/* Progress */}
            <AppCard style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>TODAY'S PROGRESS</Text>
                  <View style={styles.progressNumberRow}>
                    <Text style={styles.progressNumber}>{stats.percentage}%</Text>
                    <Text style={styles.progressDescription}>
                      {stats.cleaned} of {stats.total} rooms completed
                    </Text>
                  </View>
                </View>
                <View style={[styles.progressStatus, stats.percentage === 100 && styles.progressStatusDone]}>
                  <Icon
                    name={stats.percentage === 100 ? 'checkmark' : 'time-outline'}
                    size={15}
                    color={stats.percentage === 100 ? COLORS.success : COLORS.warning}
                  />
                  <Text style={[styles.progressStatusText, stats.percentage === 100 && styles.progressStatusDoneText]}>
                    {stats.percentage === 100 ? 'Complete' : 'In progress'}
                  </Text>
                </View>
              </View>

              <View style={styles.bigProgressTrack}>
                <View style={[styles.bigProgressFill, { width: `${Math.max(0, Math.min(100, stats.percentage))}%` }]} />
              </View>

              <View style={styles.statGrid}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{stats.total}</Text>
                  <Text style={styles.statLabel}>Total rooms</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.cleaned}</Text>
                  <Text style={styles.statLabel}>Cleaned</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: COLORS.warning }]}>{stats.pending}</Text>
                  <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: COLORS.primary }]}>+{stats.extraTime}m</Text>
                  <Text style={styles.statLabel}>Extra time</Text>
                </View>
              </View>
            </AppCard>

            {/* Cleaner section */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Cleaner activity</Text>
                <Text style={styles.sectionSubtitle}>
                  {visibleCleaners.length} {visibleCleaners.length === 1 ? 'cleaner' : 'cleaners'} · Select a cleaner to view their rooms
                </Text>
              </View>
            </View>

            {/* Search empty */}
            {visibleCleaners.length === 0 && (
              <View style={styles.searchEmpty}>
                <Icon name="search-outline" size={28} color={COLORS.textMuted} />
                <Text style={styles.searchEmptyTitle}>No rooms found</Text>
                <Text style={styles.searchEmptyText}>Try another room or cleaner name.</Text>
              </View>
            )}

            {/* Cleaner cards */}
            <View style={styles.cleanerList}>
              {visibleCleaners.map(cleaner => {
                const expanded = expandedCleaners.has(cleaner.id);
                return (
                  <AppCard key={cleaner.id} style={styles.cleanerCard}>
                    <TouchableOpacity style={styles.cleanerHeader} onPress={() => toggleCleaner(cleaner.id)} activeOpacity={0.8}>
                      <View style={styles.cleanerLeft}>
                        <View style={[styles.avatar, { backgroundColor: cleaner.color }]}>
                          <Text style={styles.avatarText}>{getInitials(cleaner.name)}</Text>
                        </View>
                        <View style={styles.cleanerDetails}>
                          <Text style={styles.cleanerName}>{cleaner.name}</Text>
                          <Text style={styles.cleanerRooms}>
                            {cleaner.cleaned} of {cleaner.total} rooms completed
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cleanerRight}>
                        <View style={styles.cleanerProgress}>
                          <View style={styles.cleanerProgressTrack}>
                            <View
                              style={[
                                styles.cleanerProgressFill,
                                {
                                  width: `${cleaner.percentage}%`,
                                  backgroundColor: cleaner.percentage === 100 ? COLORS.success : COLORS.primary,
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.cleanerPercentage, cleaner.percentage === 100 && styles.completedPercentage]}>
                            {cleaner.percentage}%
                          </Text>
                        </View>
                        <View style={styles.chevron}>
                          <Icon
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={17}
                            color={COLORS.textSecondary}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>

                    {expanded && (
                      <View style={styles.roomsContainer}>
                        {cleaner.rooms.map((room, index) => (
                          <View key={room.roomId || `${room.roomName}-${index}`} style={styles.roomRow}>
                            <View style={[styles.roomStatus, room.cleaned ? styles.roomStatusDone : styles.roomStatusPending]}>
                              <Icon
                                name={room.cleaned ? 'checkmark' : 'time-outline'}
                                size={14}
                                color={room.cleaned ? COLORS.success : COLORS.warning}
                              />
                            </View>
                            <View style={styles.roomMain}>
                              <Text style={styles.roomName}>{room.roomName}</Text>
                              {(room.notes || room.extraTime > 0) && (
                                <View style={styles.roomExtras}>
                                  {room.notes ? (
                                    <Text style={styles.roomNote} numberOfLines={1}>{room.notes}</Text>
                                  ) : null}
                                  {room.extraTime > 0 ? (
                                    <Text style={styles.extraTime}>Extra time: {room.extraTime} min</Text>
                                  ) : null}
                                </View>
                              )}
                            </View>
                            <Badge label={room.cleaned ? 'Cleaned' : 'Pending'} type={room.cleaned ? 'clean' : 'extra'} />
                          </View>
                        ))}
                      </View>
                    )}
                  </AppCard>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },

  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING[6], paddingVertical: SPACING[4],
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexWrap: 'wrap', gap: SPACING[3],
  },
  pageTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  subtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },

  exportButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingHorizontal: 17, height: 42, borderRadius: 11,
  },
  exportButtonText: { fontFamily: FONTS.semiBold, fontSize: 13, color: '#FFFFFF' },
  disabledButtonText: { color: COLORS.textMuted },

  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    paddingHorizontal: SPACING[6],
    paddingTop: SPACING[4],
    paddingBottom: SPACING[10],
  },

  controls: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SPACING[4],
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[4],
  },
  dateArea: { flex: 1 },
  searchContainer: { width: 330 },
  controlLabel: { fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 1, color: COLORS.textMuted, marginBottom: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrowButton: {
    width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  disabledArrow: { opacity: 0.4 },
  dateDisplay: {
    flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 13, borderRadius: 10,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  dateInput: {
    flex: 1,
    border: 'none',
    backgroundColor: 'transparent',
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.text,
    outline: 'none',
    padding: 0,
  },
  todayButton: {
    height: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, backgroundColor: COLORS.primaryLight,
  },
  todayButtonText: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.primary },

  searchBox: {
    height: 40, flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1, padding: 0,
    outline: 'none', border: 'none',
    fontFamily: FONTS.regular, fontSize: 13, color: COLORS.text,
  },

  loadingBox: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: 35, alignItems: 'center',
  },
  loadingText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary },

  noHistory: {
    minHeight: 360, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center', padding: 40,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primaryLight, marginBottom: 15,
  },
  emptyTitle: { fontFamily: FONTS.semiBold, fontSize: 19, color: COLORS.text },
  emptyText: {
    maxWidth: 420, textAlign: 'center', marginTop: 7,
    fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: COLORS.textSecondary,
  },

  progressCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: 22, marginBottom: SPACING[4] },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  cardEyebrow: { fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 1, color: COLORS.textMuted, marginBottom: 5 },
  progressNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  progressNumber: { fontFamily: FONTS.bold, fontSize: 28, color: COLORS.text },
  progressDescription: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  progressStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.warningLight || '#FFF7E8',
  },
  progressStatusDone: { backgroundColor: COLORS.successLight },
  progressStatusText: { fontFamily: FONTS.semiBold, fontSize: 11, color: COLORS.warning },
  progressStatusDoneText: { color: COLORS.success },

  bigProgressTrack: { height: 9, borderRadius: 6, backgroundColor: COLORS.border, overflow: 'hidden' },
  bigProgressFill: { height: '100%', borderRadius: 6, backgroundColor: COLORS.success },

  statGrid: {
    flexDirection: 'row', marginTop: 22, paddingTop: 17,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.text },
  statLabel: { marginTop: 3, fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textMuted },

  sectionHeader: { marginBottom: 13 },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.text },
  sectionSubtitle: { marginTop: 4, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },

  cleanerList: { gap: 10 },
  cleanerCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: 'hidden' },
  cleanerHeader: {
    minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
  },
  cleanerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { fontFamily: FONTS.bold, fontSize: 14, color: '#FFFFFF' },
  cleanerDetails: { flex: 1 },
  cleanerName: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.text },
  cleanerRooms: { marginTop: 4, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted },

  cleanerRight: { flexDirection: 'row', alignItems: 'center', gap: 16, width: 270 },
  cleanerProgress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cleanerProgressTrack: { flex: 1, height: 7, borderRadius: 5, backgroundColor: COLORS.border, overflow: 'hidden' },
  cleanerProgressFill: { height: '100%', borderRadius: 5 },
  cleanerPercentage: { width: 38, textAlign: 'right', fontFamily: FONTS.bold, fontSize: 13, color: COLORS.primary },
  completedPercentage: { color: COLORS.success },
  chevron: {
    width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background,
  },

  roomsContainer: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: 18, paddingVertical: 4,
  },
  roomRow: {
    minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 11,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  roomStatus: {
    width: 29, height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  roomStatusDone: { backgroundColor: COLORS.successLight },
  roomStatusPending: { backgroundColor: COLORS.warningLight || '#FFF7E8' },
  roomMain: { flex: 1, minWidth: 0 },
  roomName: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.text },
  roomExtras: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3 },
  roomNote: { maxWidth: 400, fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textMuted },
  extraTime: { fontFamily: FONTS.semiBold, fontSize: 11, color: COLORS.warning },

  searchEmpty: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingVertical: 65, alignItems: 'center', marginBottom: 20,
  },
  searchEmptyTitle: { marginTop: 12, fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.text },
  searchEmptyText: { marginTop: 5, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted },
});