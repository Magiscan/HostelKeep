// src/components/brand/WelcomeSheet.js
//
// The one-time tutorial for a new manager.
//
// NOT built on BottomSheet. A paged horizontal ScrollView nested inside that
// component's vertical one makes the two fight over the gesture — a diagonal
// swipe can scroll both, and on Android the outer one usually wins. This sheet
// has no keyboard and no long content, so it needs none of what BottomSheet
// does; it just needs to page cleanly. Visual language is the same: navy/gold,
// Fredoka display, 26 radius, rgba(11,31,58,0.55) scrim.
//
// Slides are data, not markup, so reordering them or adding one is a one-line
// change and every string goes through t() with an English fallback.
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, TouchableOpacity,
  StyleSheet, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../Icon';
import { COLORS } from '../../theme/colors';
import { FONTS, DISPLAY } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { SHADOW } from '../../theme/shadows';

/**
 * @param visible     show it
 * @param onDone      called on "Get started" AND on skip/backdrop — the caller
 *                    persists "seen" there. Deliberately one callback: a
 *                    tutorial someone skipped is a tutorial they've decided
 *                    about, and showing it again every launch is a nag.
 * @param hostelCode  shown on the first slide; it is the single most important
 *                    thing a new manager has to write down.
 * @param t           i18n
 */
