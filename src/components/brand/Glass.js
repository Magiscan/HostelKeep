// ─────────────────────────────────────────────────────────────────────────────
// Liquid glass primitives (iOS 26/27 style) — the visual signature of the
// redesign. Native uses expo-blur; web uses a real backdrop-filter.
//
//   npx expo install expo-blur
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { BRAND, NEUTRAL, GLASS, RADII, SHADOWS, SPACE, HIT } from '../../theme/tokens';
import { type } from '../../theme/typography';

/* ── Wordmark: Hostel(navy) + Keep(yellow) ─────────────────────── */
export function Wordmark({ size = 23, style }) {
  return (
    <Text style={[type('wordmarkHeader', { fontSize: size }), style]} numberOfLines={1}>
      <Text style={{ color: BRAND.navy }}>Hostel</Text>
      <Text style={{ color: BRAND.yellow }}>Keep</Text>
    </Text>
  );
}

/* ── GlassBubble ────────────────────────────────────────────────────
   The base container. Everything floating in the redesign is one of these.  */
export function GlassBubble({
  children,
  radius = RADII.bubble,
  style,
  contentStyle,
  onPress,
  shadow = SHADOWS.bubble,
  intensity = GLASS.blurIntensity,
  accessibilityLabel,
}) {
  const body = (
    <View style={[styles.bubbleWrap, { borderRadius: radius }, shadow, style]}>
      {Platform.OS === 'web' ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, backgroundColor: GLASS.tint },
            GLASS.webStyle,
          ]}
        />
      ) : (
        <BlurView
          intensity={intensity}
          tint="light"
          style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
        />
      )}
      {/* Tint + inset highlight sit above the blur. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor: Platform.OS === 'web' ? 'transparent' : GLASS.tint,
            borderWidth: 1,
            borderColor: GLASS.border,
          },
        ]}
        pointerEvents="none"
      />
      <View style={[styles.bubbleContent, contentStyle]}>{children}</View>
    </View>
  );

  if (!onPress) return body;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ minHeight: HIT.minTarget, minWidth: HIT.minTarget }}
    >
      {body}
    </TouchableOpacity>
  );
}

/* ── BubbleHeader — manager top row ────────────────────────────────
   Three bubbles: wordmark (→ paywall), notifications, profile.            */
export function BubbleHeader({
  onWordmarkPress,
  onNotificationsPress,
  onProfilePress,
  unreadCount = 0,
  profileInitials = '',
  profilePhotoUri,
  ProfileImage,          // pass an <Image> if you prefer to control the source
}) {
  return (
    <View style={styles.header}>
      <GlassBubble
        onPress={onWordmarkPress}
        radius={RADII.sheet}
        contentStyle={{ paddingVertical: SPACE.md, paddingHorizontal: SPACE.xxxl }}
        accessibilityLabel="HostelKeep Pro"
      >
        <Wordmark size={23} />
      </GlassBubble>

      <View style={{ flex: 1 }} />

      <GlassBubble
        onPress={onNotificationsPress}
        radius={RADII.full}
        style={styles.circle52}
        contentStyle={styles.center}
        accessibilityLabel={`Notifications, ${unreadCount} unread`}
      >
        <Text style={{ fontSize: 22 }}>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </GlassBubble>

      <GlassBubble
        onPress={onProfilePress}
        radius={RADII.full}
        style={styles.circle52}
        contentStyle={styles.center}
        accessibilityLabel="Profile menu"
      >
        <View style={styles.profileInner}>
          {ProfileImage || (
            <Text style={type('sectionName', { color: BRAND.yellow, fontSize: 17 })}>
              {profileInitials}
            </Text>
          )}
        </View>
      </GlassBubble>
    </View>
  );
}

/* ── GlassToolbar — manager bottom bar ─────────────────────────────
   Left bubble = daily actions (Assign · Extra · Live).
   Right bubble = hostel logo → Setup. Deliberately separated.            */
export function GlassToolbar({ tabs, activeKey, onTabPress, right }) {
  return (
    <View style={styles.toolbar} pointerEvents="box-none">
      <GlassBubble
        radius={RADII.toolbar}
        shadow={SHADOWS.toolbar}
        style={{ flex: 1 }}
        contentStyle={styles.toolbarRow}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
            >
              {tab.renderIcon
                ? tab.renderIcon(active ? NEUTRAL.text : '#8A93A2')
                : <Text style={{ fontSize: 23, color: active ? NEUTRAL.text : '#8A93A2' }}>{tab.emoji}</Text>}
              <Text
                style={type('tabLabel', { color: active ? NEUTRAL.text : '#8A93A2', marginTop: 2 })}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </GlassBubble>

      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleWrap:   { overflow: 'visible', backgroundColor: 'transparent' },
  bubbleContent:{ overflow: 'hidden' },
  center:       { alignItems: 'center', justifyContent: 'center', flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingTop: SPACE.s,
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.base,
  },
  circle52: { width: 52, height: 52 },
  profileInner: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: BRAND.navy,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: BRAND.yellow,
    borderWidth: 2, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { ...type('tabLabel'), color: BRAND.navy, fontSize: 10 },

  toolbar: {
    position: 'absolute', left: 16, right: 16, bottom: 30,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
  },
  toolbarRow: { flexDirection: 'row', padding: 7, gap: 4 },
  tab: {
    flex: 1, minHeight: HIT.minTarget,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, borderRadius: RADII.bubble,
  },
  // Deliberately NEUTRAL, not brand — see handoff §5.
  tabActive: { backgroundColor: 'rgba(15,23,42,0.10)' },
});