// src/screens/MaintenanceScreen.js
//
// Home screen for a maintenance worker: a `cleaner` account with
// team === 'maintenance'. App.js routes here instead of CleanerScreen.
//
// One day at a time, like a planner:
//
//   Header     greeting + avatar
//   Day bar    ‹  Tuesday 13 October  ›    — any day, back or forward
//              "Back to today" when you've moved away
//   Week strip seven days around the one you're on, with open counts;
//              tap to jump, ‹ › to page further
//   Progress   fixed / (to do + fixed) FOR THE DAY SHOWN
//   List       today:  Overdue → Due today → Anytime → Fixed today
//              future: Due that day → Fixed that day
//              past:   Fixed that day
//   Fixed      at the bottom: everything fixed and not yet removed (✕)
//
// All the date maths lives in utils/maintenanceSchedule.js (pure, tested).

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
import { useMaintenance } from '../hooks/useMaintenance';
import { planDay, startOfDay, addDays } from '../utils/maintenanceSchedule';
import AccountScreen from './AccountScreen';
import { Fab, Confetti, ToastHost, useToast } from '../components/brand/Overlays';
import { ProfileMenu } from '../components/brand/Sheets';
import { AvatarPickerSheet, LanguageSheet } from '../components/brand/Pickers';
import { FONTS, DISPLAY } from '../theme/typography';
import { BRAND, NEUTRAL } from '../theme/tokens';
import { COLORS } from '../theme/colors';
import { TaskCard } from '../components/maintenance/MaintenanceParts';
import ReportIssueSheet from '../components/maintenance/ReportIssueSheet';
import TaskDetailSheet from '../components/maintenance/TaskDetailSheet';
import MaintenanceUpsell from '../components/maintenance/MaintenanceUpsell';
import { ask } from '../components/maintenance/maintenanceUi';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'goodMorning';
  if (h < 18) return 'goodAfternoon';
  return 'goodEvening';
}

