import React, { useEffect, useRef } from 'react';
import {
  View, Modal, Pressable, Animated, PanResponder, StyleSheet, Dimensions,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { RADIUS } from '../theme/radius';
import { SHADOW } from '../theme/shadows';

/**
 * Bottom sheet that can actually be swiped down to dismiss.
 *
 * The grab handle at the top of a sheet is a promise — it says "drag me". Our
 * sheets drew the handle but only closed on a backdrop tap, which is exactly
 * the kind of small broken promise that makes an app feel cheap.
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

const SCREEN_H = Dimensions.get('window').height;

// How far down you must drag before release dismisses rather than snapping
// back. Velocity can also trigger it — a fast flick shouldn't need distance.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.6;

export default function BottomSheet({
  visible,
  onClose,
  children,
  maxHeightRatio = 0.9,
  scrollable = false,
}) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const open = () => {
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
  };

  const close = (velocity = 0) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: velocity > 1.5 ? 140 : 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose && onClose();
    });
  };

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_H);
      backdrop.setValue(0);
      // Next frame, so the modal has mounted before we animate in.
      requestAnimationFrame(open);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once it's clearly a downward drag, so taps on
      // buttons inside the sheet still work and an inner ScrollView can still
      // scroll upward.
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"      // we drive the animation ourselves
      onRequestClose={() => close()}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { maxHeight: SCREEN_H * maxHeightRatio, transform: [{ translateY }] },
          ]}
        >
          {/* The handle is the primary drag surface. The whole sheet responds
              too, but a header area makes the affordance obvious. */}
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>

          {scrollable ? (
            <View style={{ flexShrink: 1 }}>{children}</View>
          ) : (
            <View {...panResponder.panHandlers}>{children}</View>
          )}
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
    bottom: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    ...SHADOW.lg,
  },
  handleArea: { paddingTop: SPACING.sm, paddingBottom: SPACING.xs, alignItems: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border },
});