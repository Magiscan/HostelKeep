// src/screens/manager/MaintenanceBoardScreen.js
//
// Manager → Maintenance tab on the phone (ManagerApp). The desktop board is
// MaintenanceBoardScreen.desktop.js.
//
//   To review  housekeepers' reports waiting for triage
//   Open       to do, in progress and waiting — plus finished tasks, greyed,
//              until this manager removes them (✕)
//   Closed     every done and dismissed task

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from '../../components/Icon';
import { useApp } from '../../contexts/AppContext';
import { buildCleanerColors } from '../../utils/cleanerColor';
import { useMaintenance, isFinished, isClearedFor } from '../../hooks/useMaintenance';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { COLORS } from '../../theme/colors';
import { TaskCard, PhotoCleanupBanner } from '../../components/maintenance/MaintenanceParts';
import TaskDetailSheet from '../../components/maintenance/TaskDetailSheet';
import TaskFormSheet from '../../components/maintenance/TaskFormSheet';
import MaintenanceUpsell from '../../components/maintenance/MaintenanceUpsell';

const TABS = [
  { key: 'review', statuses: ['reported'], fallback: 'To review' },
  { key: 'open',   statuses: ['open', 'in_progress', 'on_hold', 'done', 'dismissed'], current: true, fallback: 'Open' },
  { key: 'closed', statuses: ['done', 'dismissed'], fallback: 'Closed' },
];

export default function MaintenanceBoardScreen({ bottomPad = 0 }) {
  const { t } = useTranslation();
  const { rooms, cleaners } = useApp();
  const m = useMaintenance();
  const colors = useMemo(() => buildCleanerColors(cleaners), [cleaners]);

  const [tab, setTab] = useState(m.counts.reported > 0 ? 'review' : 'open');
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null); // { task } | null

  const byTab = useMemo(() => {
    const out = {};
    TABS.forEach((tb) => {
      out[tb.key] = m.tasks.filter(x => tb.statuses.includes(x.status)
        && !(tb.current && isFinished(x) && isClearedFor(x, m.uid)));
    });
    const newest = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);
    out.open = [...out.open.filter(x => !isFinished(x)), ...out.open.filter(isFinished).sort(newest)];
    out.closed = [...out.closed].sort(newest);
    return out;
  }, [m.tasks, m.uid]);

  const badgeOf = (key) => (key === 'open'
    ? byTab.open.filter(x => !isFinished(x)).length
    : byTab[key].length);

  const list = byTab[tab] || [];

  if (m.billingLoaded && !m.enabled) return <MaintenanceUpsell />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('maint.boardTitle', 'Maintenance')}</Text>
            <Text style={styles.sub}>
              {m.counts.overdue > 0
                ? t('maint.overdueCount', '{{count}} overdue', { count: m.counts.overdue })
                : t('maint.boardSub', 'Reports, repairs and who is on them')}
            </Text>
          </View>
          {m.canManage && (
            <TouchableOpacity onPress={() => setForm({ task: null })} style={styles.newBtn} activeOpacity={0.9}>
              <Icon name="add" size={20} color={BRAND.yellow} />
              <Text style={styles.newBtnText}>{t('maint.newShort', 'New')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {m.canManage && <PhotoCleanupBanner tasks={m.tasks} onShow={() => setTab('closed')} />}

        <View style={styles.tabs}>
          {TABS.map(tb => {
            const on = tab === tb.key;
            const n = badgeOf(tb.key);
            return (
              <TouchableOpacity key={tb.key} onPress={() => setTab(tb.key)} style={[styles.tab, on && styles.tabOn]} activeOpacity={0.8}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t(`maint.boardTab.${tb.key}`, tb.fallback)}</Text>
                {n > 0 && (
                  <View style={[styles.badge, tb.key === 'review' && { backgroundColor: COLORS.accent }]}>
                    <Text style={styles.badgeText}>{n}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {list.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="build" size={32} color={NEUTRAL.text4} />
            <Text style={styles.emptyTitle}>
              {tab === 'review'
                ? t('maint.emptyReview', 'No reports waiting')
                : tab === 'open' ? t('maint.emptyOpen', 'No open tasks') : t('maint.emptyClosed', 'Nothing closed yet')}
            </Text>
            {tab === 'review' && (
              <Text style={styles.emptySub}>
                {t('maint.emptyReviewHint', 'When a housekeeper reports a problem, it lands here.')}
              </Text>
            )}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {list.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                rooms={rooms}
                colors={colors}
                nameOf={m.nameOf}
                showAssignees
                onPress={() => setOpenId(task.id)}
                onRemove={tab === 'open'
                  ? (x) => m.clearForMe(x).catch(e => Alert.alert(t('error', 'Error'), e.message))
                  : undefined}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <TaskDetailSheet
        taskId={form ? null : openId}
        onClose={() => setOpenId(null)}
        onEdit={m.canManage ? (task) => setForm({ task }) : undefined}
      />
      {form && (
        <TaskFormSheet
          key={form.task?.id || 'new'}
          task={form.task}
          onClose={() => setForm(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: FONTS.display, fontSize: 26, color: BRAND.navy },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text2, marginTop: 2 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: BRAND.navy,
  },
  newBtnText: { fontFamily: FONTS.semiBold, fontSize: 15, color: '#FFFFFF' },
  tabs: { flexDirection: 'row', backgroundColor: NEUTRAL.slateChip, borderRadius: 14, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 11 },
  tabOn: { backgroundColor: NEUTRAL.surface },
  tabText: { fontFamily: FONTS.medium, fontSize: 14, color: NEUTRAL.text3 },
  tabTextOn: { color: BRAND.navy, fontFamily: FONTS.semiBold },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: NEUTRAL.border, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FONTS.semiBold, fontSize: 11.5, color: BRAND.navy },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: FONTS.semiBold, fontSize: 16, color: NEUTRAL.text2, textAlign: 'center' },
  emptySub: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3, textAlign: 'center' },
});