export default function MaintenanceScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, updateProfile } = useAuth();
  const { hostel, rooms } = useApp();
  const m = useMaintenance();
  usePushRegistration(user);

  const toast = useToast();
  const avatar = useAvatarPicker();

  const [offset, setOffset] = useState(0);        // 0 = today
  const [openId, setOpenId] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLang, setShowLang] = useState(false);

  // `now` ticks every minute so overdue flags and midnight roll over live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const today0 = startOfDay(now);

  // Tapping a push opens the task it's about, on today.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      if (data.taskId) { setOffset(0); setOpenId(data.taskId); }
    });
    return () => sub.remove();
  }, []);

  // Every task assigned to me (m.tasks — removing from the list never changes
  // what was fixed on a day).
  const day = useMemo(() => planDay(m.tasks, m.uid, offset, now), [m.tasks, m.uid, offset, now]);

  // Week strip: the 7 days of the week containing `offset`, Monday first.
  const weekStart = useMemo(() => {
    const d = new Date(addDays(today0, offset));
    const back = (d.getDay() + 6) % 7;            // Mon=0 … Sun=6
    return offset - back;
  }, [today0, offset]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const off = weekStart + i;
    const p = planDay(m.tasks, m.uid, off, now);
    return { off, ms: p.from, open: p.openCount, alert: off === 0 && p.overdue.length > 0 };
  }), [weekStart, m.tasks, m.uid, now]);

  // Fixed and still on my list (any day), shown at the bottom until removed.
  // (Ones already listed under the day's "Fixed" group above aren't repeated.)
  const fixedOnList = useMemo(() => {
    const shown = new Set(day.fixed.map(x => x.id));
    return m.myTasks
      .filter(x => x.status === 'done' && !shown.has(x.id))
      .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  }, [m.myTasks, day.fixed]);
  const myOpenReports = m.myReports.filter(r => r.status === 'reported');

  const remove = (task) => m.clearForMe(task).catch(e => Alert.alert(t('error', 'Error'), e.message));
  const removeAllFixed = async () => {
    const ok = await ask({
      title: t('maint.clearFixedTitle', 'Remove all fixed tasks?'),
      message: t('maint.clearFixedBody', 'They disappear from your list. Your manager still has them.'),
      confirmLabel: t('maint.remove', 'Remove'),
      cancelLabel: t('cancel', 'Cancel'),
    });
    if (ok) remove([...fixedOnList, ...day.fixed]);
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

  /* ── Labels ── */
  const lang = i18n.language;
  const dayTitle = offset === 0 ? t('maint.today', 'Today')
    : offset === 1 ? t('maint.tomorrow', 'Tomorrow')
      : offset === -1 ? t('maint.yesterday', 'Yesterday')
        : new Date(day.from).toLocaleDateString(lang, { weekday: 'long' });
  const dayDate = new Date(day.from).toLocaleDateString(lang, { day: 'numeric', month: 'long' });

  const { done, total, pct } = day.progress;
  const progressText = total === 0
    ? (day.isPast ? t('maint.nothingFixedThatDay', 'Nothing fixed this day') : t('maint.nothingPlanned', 'Nothing planned'))
    : day.isToday
      ? t('maint.progressToday', '{{done}} of {{total}} fixed today', { done, total })
      : t('maint.progressDay', '{{done}} of {{total}} fixed', { done, total });

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
          onRemove={opts.removable ? remove : undefined}
        />
      ))}
    </View>
  );

  const initials = (user.username || '?').trim().charAt(0).toUpperCase();
  const locked = m.billingLoaded && !m.enabled;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
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

        {!locked && (
          <>
            {/* ── Day bar ── */}
            <View style={styles.dayBar}>
              <TouchableOpacity onPress={() => setOffset(o => o - 1)} style={styles.arrow} hitSlop={8}
                accessibilityLabel={t('maint.prevDay', 'Previous day')}>
                <Icon name="chevron_left" size={28} color={BRAND.navy} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.dayTitle} numberOfLines={1}>{dayTitle}</Text>
                <Text style={styles.dayDate}>{dayDate}</Text>
              </View>
              <TouchableOpacity onPress={() => setOffset(o => o + 1)} style={styles.arrow} hitSlop={8}
                accessibilityLabel={t('maint.nextDay', 'Next day')}>
                <Icon name="chevron_right" size={28} color={BRAND.navy} />
              </TouchableOpacity>
            </View>

            {/* ── Week strip ── */}
            <View style={styles.week}>
              {week.map(w => {
                const on = w.off === offset;
                const isToday = w.off === 0;
                return (
                  <TouchableOpacity key={w.off} onPress={() => setOffset(w.off)} activeOpacity={0.85}
                    style={[styles.wDay, isToday && styles.wToday, on && styles.wOn]}>
                    <Text style={[styles.wName, on && styles.wTextOn]} numberOfLines={1}>
                      {new Date(w.ms).toLocaleDateString(lang, { weekday: 'narrow' })}
                    </Text>
                    <Text style={[styles.wNum, on && styles.wTextOn]}>{new Date(w.ms).getDate()}</Text>
                    <View style={[styles.wDot,
                      !w.open && { opacity: 0 },
                      w.alert && { backgroundColor: COLORS.danger },
                      on && !w.alert && { backgroundColor: BRAND.yellow }]}>
                      <Text style={[styles.wDotText, (on || w.alert) && { color: w.alert ? '#FFFFFF' : BRAND.navy }]}>
                        {w.open || 0}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {offset !== 0 && (
              <TouchableOpacity onPress={() => setOffset(0)} style={styles.backToday} activeOpacity={0.8}>
                <Icon name="today" size={16} color={BRAND.navy} />
                <Text style={styles.backTodayText}>{t('maint.backToToday', 'Back to today')}</Text>
              </TouchableOpacity>
            )}

            {/* ── Progress for the day shown ── */}
            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>{progressText}</Text>
                {total > 0 && <Text style={styles.progressPct}>{pct}%</Text>}
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%` }, pct === 100 && { backgroundColor: COLORS.success }]} />
              </View>
              {day.isToday && day.overdue.length > 0 && (
                <Text style={styles.overdueNote}>
                  {t('maint.overdueCount', '{{count}} overdue', { count: day.overdue.length })}
                </Text>
              )}
            </View>
          </>
        )}
      </View>

      {locked ? (
        <MaintenanceUpsell variant="locked" />
      ) : (
        <>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {!m.loaded ? (
              <Text style={styles.loading}>{t('loading', 'Loading…')}</Text>
            ) : (
              <>
                {group(t('maint.overdue', 'Overdue'), day.overdue, { danger: true })}
                {group(day.isToday ? t('maint.dueTodaySection', 'Due today') : t('maint.toDoSection', 'To do'), day.due)}
                {group(t('maint.anytime', 'Anytime'), day.anytime)}
                {group(day.isToday ? t('maint.fixedToday', 'Fixed today') : t('maint.fixedThatDay', 'Fixed this day'),
                  day.fixed.filter(x => !(x.clearedBy || []).includes(m.uid)), { removable: true })}

                {day.openCount + day.fixed.length === 0 && (
                  <View style={styles.emptyBox}>
                    <Icon name="event_available" size={32} color={NEUTRAL.text4} />
                    <Text style={styles.emptyTitle}>
                      {day.isPast ? t('maint.nothingFixedThatDay', 'Nothing fixed this day') : t('maint.nothingThatDay', 'Nothing planned for this day')}
                    </Text>
                    {day.isToday && (
                      <Text style={styles.emptySub}>{t('maint.useArrows', 'Use the arrows to see the next days.')}</Text>
                    )}
                  </View>
                )}

                {day.isToday && day.openCount === 0 && done > 0 && (
                  <View style={styles.doneBox}>
                    <Text style={styles.doneTitle}>{t('maint.allFixed', 'All fixed!')}</Text>
                    <Text style={styles.doneSub}>{t('maint.allFixedSub', 'Nothing left on your list.')}</Text>
                  </View>
                )}

                {/* Everything fixed and not removed yet — on every day, at the bottom */}
                {group(t('maint.fixedSection', 'Fixed'), fixedOnList, {
                  removable: true,
                  extra: fixedOnList.length > 1 && (
                    <TouchableOpacity onPress={removeAllFixed} activeOpacity={0.7} hitSlop={8}>
                      <Text style={styles.link}>{t('maint.clearFixed', 'Remove all')}</Text>
                    </TouchableOpacity>
                  ),
                })}

                {day.isToday && myOpenReports.length > 0 && (
                  <View style={styles.group}>
                    <Text style={styles.groupTitle}>{t('maint.yourReports', 'Your reports')}</Text>
                    {myOpenReports.map(task => (
                      <TaskCard key={task.id} task={task} rooms={rooms} onPress={() => setOpenId(task.id)} />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <Fab label={t('maint.reportShort', 'Report')} onPress={() => setReporting(true)} />
          <Confetti fire={day.isToday && total > 0 && done === total} />
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
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, gap: 12, backgroundColor: NEUTRAL.headerBg },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hostel: { fontFamily: FONTS.medium, fontSize: 13.5, color: NEUTRAL.textOnLight },
  greeting: { fontFamily: DISPLAY.semiBold, fontSize: 26, lineHeight: 30, color: BRAND.navy, marginTop: 2 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: BRAND.navy, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 46, height: 46 },
  avatarText: { fontFamily: DISPLAY.semiBold, fontSize: 20, color: BRAND.yellow },

  /* Day bar */
  dayBar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrow: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEUTRAL.surface, borderWidth: 1, borderColor: NEUTRAL.border,
  },
  dayTitle: { fontFamily: DISPLAY.semiBold, fontSize: 20, color: BRAND.navy, textTransform: 'capitalize' },
  dayDate: { fontFamily: FONTS.medium, fontSize: 13.5, color: NEUTRAL.text3 },

  /* Week strip */
  week: { flexDirection: 'row', gap: 6 },
  wDay: {
    flex: 1, paddingVertical: 7, borderRadius: 14, alignItems: 'center', gap: 2,
    backgroundColor: NEUTRAL.surface, borderWidth: 1, borderColor: NEUTRAL.border,
  },
  wToday: { borderColor: BRAND.yellow, borderWidth: 2 },
  wOn: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  wName: { fontFamily: FONTS.medium, fontSize: 11.5, color: NEUTRAL.text3, textTransform: 'uppercase' },
  wNum: { fontFamily: DISPLAY.semiBold, fontSize: 18, color: BRAND.navy },
  wTextOn: { color: '#FFFFFF' },
  wDot: {
    minWidth: 20, height: 18, paddingHorizontal: 5, borderRadius: 9,
    backgroundColor: NEUTRAL.slateChip, alignItems: 'center', justifyContent: 'center',
  },
  wDotText: { fontFamily: FONTS.semiBold, fontSize: 11, color: NEUTRAL.text2 },
  backToday: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: BRAND.yellowSoft,
  },
  backTodayText: { fontFamily: FONTS.semiBold, fontSize: 13.5, color: BRAND.navy },

  /* Progress */
  progressCard: {
    padding: 14, borderRadius: 18, gap: 8,
    backgroundColor: NEUTRAL.surface, borderWidth: 1, borderColor: NEUTRAL.glassBorder,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  progressLabel: { flex: 1, fontFamily: FONTS.semiBold, fontSize: 15, color: BRAND.navy },
  progressPct: { fontFamily: DISPLAY.semiBold, fontSize: 22, color: BRAND.navy },
  track: { height: 10, borderRadius: 5, backgroundColor: NEUTRAL.track, overflow: 'hidden', width: '100%' },
  fill: { height: 10, borderRadius: 5, backgroundColor: BRAND.yellow },
  overdueNote: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.danger },

  /* List */
  scroll: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 120, gap: 22 },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontFamily: DISPLAY.semiBold, fontSize: 22, lineHeight: 26, color: BRAND.navy },
  groupCount: { fontFamily: FONTS.medium, fontSize: 15, color: NEUTRAL.text3 },
  link: { fontFamily: FONTS.semiBold, fontSize: 14.5, color: BRAND.navy },
  loading: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3, textAlign: 'center', padding: 24 },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 30, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: FONTS.semiBold, fontSize: 16, color: NEUTRAL.text2, textAlign: 'center' },
  emptySub: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3, textAlign: 'center' },
  doneBox: {
    alignItems: 'center', gap: 4, paddingVertical: 22, paddingHorizontal: 18,
    borderRadius: 22, backgroundColor: COLORS.successLight,
  },
  doneTitle: { fontFamily: DISPLAY.semiBold, fontSize: 22, color: COLORS.successDark },
  doneSub: { fontFamily: FONTS.regular, fontSize: 14.5, color: COLORS.successDark, textAlign: 'center' },
});