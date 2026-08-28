// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks of the redesign: bed chips, status pills, the room-type
// pill, the progress bar, avatars and the custom bunk-bed icon.
//
//   npx expo install react-native-svg
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import Icon from '../Icon';
import {
  BRAND, NEUTRAL, STATUS, ACCENT, RADII, SPACE, HIT, MOTION, AVATAR_COLORS,
} from '../../theme/tokens';
import { type } from '../../theme/typography';

/* ── BunkBedIcon ───────────────────────────────────────────────────
   Custom mark derived from the H of the logo: two uprights + two beds
   with pillows. Monochrome, follows `color`.                              */
export function BunkBedIcon({ size = 21, color = NEUTRAL.text }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <Rect x="2"    y="2.6"  width="3.2"  height="18.8" rx="1.5" />
      <Rect x="18.8" y="2.6"  width="3.2"  height="18.8" rx="1.5" />
      <Rect x="6.3"  y="5.6"  width="4.6"  height="2.3"  rx="1.1" />
      <Rect x="5.2"  y="8.4"  width="13.6" height="2.7"  rx="0.7" />
      <Rect x="6.3"  y="13.4" width="4.6"  height="2.3"  rx="1.1" />
      <Rect x="5.2"  y="16.2" width="13.6" height="2.7"  rx="0.7" />
    </Svg>
  );
}

/* ── BedChip ───────────────────────────────────────────────────────
   min-height 88, radius 16. Letter (Fredoka 28) + status icon on top,
   label underneath. Colour + icon + text — never colour alone.            */
export function BedChip({ letter, status = 'dirty', label, onPress, style }) {
  const s = STATUS[status] || STATUS.dirty;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Bed ${letter}, ${label}`}
      style={[
        styles.bedChip,
        { backgroundColor: s.bg, borderColor: s.border },
        style,
      ]}
    >
      <View style={styles.bedTop}>
        <Text style={type('bedLetter', { color: s.text })}>{letter}</Text>
        <Icon name={s.icon} size={18} color={s.text} />
      </View>
      <Text style={type('label', { color: s.text })} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── StatusPill — small tag (Extra, +15m, Note…) ───────────────── */
export function StatusPill({ label, status = 'info', icon, style }) {
  const s = STATUS[status] || STATUS.info;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg, borderColor: s.border }, style]}>
      {icon !== false && <Icon name={icon || s.icon} size={13} color={s.text} />}
      <Text style={type('meta', { color: s.text })} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ── RoomTypePill — the beige "Dorm · 0/6 beds" pill ───────────── */
export function RoomTypePill({ isDorm, label, style }) {
  return (
    <View style={[styles.typePill, style]}>
      {isDorm
        ? <BunkBedIcon size={15} color={NEUTRAL.text2} />
        : <Icon name="single_bed" size={14} color={NEUTRAL.text2} />}
      <Text style={type('meta', { color: NEUTRAL.text2 })} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/* ── ProgressBar ───────────────────────────────────────────────────
   Yellow fill → turns green at 100%. Animates width + colour over 350ms.  */
export function ProgressBar({
  value,                       // 0–1
  height = 10,
  trackColor = 'rgba(255,255,255,0.16)',
  style,
}) {
  const anim = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: MOTION.progress,
      useNativeDriver: false,   // width + backgroundColor are not native-driver safe
    }).start();
  }, [value, anim]);

  const width = anim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp',
  });
  const backgroundColor = anim.interpolate({
    inputRange:  [0, 0.999, 1],
    outputRange: [BRAND.yellow, BRAND.yellow, ACCENT.complete],
  });

  return (
    <View
      style={[{ height, borderRadius: 8, backgroundColor: trackColor, overflow: 'hidden' }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(value * 100), min: 0, max: 100 }}
    >
      <Animated.View style={{ height: '100%', borderRadius: 8, width, backgroundColor }} />
    </View>
  );
}

/* ── FloorAccent — the 5×22 bar beside a floor name ───────────────
   Yellow while the floor is in progress, green once every room is done.   */
export function FloorAccent({ complete }) {
  return (
    <View
      style={{
        width: 5, height: 22, borderRadius: 3,
        backgroundColor: complete ? ACCENT.complete : BRAND.yellow,
      }}
    />
  );
}

/* ── Avatar ────────────────────────────────────────────────────────
   Initials in Fredoka yellow on navy, or a photo. Deterministic colour
   per name when `colorful` is set (team lists, extra requests).           */
export function Avatar({ name = '', size = 46, photoUri, colorful, onPress, style }) {
  const initials = name
    .split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0]).join('').toUpperCase();

  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = colorful ? AVATAR_COLORS[hash % AVATAR_COLORS.length] : BRAND.navy;
  const fg = colorful ? '#FFFFFF' : BRAND.yellow;

  const body = (
    <View
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: bg, overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
        },
        photoUri && { backgroundColor: NEUTRAL.slateChip },
        style,
      ]}
    >
      {photoUri
        ? <Image source={{ uri: photoUri }} style={{ width: size, height: size }} />
        : <Text style={type('sectionName', { color: fg, fontSize: size * 0.38 })}>{initials}</Text>}
    </View>
  );

  if (!onPress) return body;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Profile: ${name}`}
      style={{ minHeight: HIT.minTarget, minWidth: HIT.minTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      {body}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bedChip: {
    flex: 1, minHeight: 88,
    borderRadius: RADII.lg, borderWidth: 1.5,
    padding: SPACE.base,
    justifyContent: 'space-between',
  },
  bedTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: SPACE.sm,
    borderRadius: RADII.xs, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 5, paddingHorizontal: SPACE.md,
    borderRadius: RADII.xs,
    backgroundColor: NEUTRAL.beigePill,
    alignSelf: 'flex-start',
  },
});