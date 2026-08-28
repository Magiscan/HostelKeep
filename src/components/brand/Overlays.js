// ─────────────────────────────────────────────────────────────────────────────
// Overlays: bottom sheet, toast, FAB, confetti.
// These replace the app's current Modal / Alert visuals.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Modal, Pressable, TouchableOpacity, ScrollView,
  Animated, Easing, Dimensions, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../Icon';
import {
  BRAND, NEUTRAL, GLASS, RADII, SHADOWS, SPACE, HIT, MOTION, CONFETTI_COLORS,
} from '../../theme/tokens';
import { type } from '../../theme/typography';

/* ── BottomSheet ───────────────────────────────────────────────────
   Scrim rgba(11,31,58,0.55) (0.62 for the paywall), sheet anchored to the
   bottom, radius 26, max-height 88%, internal scroll.                     */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  variant = 'light',        // 'light' | 'navy'  (navy = Pro paywall)
  maxHeightRatio = 0.88,
  scrollable = true,
}) {
  const navy = variant === 'navy';
  const slide = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 1,
      duration: visible ? 260 : 200,
      easing: Easing.bezier(0.25, 0.6, 0.4, 1),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 600] });
  const Body = scrollable ? ScrollView : View;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: navy ? GLASS.overlayPro : GLASS.overlay }]}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: navy ? BRAND.navy : NEUTRAL.surface,
            maxHeight: Dimensions.get('window').height * maxHeightRatio,
            transform: [{ translateY }],
          },
        ]}
      >
        <SafeAreaView edges={['bottom']}>
          <View style={styles.grabber} />
          {(title || subtitle) && (
            <View style={styles.sheetHead}>
              {!!title && (
                <Text style={type('screenTitle', {
                  color: navy ? '#FFFFFF' : BRAND.navy, fontSize: 25,
                })}>
                  {title}
                </Text>
              )}
              {!!subtitle && (
                <Text style={type('body', {
                  color: navy ? '#C6D3E4' : NEUTRAL.text3, marginTop: 4,
                })}>
                  {subtitle}
                </Text>
              )}
            </View>
          )}
          <Body
            contentContainerStyle={scrollable ? styles.sheetBody : undefined}
            style={!scrollable ? styles.sheetBody : undefined}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </Body>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

/* ── Toast ─────────────────────────────────────────────────────────
   Navy pill, left/right 16, bottom 96, yellow icon, auto-dismiss 2600ms.
   Always singular — the timer resets rather than stacking.                */
export function Toast({ message, icon = 'check_circle', onHide }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return undefined;
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true })
        .start(() => onHide && onHide());
    }, MOTION.toast);
    return () => clearTimeout(timer);
  }, [message, anim, onHide]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <Icon name={icon} size={20} color={BRAND.yellow} />
      <Text style={type('label', { color: '#FFFFFF', flex: 1 })}>{message}</Text>
    </Animated.View>
  );
}

/**
 * Drop-in hook so screens can replace Alert.alert() with a toast.
 *
 * Returns an object that is BOTH the controller and the toast state:
 *   const toast = useToast();
 *   toast.show('Saved');                 // fire it
 *   <ToastHost toast={toast} />          // render it (required!)
 *
 * `showToast` / `hideToast` are aliases for `show` / `hide`.
 */
export function useToast() {
  const [current, setCurrent] = useState(null);
  const show = useCallback(
    (message, icon) => setCurrent({ message, icon, k: Date.now() }),
    [],
  );
  const hide = useCallback(() => setCurrent(null), []);
  return {
    current,
    toast: current,
    show,
    hide,
    showToast: show,
    hideToast: hide,
  };
}

/**
 * Renders whatever `useToast()` is currently holding. Without this in the tree
 * the toast fires into the void — show() updates state that nothing displays.
 */
export function ToastHost({ toast }) {
  if (!toast?.current) return null;
  return (
    <Toast
      key={toast.current.k}
      message={toast.current.message}
      icon={toast.current.icon}
      onHide={toast.hide}
    />
  );
}

/* ── Fab — the floating "Extra" pill ───────────────────────────── */
export function Fab({ label, icon = 'add_circle', onPress, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.fab, SHADOWS.fab, style]}
    >
      <Icon name={icon} size={24} color={BRAND.yellow} />
      <Text style={type('btnPrimary', { color: '#FFFFFF' })}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Confetti ──────────────────────────────────────────────────────
   Fires once when the housekeeper's progress reaches 100%.
   44 pieces, 2.2–3.8s fall, cleaned up after 4.2s.                        */
const PIECES = 44;
export function Confetti({ fire, onDone }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!fire) return undefined;
    const next = Array.from({ length: PIECES }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      left: Math.random() * 100,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      round: i % 2 === 0,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      drift: (Math.random() - 0.5) * 160,
      duration: 2200 + Math.random() * 1600,
      delay: Math.random() * 900,
      spin: 360 + Math.random() * 900,
      anim: new Animated.Value(0),
    }));
    setPieces(next);

    next.forEach((p) => {
      Animated.timing(p.anim, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.bezier(0.25, 0.6, 0.4, 1),
        useNativeDriver: true,
      }).start();
    });

    const timer = setTimeout(() => { setPieces([]); onDone && onDone(); }, MOTION.confetti);
    return () => clearTimeout(timer);
  }, [fire, onDone]);

  if (!pieces.length) return null;

  const H = Dimensions.get('window').height;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <Animated.View
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: -40,
            width: p.w,
            height: p.round ? p.w : p.h,
            borderRadius: p.round ? p.w / 2 : 2,
            backgroundColor: p.color,
            opacity: p.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, H + 120] }) },
              { translateX: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: RADII.sheet, borderTopRightRadius: RADII.sheet,
    ...SHADOWS.toolbar,
  },
  grabber: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: NEUTRAL.border,
    alignSelf: 'center', marginTop: SPACE.md, marginBottom: SPACE.s,
  },
  sheetHead: { paddingHorizontal: SPACE.xxl, paddingTop: SPACE.md, paddingBottom: SPACE.s },
  sheetBody: { paddingHorizontal: SPACE.xxl, paddingBottom: SPACE.huge, gap: SPACE.base },

  toast: {
    position: 'absolute', left: 16, right: 16, bottom: 96,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    backgroundColor: BRAND.navy,
    borderRadius: RADII.lg,
    paddingVertical: SPACE.lg, paddingHorizontal: SPACE.xl,
    ...SHADOWS.toast,
  },

  fab: {
    position: 'absolute', right: 18, bottom: 30,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    height: 58, borderRadius: 29, paddingHorizontal: SPACE.huge,
    backgroundColor: BRAND.navy,
    minWidth: HIT.minTarget,
  },
});