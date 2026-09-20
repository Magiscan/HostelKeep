import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Modal, Pressable, Animated, PanResponder, StyleSheet, Platform,
  Keyboard, ScrollView, useWindowDimensions,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { RADIUS } from '../theme/radius';
import { SHADOW } from '../theme/shadows';

/**
 * Bottom sheet that can actually be swiped down to dismiss, and that gets out
 * of the keyboard's way without walking off the top of the screen.
 *
 * The grab handle at the top of a sheet is a promise — it says "drag me". Our
 * sheets drew the handle but only closed on a backdrop tap, which is exactly
 * the kind of small broken promise that makes an app feel cheap.
 *
 * KEYBOARD — three things have to hold together, and the sheet is broken in a
 * different way if any one of them is missing:
 *
 *  1. LIFT. A Modal is its own window: `adjustResize` does not resize it, so a
 *     sheet pinned to `bottom: 0` sits under the keyboard and takes any input
 *     it contains down with it. So the sheet is lifted by the measured
 *     keyboard height.
 *
 *  2. HEIGHT. Once lifted, `maxHeightRatio` must NOT be re-applied to what is
 *     left. Those ratios (0.7, 0.85…) were chosen against the whole screen; a
 *     ratio of a ratio leaves a stub of a sheet. With the keyboard up the
 *     sheet gets everything above it, less a gap for the status bar.
 *
 *  3. SCROLL. This is the one that put the card off-screen. A plain View
 *     taller than its parent's maxHeight does not clip and does not scroll —
 *     it overflows, and because the sheet is anchored at the BOTTOM it
 *     overflows upward, past the top of the display. So the body is always a
 *     ScrollView, whatever `scrollable` says.
 *
 *     `scrollable` is kept for call-site compatibility but no longer branches
 *     on the component type. Switching between View and ScrollView when the
 *     keyboard appears would remount the children, and a remounted TextInput
 *     loses focus — which closes the keyboard, which swaps the type back. An
 *     infinite flicker, and a nasty one to diagnose.
 *
 * Built on Animated + PanResponder from React Native core rather than a
 * gesture library: no new dependency, and the interaction is simple enough
 * (one axis, one gesture) that the extra machinery wouldn't earn its weight.
 *
 * Usage — a drop-in replacement for <Modal> + <Pressable backdrop>:
 *
 *   <BottomSheet visible={open} onClose={() => setOpen(false)}>
 *     …content…
 *   </BottomSheet>
 */

// How far down you must drag before release dismisses rather than snapping
// back. Velocity can also trigger it — a fast flick shouldn't need distance.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.6;

// Clearance kept above the sheet when the keyboard is up, so the top edge and
// its rounded corners never tuck under the status bar or a notch.
const TOP_GAP = 52;

// iOS reports the keyboard before it animates, so the sheet can move with it.
// Android only reports it after, so `did*` is the only option there.
const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

export default function BottomSheet({
  visible,
  onClose,
  children,
  maxHeightRatio = 0.9,
  // eslint-disable-next-line no-unused-vars
  scrollable = false,   // accepted for compatibility; see note above
}) {
  const { height: screenH } = useWindowDimensions();

  // Kept in a ref as well, because the pan responder and the close animation
  // are created once and would otherwise close over the first height forever.
  const screenHRef = useRef(screenH);
  screenHRef.current = screenH;

  const translateY = useRef(new Animated.Value(screenH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  // Plain state, not an Animated.Value: `bottom` is a layout prop and cannot be
  // driven natively, and this node's transform already is. Mixing the two
  // drivers on one node throws at runtime.
  const [kbHeight, setKbHeight] = useState(0);

  // The Modal's own window height, measured. This is the only value that
  // reflects whether Android already resized the window for the keyboard —
  // useWindowDimensions() does not update on keyboard show, which is why
  // both the lift and the height cap were a full keyboard out.
  const [rootH, setRootH] = useState(0);
  const fullRootH = useRef(0);
  if (rootH > fullRootH.current) fullRootH.current = rootH;

  const open = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        mass: 0.7,
      }),
      Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [translateY, backdrop]);

  const close = useCallback((velocity = 0) => {
    // Otherwise the keyboard lingers over the screen underneath for a beat
    // after the sheet has gone.
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: screenHRef.current,
        duration: velocity > 1.5 ? 140 : 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose && onClose();
    });
  }, [translateY, backdrop, onClose]);

  useEffect(() => {
    if (visible) {
      translateY.setValue(screenHRef.current);
      backdrop.setValue(0);
      // Next frame, so the modal has mounted before we animate in.
      requestAnimationFrame(open);
    } else {
      // A sheet closed by its parent (rather than by a drag) never ran
      // `close`, so reset by hand — a stale offset would leave the next sheet
      // floating above the bottom edge.
      setKbHeight(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Only listen while the sheet is on screen. A sheet that stays mounted but
  // hidden would otherwise react to keyboards it has nothing to do with.
  useEffect(() => {
    if (!visible) return undefined;

    const showSub = Keyboard.addListener(SHOW_EVENT, (e) => {
      setKbHeight(e?.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(HIDE_EVENT, () => setKbHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once it's clearly a downward drag, so taps on
      // buttons inside the sheet still work and the body can still scroll.
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        // Dragging the sheet means you're done typing.
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          close(g.vy);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 260,
          }).start();
        }
      },
    }),
  ).current;

  // Window already shorter than we've seen it ⇒ the OS made room itself, so
  // bottom:0 is already above the keys and we must not lift again.
  const windowResized = fullRootH.current - rootH > 80;
  const lift = windowResized ? 0 : kbHeight;
  const keyboardUp = kbHeight > 0 || windowResized;

  const H = rootH || screenH;           // screenH only until the first layout
  // With the keyboard up the sheet takes all the room above it. Without it,
  // the caller's ratio applies to the whole screen, as it always did.
  const sheetMax = keyboardUp
    ? Math.max(200, H - lift - TOP_GAP)
    : H * maxHeightRatio;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"      // we drive the animation ourselves
      onRequestClose={() => close()}
      statusBarTranslucent
    >
    <View
        style={StyleSheet.absoluteFill}
        onLayout={e => setRootH(e.nativeEvent.layout.height)}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              bottom: lift,
              maxHeight: sheetMax,
              // The generous bottom padding clears the home indicator. With
              // the keyboard up it's just dead space between the last field
              // and the keys.
              paddingBottom: keyboardUp ? SPACING.md : SPACING.xl,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* The handle is the primary drag surface, and the only one now that
              the body scrolls. */}
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={styles.scrollContent}
            // Without this the first tap on a button only dismisses the
            // keyboard and the press is swallowed — it reads as a dead button.
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,31,58,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg,
    ...SHADOW.lg,
  },
  handleArea: { paddingTop: SPACING.sm, paddingBottom: SPACING.xs, alignItems: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border },
  scrollContent: { paddingBottom: SPACING.sm },
});