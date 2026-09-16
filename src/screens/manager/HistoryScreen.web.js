import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { useApp } from '../../contexts/AppContext';
import { db } from '../../firebase';
import Icon from '../../components/Icon';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL, STATUS, ACCENT } from '../../theme/tokens';
import { buildCleanerColors } from '../../utils/cleanerColor';
import { downloadDailyReport } from '../../utils/dailyReport';

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

export default function HistoryScreen({ onReady }) {
  const { t, i18n } = useTranslation();
  const {
    hostelCode,
    rooms,
    roomStatus,
    cleaners,
    floors,
    extraRequests,
    hostel,
    can,
  } = useApp();
  const today = getToday();

  const [selectedDate, setSelectedDate] = useState(today);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCleaners, setExpandedCleaners] = useState(new Set());
  const canExport = can('export');

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

  // ── Build cleaner stats from history ──────────────────────────
  const cleanerStats = useMemo(() => {
    if (!history?.cleaners) return [];
    const colorMap = buildCleanerColors(
      Object.keys(history.cleaners).map(id => ({ id }))
    );
    return Object.entries(history.cleaners).map(([cleanerId, cleaner]) => {
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
        color: colorMap[cleanerId] || '#2563EB',
      };
    });
  }, [history]);

  // ── Search filter ─────────────────────────────────────────────
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

  // ── Overall stats ─────────────────────────────────────────────
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

  // ── Export (memoized) ─────────────────────────────────────────
  const exportCSV = useCallback(() => {
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
          snapshotAt: history.savedAt,
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
          snapshotAt: history.savedAt,
          lang: i18n.language.startsWith('it') ? 'it' : 'en',
        };
      }

      downloadDailyReport(reportData);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        text('error', 'Error'),
        text('exportFailed', 'Could not export the history.')
      );
    }
  }, [history, selectedDate, hostel, i18n.language]);

  // ── Expose actions to the layout ──────────────────────────────
  useEffect(() => {
    if (!onReady) return;
    onReady({
      exportReport: exportCSV,
      canExport: canExport && !!history,
    });
  }, [onReady, exportCSV, history, canExport]);

  return (
    <View style={styles.page}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Controls: date picker + search */}
        <View style={styles.controls}>
          <View style={styles.dateArea}>
            <Text style={styles.controlLabel}>Date</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.arrowButton} onPress={() => changeDate(-1)} activeOpacity={0.75}>
                <Icon name="arrow_back" size={19} color={NEUTRAL.text} />
              </TouchableOpacity>

              <View style={styles.dateDisplay}>
                <Icon name="calendar_month" size={18} color={BRAND.navy} />
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

              <TouchableOpacity
                style={[styles.arrowButton, selectedDate === today && { opacity: 0.4 }]}
                onPress={() => changeDate(1)}
                disabled={selectedDate === today}
                activeOpacity={0.75}
              >
                <Icon name="arrow_forward" size={19} color={NEUTRAL.text} />
              </TouchableOpacity>

              {selectedDate !== today && (
                <TouchableOpacity
                  style={styles.todayButton}
                  onPress={() => { setSelectedDate(today); setSearch(''); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.todayButtonText}>Today</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Text style={styles.controlLabel}>Search</Text>
            <View style={styles.searchBox}>
              <Icon name="search" size={18} color={NEUTRAL.text3} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search rooms or housekeepers…"
                placeholderTextColor={NEUTRAL.text4}
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Icon name="cancel" size={17} color={NEUTRAL.text3} />
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
            <Text style={styles.emptyTitle}>No history for this date</Text>
            <Text style={styles.emptyText}>
              There is no cleaning activity recorded for {formatDate(selectedDate)}.
            </Text>
          </View>
        )}

        {/* History content */}
        {!loading && history && (
          <>
            {/* Progress Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>Progress on this day</Text>
                  <View style={styles.progressNumberRow}>
                    <Text style={styles.progressNumber}>{stats.percentage}%</Text>
                    <Text style={styles.progressDescription}>
                      {stats.cleaned} of {stats.total} rooms completed
                    </Text>
                  </View>
                </View>
                <View style={[styles.progressStatus, {
                  backgroundColor: stats.percentage === 100 ? STATUS.inspected.bg : STATUS.dirty.bg,
                }]}>
                  <Icon
                    name={stats.percentage === 100 ? 'check' : 'schedule'}
                    size={16}
                    color={stats.percentage === 100 ? STATUS.inspected.text : STATUS.dirty.text}
                  />
                  <Text style={[styles.progressStatusText, {
                    color: stats.percentage === 100 ? STATUS.inspected.text : STATUS.dirty.text,
                  }]}>
                    {stats.percentage === 100 ? 'Complete' : 'In progress'}
                  </Text>
                </View>
              </View>

              <View style={styles.bigProgressTrack}>
                <View style={[styles.bigProgressFill, {
                  width: `${Math.max(0, Math.min(100, stats.percentage))}%`,
                  backgroundColor: stats.percentage === 100 ? ACCENT.complete : BRAND.yellow,
                }]} />
              </View>

              <View style={styles.statGrid}>
                {[
                  { label: 'Total rooms', value: stats.total, color: NEUTRAL.text },
                  { label: 'Cleaned', value: stats.cleaned, color: STATUS.inspected.text },
                  { label: 'Pending', value: stats.pending, color: STATUS.dirty.text },
                  { label: 'Extra time', value: `+${stats.extraTime}m`, color: BRAND.navy },
                ].map(s => (
                  <View key={s.label} style={styles.stat}>
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Cleaner section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Cleaner activity</Text>
              <Text style={styles.sectionSubtitle}>
                {visibleCleaners.length} {visibleCleaners.length === 1 ? 'housekeeper' : 'housekeepers'} · Select one to see their rooms
              </Text>
            </View>

            {/* Search empty */}
            {visibleCleaners.length === 0 && (
              <View style={styles.searchEmpty}>
                <Text style={styles.searchEmptyTitle}>No rooms found</Text>
                <Text style={styles.searchEmptyText}>Try another room or cleaner name.</Text>
              </View>
            )}

            {/* Cleaner cards */}
            <View style={styles.cleanerList}>
              {visibleCleaners.map(cleaner => {
                const expanded = expandedCleaners.has(cleaner.id);
                return (
                  <View key={cleaner.id} style={styles.cleanerCard}>
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
                        <View style={styles.cleanerProgressTrack}>
                          <View
                            style={[
                              styles.cleanerProgressFill,
                              {
                                width: `${Math.min(cleaner.percentage, 100)}%`,
                                backgroundColor: cleaner.percentage === 100 ? ACCENT.complete : BRAND.yellow,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.cleanerPercentage, cleaner.percentage === 100 && styles.completedPercentage]}>
                          {cleaner.percentage}%
                        </Text>
                        <Icon
                          name={expanded ? 'expand_less' : 'expand_more'}
                          size={17}
                          color={NEUTRAL.text3}
                        />
                      </View>
                    </TouchableOpacity>

                    {expanded && (
                      <View style={styles.roomsContainer}>
                        {cleaner.rooms.map((room, index) => (
                          <View key={room.roomId || `${room.roomName}-${index}`} style={styles.roomRow}>
                            <View style={[styles.roomStatus, {
                              backgroundColor: room.cleaned ? STATUS.inspected.bg : STATUS.dirty.bg,
                            }]}>
                              <Icon
                                name={room.cleaned ? 'check' : 'schedule'}
                                size={16}
                                color={room.cleaned ? STATUS.inspected.text : STATUS.dirty.text}
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
                            <View style={[styles.roomPill, {
                              backgroundColor: room.cleaned ? STATUS.inspected.bg : STATUS.dirty.bg,
                              borderColor: room.cleaned ? STATUS.inspected.border : STATUS.dirty.border,
                            }]}>
                              <Text style={[styles.roomPillText, {
                                color: room.cleaned ? STATUS.inspected.text : STATUS.dirty.text,
                              }]}>
                                {room.cleaned ? 'Cleaned' : 'Pending'}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
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
  page: { flex: 1, backgroundColor: NEUTRAL.appBg },
  scroll: { flex: 1 },
  content: {
    width: '100%', maxWidth: 1280, alignSelf: 'flex-start',
    paddingTop: 22, paddingHorizontal: 28, paddingBottom: 40, gap: 18,
  },

  controls: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap',
    padding: 18, borderRadius: 20,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  dateArea: { flexGrow: 1, flexBasis: 320, minWidth: 0 },
  searchContainer: { flexGrow: 0, flexShrink: 1, flexBasis: 330, minWidth: 0 },
  controlLabel: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 10,
    letterSpacing: 1, textTransform: 'uppercase',
    color: NEUTRAL.text4, marginBottom: 9,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  arrowButton: {
    width: 40, height: 40, flexShrink: 0, borderRadius: 11,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
    alignItems: 'center', justifyContent: 'center',
  },
  dateDisplay: {
    flex: 1, minWidth: 0, height: 40, flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 13, borderRadius: 11,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
  },
  dateInput: {
    flex: 1, minWidth: 0, border: 'none', outline: 'none', padding: 0,
    backgroundColor: 'transparent',
    fontFamily: FONTS.medium, fontWeight: 500, fontSize: 13.5, color: NEUTRAL.text,
  },
  todayButton: {
    height: 40, paddingHorizontal: 15, borderRadius: 11, flexShrink: 0,
    backgroundColor: NEUTRAL.slateChip,
    alignItems: 'center', justifyContent: 'center',
  },
  todayButtonText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12.5, color: BRAND.navy,
  },
  searchBox: {
    height: 40, flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 12, borderRadius: 11,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
  },
  searchInput: {
    flex: 1, minWidth: 0, padding: 0, outlineStyle: 'none',
    fontFamily: FONTS.regular, fontSize: 13.5, color: NEUTRAL.text,
  },

  progressCard: {
    padding: 22, borderRadius: 20,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  progressHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, flexWrap: 'wrap', marginBottom: 18,
  },
  cardEyebrow: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 10,
    letterSpacing: 1, textTransform: 'uppercase',
    color: NEUTRAL.text4, marginBottom: 6,
  },
  progressNumberRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 11, flexWrap: 'wrap',
  },
  progressNumber: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 30, lineHeight: 30,
    color: NEUTRAL.text, fontVariant: ['tabular-nums'],
  },
  progressDescription: { fontFamily: FONTS.regular, fontSize: 13.5, color: NEUTRAL.text3 },
  progressStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 34, paddingHorizontal: 13, borderRadius: 999,
  },
  progressStatusText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12 },

  bigProgressTrack: {
    height: 9, borderRadius: 6, backgroundColor: NEUTRAL.slateChip, overflow: 'hidden',
  },
  bigProgressFill: { height: '100%', borderRadius: 6 },

  statGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 14,
    marginTop: 22, paddingTop: 17,
    borderTopWidth: 1, borderTopColor: NEUTRAL.border,
  },
  stat: { flexGrow: 1, flexBasis: 120, alignItems: 'center' },
  statValue: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { marginTop: 4, fontFamily: FONTS.regular, fontSize: 11.5, color: NEUTRAL.text4 },

  sectionHeader: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 20, color: NEUTRAL.text,
  },
  sectionSubtitle: {
    marginTop: 4, fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text3,
  },

  cleanerList: { gap: 10 },
  cleanerCard: {
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cleanerHeader: {
    minHeight: 82, flexDirection: 'row', alignItems: 'center',
    gap: 16, flexWrap: 'wrap', paddingVertical: 14, paddingHorizontal: 18,
  },
  cleanerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexGrow: 1, flexBasis: 180, minWidth: 0 },
  avatar: {
    width: 44, height: 44, borderRadius: 999, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 15, color: '#FFFFFF',
  },
  cleanerDetails: { flex: 1, minWidth: 0 },
  cleanerName: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 15.5, color: NEUTRAL.text,
  },
  cleanerRooms: {
    marginTop: 4, fontFamily: FONTS.regular, fontSize: 12.5,
    color: NEUTRAL.text4, fontVariant: ['tabular-nums'],
  },
  cleanerRight: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    flexGrow: 0, flexShrink: 1, flexBasis: 260, minWidth: 150,
  },
  cleanerProgressTrack: {
    flex: 1, minWidth: 0, height: 7, borderRadius: 5,
    backgroundColor: NEUTRAL.slateChip, overflow: 'hidden',
  },
  cleanerProgressFill: { height: '100%', borderRadius: 5 },
  cleanerPercentage: {
    width: 40, flexShrink: 0, textAlign: 'right',
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13,
    color: BRAND.navy, fontVariant: ['tabular-nums'],
  },
  completedPercentage: { color: STATUS.inspected.text },

  roomsContainer: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1, borderTopColor: NEUTRAL.border,
    paddingHorizontal: 18,
  },
  roomRow: {
    minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#EEF2F7',
  },
  roomStatus: {
    width: 29, height: 29, flexShrink: 0, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  roomMain: { flex: 1, minWidth: 0 },
  roomName: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13.5, color: NEUTRAL.text,
  },
  roomExtras: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 3 },
  roomNote: { maxWidth: 400, fontFamily: FONTS.regular, fontSize: 11.5, color: NEUTRAL.text4 },
  extraTime: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 11.5, color: STATUS.dirty.text,
  },
  roomPill: {
    height: 26, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  roomPillText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12 },

  /* Empty states – dashed border */
  noHistory: {
    alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60,
    borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1',
  },
  searchEmpty: {
    alignItems: 'center', gap: 10, paddingVertical: 60,
    borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1',
  },
  emptyTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 17, color: NEUTRAL.text,
  },
  emptyText: {
    maxWidth: 420, textAlign: 'center',
    fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 19, color: NEUTRAL.text3,
  },
  searchEmptyTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 17, color: NEUTRAL.text,
  },
  searchEmptyText: { fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text3 },

  loadingBox: {
    alignItems: 'center', padding: 35, borderRadius: 20,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  loadingText: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3 },
});