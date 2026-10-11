// src/screens/MaintenanceScreen.js
//
// Home screen for a maintenance worker: a `cleaner` account with
// team === 'maintenance'. App.js routes here instead of CleanerScreen.
//
// Built around DAYS, because a maintenance worker plans ahead:
//
//   Header      greeting + TODAY's progress: fixed today / today's workload
//   Day strip   Today · Tomorrow · next 5 days · Later — with open counts
//   Today       Overdue → Due today → Anytime (no due date) → Fixed
//   Other day   what's due that day (open first, then already fixed)
//   Later       due after the strip
//
// "Today's workload" = open tasks that are overdue, due today or have no
// date, plus everything fixed today. So fixing a task moves the bar, and
// the bar starts fresh every morning.
//
// Fixed tasks stay (greyed, with ✕) until the worker removes them; removing
// only hides them here — managers keep them under Done.
//
// The header is drawn here rather than reusing HousekeeperHeader: that one is
// built around rooms, and fed task numbers it stayed at 0.

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { useAvatarPicker } from '../hooks/useAvatarPicker';
import { useMaintenance, startOfDay, addDays } from '../hooks/useMaintenance';
import AccountScreen from './AccountScreen';
import { Fab, Confetti, ToastHost, useToast } from '../components/brand/Overlays';
import { ProfileMenu } from '../components/brand/Sheets';
import { AvatarPickerSheet, LanguageSheet } from '../components/brand/Pickers';
import { FONTS, DISPLAY } from '../theme/typography';
import { BRAND, NEUTRAL } from '../theme/tokens';
import { COLORS } from '../theme/colors';
import { TaskCard } from '../components/maintenance/MaintenanceParts';
import ReportIssueSheet from '../components/maintenance/ReportIssueSheet';
import { ask } from '../components/maintenance/maintenanceUi';
import TaskDetailSheet from '../components/maintenance/TaskDetailSheet';
import MaintenanceUpsell from '../components/maintenance/MaintenanceUpsell';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

const STRIP_DAYS = 7;   // today + 6

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'goodMorning';
  if (h < 18) return 'goodAfternoon';
  return 'goodEvening';
}

const OPEN = ['open', 'in_progress', 'on_hold'];
const isOpen = (x) => OPEN.includes(x.status);
// In progress first, then waiting, then to do — inside each group the hook's
// order (overdue, priority, due date) is kept.
const workOrder = { in_progress: 0, on_hold: 1, open: 2 };
const byWork = (a, b) => (workOrder[a.status] ?? 3) - (workOrder[b.status] ?? 3);