export default function WelcomeSheet({ visible, onDone, hostelCode, t }) {
  const { width: screenW } = useWindowDimensions();
  const scroller = useRef(null);
  const [index, setIndex] = useState(0);
  const [pageW, setPageW] = useState(0);

  const slides = useMemo(() => [
    {
      key: 'welcome',
      icon: 'waving_hand',
      title: t('tour.s1title', 'Your hostel is ready'),
      body: t('tour.s1body',
        'HostelKeep runs your daily housekeeping: you assign rooms in the morning, your team marks them off as they go, and you watch it happen.'),
      code: true,
    },
    {
      key: 'rooms',
      icon: 'bed',
      title: t('tour.s2title', 'Build your property'),
      body: t('tour.s2body',
        'Tap the hostel button beside the tab bar, then "Rooms". Add your floors first (i.e, 1st, 2nd, 3rd - even if you only have one), then add each room and its beds. The "Attributes" button allows you to specify specific bed types, like "double" or "twin" for your private rooms. Then start adding rooms and recreate your own hostel!'),
    },
    {
      key: 'team',
      icon: 'group',
      title: t('tour.s3title', 'Add your housekeepers'),
      body: t('tour.s3body',
        'Same button, then "Team". You choose their username and password — they sign in on their own phone with those and your hostel code. They only ever see the rooms you assign them.'),
    },
    {
      key: 'assign',
      icon: 'swap_horiz',
      title: t('tour.s4title', 'Assign the day'),
      body: t('tour.s4body',
        'The "Assign" tab is where you spend your mornings. Tap a room, pick who cleans it, mark which beds need doing, and add a note if something needs saying.'),
    },
    {
      key: 'track',
      icon: 'monitoring',
      title: t('tour.s5title', 'Watch it come in - Pro'),
      body: t('tour.s5body',
        'Get real time updates and check on specific rooms anytime. See your team\'s progress as rooms or specific beds turn green as soon as they are cleaned. If someone finds an extra room that needs cleaning they can ask you from their phone, and it lands on the "Extra" tab, where you can approve or reject the request.'),
    },
  ], [t]);

  const last = index === slides.length - 1;

  const goTo = (i) => {
    const next = Math.max(0, Math.min(slides.length - 1, i));
    setIndex(next);
    scroller.current?.scrollTo({ x: next * pageW, animated: true });
  };

  // onMomentumScrollEnd rather than onScroll: onScroll fires continuously and
  // would setState on every frame of the swipe.
  const onSettled = (e) => {
    if (!pageW) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / pageW));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDone}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Tapping away counts as "decided", same as Skip. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDone} accessibilityLabel={t('close')} />

        <View style={[styles.sheet, { maxWidth: Math.min(screenW, 520) }]}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handle} />

            <View style={styles.topRow}>
              <Text style={styles.overline}>
                {t('tour.overline', 'Getting started')}
              </Text>
              <View style={{ flex: 1 }} />
              {!last && (
                <TouchableOpacity onPress={onDone} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.skip}>{t('tour.skip', 'Skip')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* The pager is measured rather than assuming the screen width —
                the sheet is capped at 520 on a tablet. */}
            <View
              style={styles.pagerWrap}
              onLayout={e => setPageW(e.nativeEvent.layout.width)}
            >
              {pageW > 0 && (
                <ScrollView
                  ref={scroller}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onSettled}
                  scrollEventThrottle={16}
                >
                  {slides.map(s => (
                    <View key={s.key} style={[styles.slide, { width: pageW }]}>
                      <View style={styles.iconWrap}>
                        <Icon name={s.icon} size={34} color={COLORS.accent} />
                      </View>
                      <Text style={styles.title}>{s.title}</Text>
                      <Text style={styles.body}>{s.body}</Text>

                      {s.code && !!hostelCode && (
                        <View style={styles.codeBox}>
                          <Text style={styles.codeLabel}>
                            {t('hostelCode', 'Hostel code')}
                          </Text>
                          <Text style={styles.codeValue} selectable>{hostelCode}</Text>
                          <Text style={styles.codeNote}>
                            {t('tour.codeNote',
                              'Your housekeepers need this to sign in. Keep it somewhere safe.')}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.dots}>
              {slides.map((s, i) => (
                <View key={s.key} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => goTo(index - 1)}
                disabled={index === 0}
                style={[styles.ghostBtn, index === 0 && { opacity: 0 }]}
                activeOpacity={0.8}
                accessibilityElementsHidden={index === 0}
              >
                <Text style={styles.ghostBtnText}>{t('tour.back', 'Back')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => (last ? onDone() : goTo(index + 1))}
                style={styles.primaryBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>
                  {last ? t('tour.start', 'Get started') : t('tour.next', 'Next')}
                </Text>
                <Icon
                  name={last ? 'check_circle' : 'arrow_forward'}
                  size={21}
                  color={COLORS.accent}
                />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(11,31,58,0.55)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    ...SHADOW.lg,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 10,
  },

  topRow: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  overline: {
    fontFamily: FONTS.semiBold, fontSize: 13, letterSpacing: 1.04,
    textTransform: 'uppercase', color: COLORS.accentDark,
  },
  skip: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.textTertiary },

  pagerWrap: { marginTop: 10 },
  slide: { paddingRight: 2, gap: 10 },
  iconWrap: {
    width: 62, height: 62, borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: DISPLAY.semiBold, fontSize: 27, lineHeight: 31, color: COLORS.primary,
  },
  body: {
    fontFamily: FONTS.regular, fontSize: 16, lineHeight: 23, color: COLORS.textSecondary,
    // Fixed height so the dots and buttons don't jump between slides of
    // different lengths.
    minHeight: 115,
  },
  codeBox: {
    borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: COLORS.accent, backgroundColor: COLORS.surfaceAlt,
    paddingVertical: 14, paddingHorizontal: 16, gap: 3, alignItems: 'center',
  },
  codeLabel: {
    fontFamily: FONTS.semiBold, fontSize: 12, letterSpacing: 1,
    textTransform: 'uppercase', color: COLORS.textTertiary,
  },
  codeValue: {
    fontFamily: DISPLAY.semiBold, fontSize: 32, letterSpacing: 3, color: COLORS.primary,
  },
  codeNote: {
    fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18,
    color: COLORS.textTertiary, textAlign: 'center',
  },

  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 7,
    marginTop: 16, marginBottom: 14,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.border },
  dotOn: { width: 22, backgroundColor: COLORS.accent },

  actions: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  ghostBtn: {
    height: 52, paddingHorizontal: 20, borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnText: { fontFamily: DISPLAY.semiBold, fontSize: 17, color: COLORS.primary },
  primaryBtn: {
    flex: 1, height: 52, borderRadius: 16,
    backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { fontFamily: DISPLAY.semiBold, fontSize: 17, color: COLORS.onPrimary },
});