export default function MaintenanceScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateProfile } = useAuth();
  const { hostel, rooms } = useApp();
  const m = useMaintenance();
  usePushRegistration(user);

  const toast = useToast();
  const avatar = useAvatarPicker();

  const [day, setDay] = useState('today');      // 'today' | 'd1'…'d6' | 'later'
  const [openId, setOpenId] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLang, setShowLang] = useState(false);

  // Day boundaries roll over at midnight without a reload.
  const [today0, setToday0] = useState(() => startOfDay());
  useEffect(() => {
    const id = setInterval(() => {
      const s = startOfDay();
      setToday0(prev => (prev === s ? prev : s));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Tapping a push opens the task it's about.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      if (data.taskId) { setDay('today'); setOpenId(data.taskId); }
    });
    return () => sub.remove();
  }, []);

  /* ── Bucket my tasks by day ── */
  const plan = useMemo(() => {
    const tomorrow0 = addDays(today0, 1);
    const stripEnd = addDays(today0, STRIP_DAYS);
    const mine = m.myTasks;                      // already excludes removed ones

    const open = mine.filter(isOpen);
    const fixed = mine.filter(x => x.status === 'done')
      .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

    const today = {
      overdue: open.filter(x => x.dueAt && x.dueAt < today0).sort(byWork),
      due: open.filter(x => x.dueAt && x.dueAt >= today0 && x.dueAt < tomorrow0).sort(byWork),
      anytime: open.filter(x => !x.dueAt).sort(byWork),
      fixed,
    };
    // From ALL tasks, not just the visible list: removing a fixed task from
    // the list must not take it off today's progress.
    const fixedToday = m.tasks.filter(x => x.status === 'done'
      && (x.assignees || []).includes(m.uid)
      && (x.doneAt || 0) >= today0).length;
    const todayOpen = today.overdue.length + today.due.length + today.anytime.length;

    const days = [];
    for (let i = 1; i < STRIP_DAYS; i += 1) {
      const from = addDays(today0, i);
      const to = addDays(today0, i + 1);
      const inDay = (x) => x.dueAt && x.dueAt >= from && x.dueAt < to;
      days.push({
        key: `d${i}`,
        from,
        open: open.filter(inDay).sort(byWork),
        fixed: fixed.filter(inDay),
      });
    }
    const later = {
      open: open.filter(x => x.dueAt && x.dueAt >= stripEnd)
        .sort((a, b) => a.dueAt - b.dueAt),
    };

    return {
      today, days, later,
      progress: { done: fixedToday, total: todayOpen + fixedToday },
      todayOpen,
    };
  }, [m.myTasks, m.tasks, m.uid, today0]);

  const myOpenReports = m.myReports.filter(r => r.status === 'reported');

  const remove = (task) => m.clearForMe(task).catch(e => Alert.alert(t('error', 'Error'), e.message));
  const removeAllFixed = async () => {
    const ok = await ask({
      title: t('maint.clearFixedTitle', 'Remove all fixed tasks?'),
      message: t('maint.clearFixedBody', 'They disappear from your list. Your manager still has them.'),
      confirmLabel: t('maint.remove', 'Remove'),
      cancelLabel: t('cancel', 'Cancel'),
    });
    if (ok) remove(plan.today.fixed);
  };

  const pickProfilePhoto = () => avatar.open({
    canRemove: !!user.photoUri,
    onPicked: (uri) => updateProfile({ photoUri: uri }),
    onRemove: () => updateProfile({ photoUri: null }),
  });

  if (showAccount) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.accountBar}>
          <TouchableOpacity onPress={() => setShowAccount(false)} style={styles.iconBtn} hitSlop={8}>
            <Icon name="arrow_back" size={24} color={BRAND.navy} />
          </TouchableOpacity>
          <Text style={styles.accountTitle}>{t('account', 'Account')}</Text>
        </View>
        <AccountScreen />
      </SafeAreaView>
    );
  }

  /* ── Pieces ── */

  const weekday = (ms, style = 'short') => new Date(ms).toLocaleDateString(i18n.language, { weekday: style });
  const dateNum = (ms) => new Date(ms).getDate();

  const chips = [
    { key: 'today', top: t('maint.today', 'Today'), bottom: String(dateNum(today0)), count: plan.todayOpen, alert: plan.today.overdue.length > 0 },
    ...plan.days.map((d, i) => ({
      key: d.key,
      top: i === 0 ? t('maint.tomorrow', 'Tomorrow') : weekday(d.from),
      bottom: String(dateNum(d.from)),
      count: d.open.length,
    })),
    { key: 'later', top: t('maint.later', 'Later'), bottom: '…', count: plan.later.open.length },
  ];

  const group = (title, list, opts = {}) => list.length > 0 && (
    <View style={styles.group} key={title}>
      <View style={styles.groupHead}>
        <Text style={[styles.groupTitle, opts.danger && { color: COLORS.danger }]}>
          {title} <Text style={styles.groupCount}>· {list.length}</Text>
        </Text>
        {opts.extra}
      </View>
      {list.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          rooms={rooms}
          onPress={() => setOpenId(task.id)}
          onRemove={remove}
        />
      ))}
    </View>
  );

  const renderToday = () => {
    const { overdue, due, anytime, fixed } = plan.today;
    const nothingOpen = overdue.length + due.length + anytime.length === 0;
    return (
      <>
        {group(t('maint.overdue', 'Overdue'), overdue, { danger: true })}
        {group(t('maint.dueTodaySection', 'Due today'), due)}
        {group(t('maint.anytime', 'Anytime'), anytime)}
        {nothingOpen && (
          <View style={styles.doneBox}>
            <Text style={styles.doneTitle}>
              {plan.progress.done > 0 ? t('maint.allFixed', 'All fixed!') : t('maint.nothingToday', 'Nothing for today')}
            </Text>
            <Text style={styles.doneSub}>
              {plan.days.some(d => d.open.length) || plan.later.open.length
                ? t('maint.checkNextDays', 'Check the next days above for what is coming up.')
                : t('maint.workerEmptyHint', "You'll get a notification when a manager assigns you a task.")}
            </Text>
          </View>
        )}
        {group(t('maint.fixedSection', 'Fixed'), fixed, {
          extra: fixed.length > 1 && (
            <TouchableOpacity onPress={removeAllFixed} activeOpacity={0.7} hitSlop={8}>
              <Text style={styles.link}>{t('maint.clearFixed', 'Remove all')}</Text>
            </TouchableOpacity>
          ),
        })}
      </>
    );
  };

  const renderDay = (d) => (
    <>
      <Text style={styles.dayHeading}>
        {new Date(d.from).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      {d.open.length + d.fixed.length === 0 ? (
        <View style={styles.emptyBox}>
          <Icon name="event_available" size={32} color={NEUTRAL.text4} />
          <Text style={styles.emptyTitle}>{t('maint.nothingThatDay', 'Nothing planned for this day')}</Text>
        </View>
      ) : (
        <>
          {group(t('maint.toDoSection', 'To do'), d.open)}
          {group(t('maint.fixedSection', 'Fixed'), d.fixed)}
        </>
      )}
    </>
  );

  const renderLater = () => (plan.later.open.length === 0 ? (
    <View style={styles.emptyBox}>
      <Icon name="event_available" size={32} color={NEUTRAL.text4} />
      <Text style={styles.emptyTitle}>{t('maint.nothingLater', 'Nothing planned further ahead')}</Text>
    </View>
  ) : group(t('maint.later', 'Later'), plan.later.open));

  const { done, total } = plan.progress;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const initials = (user.username || '?').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header + today's progress ── */}
      <View style={styles.header}>
        <View style={styles.headRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {!!hostel?.name && <Text style={styles.hostel} numberOfLines={1}>{hostel.name}</Text>}
            <Text style={styles.greeting} numberOfLines={1}>
              {`${t(greetingKey(), { defaultValue: t('hi') })}, ${user.username}`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowProfile(true)} activeOpacity={0.8} style={styles.avatar}
            accessibilityLabel={t('account', 'Account')}>
            {user.photoUri
              ? <Image source={{ uri: user.photoUri }} style={styles.avatarImg} />
              : <Text style={styles.avatarText}>{initials}</Text>}
          </TouchableOpacity>
        </View>

        {m.enabled && (
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>
                {total
                  ? t('maint.progressToday', '{{done}} of {{total}} fixed today', { done, total })
                  : t('maint.nothingToday', 'Nothing for today')}
              </Text>
              {total > 0 && <Text style={styles.progressPct}>{pct}%</Text>}
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }, pct === 100 && { backgroundColor: COLORS.success }]} />
            </View>
            {plan.today.overdue.length > 0 && (
              <Text style={styles.overdueNote}>
                {t('maint.overdueCount', '{{count}} overdue', { count: plan.today.overdue.length })}
              </Text>
            )}
          </View>
        )}
      </View>

      {m.billingLoaded && !m.enabled ? (
        <MaintenanceUpsell variant="locked" />
      ) : (
        <>
          {/* ── Day strip ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stripScroll}
            contentContainerStyle={styles.strip}
          >
            {chips.map(c => {
              const on = day === c.key;
              return (
                <TouchableOpacity key={c.key} onPress={() => setDay(c.key)} activeOpacity={0.85}
                  style={[styles.dayChip, on && styles.dayChipOn]}>
                  <Text style={[styles.dayTop, on && styles.dayTextOn]} numberOfLines={1}>{c.top}</Text>
                  <Text style={[styles.dayNum, on && styles.dayTextOn]}>{c.bottom}</Text>
                  <View style={[
                    styles.dayDot,
                    !c.count && { opacity: 0 },
                    c.alert && { backgroundColor: COLORS.danger },
                    on && !c.alert && { backgroundColor: BRAND.yellow },
                  ]}>
                    <Text style={[styles.dayDotText, (c.alert || on) && { color: c.alert ? '#FFFFFF' : BRAND.navy }]}>
                      {c.count || 0}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {!m.loaded ? (
              <Text style={styles.loading}>{t('loading', 'Loading…')}</Text>
            ) : day === 'today' ? renderToday()
              : day === 'later' ? renderLater()
                : renderDay(plan.days.find(d => d.key === day) || plan.days[0])}

            {day === 'today' && myOpenReports.length > 0 && (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>{t('maint.yourReports', 'Your reports')}</Text>
                {myOpenReports.map(task => (
                  <TaskCard key={task.id} task={task} rooms={rooms} onPress={() => setOpenId(task.id)} />
                ))}
              </View>
            )}
          </ScrollView>

          <Fab label={t('maint.reportShort', 'Report')} onPress={() => setReporting(true)} />
          <Confetti fire={total > 0 && done === total} />
        </>
      )}

      <ReportIssueSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        rooms={rooms}
        onSubmit={m.reportIssue}
        onSent={() => toast.show(t('maint.reportSent', 'Sent. Your manager has been notified.'))}
      />
      <TaskDetailSheet taskId={openId} onClose={() => setOpenId(null)} />
      <ToastHost toast={toast} />

      <AvatarPickerSheet
        controller={avatar}
        title={t('profilePhoto') || 'Photo'}
        labels={{
          camera: t('takePhoto') || 'Take a photo',
          gallery: t('chooseFromGallery') || 'Choose from gallery',
          remove: t('removePhoto') || 'Remove photo',
          close: t('close'),
        }}
      />
      <LanguageSheet
        visible={showLang}
        onClose={() => setShowLang(false)}
        languages={LANGS}
        current={i18n.language}
        onSelect={(code) => i18n.changeLanguage(code)}
        title={t('manager.language')}
      />
      <ProfileMenu
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        name={user.username}
        hostelName={hostel?.name}
        photoUri={user.photoUri}
        onChangePhoto={pickProfilePhoto}
        langLabel={(LANGS.find(l => l.code === i18n.language) || LANGS[0]).label}
        onLanguage={() => { setShowProfile(false); setShowLang(true); }}
        onAccount={() => { setShowProfile(false); setShowAccount(true); }}
        onSignOut={() => { setShowProfile(false); logout(); }}
        labels={{ language: t('manager.language'), account: t('account'), signOut: t('signOut') }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F3F8' },
  accountBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  accountTitle: { fontFamily: DISPLAY.semiBold, fontSize: 20, color: BRAND.navy },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  /* Header */
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, gap: 14, backgroundColor: NEUTRAL.headerBg },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hostel: { fontFamily: FONTS.medium, fontSize: 13.5, color: NEUTRAL.textOnLight },
  greeting: { fontFamily: DISPLAY.semiBold, fontSize: 26, lineHeight: 30, color: BRAND.navy, marginTop: 2 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: BRAND.navy, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 46, height: 46 },
  avatarText: { fontFamily: DISPLAY.semiBold, fontSize: 20, color: BRAND.yellow },

  progressCard: {
    padding: 14, borderRadius: 18, gap: 8,
    backgroundColor: NEUTRAL.glassCard, borderWidth: 1, borderColor: NEUTRAL.glassBorder,
  },
  progressRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  progressLabel: { flex: 1, fontFamily: FONTS.semiBold, fontSize: 15, color: BRAND.navy },
  progressPct: { fontFamily: DISPLAY.semiBold, fontSize: 22, color: BRAND.navy },
  track: { height: 10, borderRadius: 5, backgroundColor: NEUTRAL.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: BRAND.yellow },
  overdueNote: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.danger },

  /* Day strip */
  stripScroll: { flexGrow: 0, backgroundColor: NEUTRAL.headerBg },
  strip: { paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  dayChip: {
    width: 68, paddingVertical: 8, borderRadius: 16, alignItems: 'center', gap: 2,
    backgroundColor: NEUTRAL.surface, borderWidth: 1, borderColor: NEUTRAL.border,
  },
  dayChipOn: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  dayTop: { fontFamily: FONTS.medium, fontSize: 12, color: NEUTRAL.text3, textTransform: 'capitalize' },
  dayNum: { fontFamily: DISPLAY.semiBold, fontSize: 22, color: BRAND.navy },
  dayTextOn: { color: '#FFFFFF' },
  dayDot: {
    minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10,
    backgroundColor: NEUTRAL.slateChip, alignItems: 'center', justifyContent: 'center',
  },
  dayDotText: { fontFamily: FONTS.semiBold, fontSize: 11.5, color: NEUTRAL.text2 },

  /* List */
  scroll: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 120, gap: 22 },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontFamily: DISPLAY.semiBold, fontSize: 22, lineHeight: 26, color: BRAND.navy },
  groupCount: { fontFamily: FONTS.medium, fontSize: 15, color: NEUTRAL.text3 },
  dayHeading: { fontFamily: FONTS.semiBold, fontSize: 15, color: NEUTRAL.text2, textTransform: 'capitalize' },
  link: { fontFamily: FONTS.semiBold, fontSize: 14.5, color: BRAND.navy },
  loading: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3, textAlign: 'center', padding: 24 },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: FONTS.semiBold, fontSize: 16, color: NEUTRAL.text2, textAlign: 'center' },
  doneBox: {
    alignItems: 'center', gap: 4, paddingVertical: 22, paddingHorizontal: 18,
    borderRadius: 22, backgroundColor: COLORS.successLight,
  },
  doneTitle: { fontFamily: DISPLAY.semiBold, fontSize: 22, color: COLORS.successDark },
  doneSub: { fontFamily: FONTS.regular, fontSize: 14.5, color: COLORS.successDark, textAlign: 'center' },
});