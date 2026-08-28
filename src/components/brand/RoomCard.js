// ─────────────────────────────────────────────────────────────────────────────
// HousekeeperHeader / FloorHeader / RoomCard / ManagerNote / BedGrid /
// RoomActionButton.
//
// Presentational only — no Firestore, no business logic.
//
// Each component accepts BOTH the handoff prop names and the ones CleanerScreen
// already uses (title/done/total/expanded/onPress, note, state="disabled"), so
// the screen doesn't need rewriting.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { BedChip, RoomTypePill, StatusPill, ProgressBar, FloorAccent } from './Pieces';
import {
  BRAND, NEUTRAL, STATUS, ACCENT, RADII, SHADOWS, SPACE, HIT,
} from '../../theme/tokens';
import { type } from '../../theme/typography';

/* ── HousekeeperHeader ─────────────────────────────────────────────
   Transcribed from the prototype ("HostelKeep App.dc.html", isApp branch).

   Note this is NOT the navy block the README describes — that was an earlier
   iteration. The shipped design is a light strip on #F2F3F8:

     padding 18/18/16, column, gap 14
     ├─ row: [ hostel name 14/500 muted        ]  [ avatar 46 navy ]
     │       [ greeting Fredoka 600 22 navy    ]
     └─ progress card: radius 18, padding 14/16, 1px #E2E8EF border,
        translucent white fill
          ├─ row (baseline-aligned): label 15/500 · percentage Fredoka 600 40
          └─ track 10px, navy-16% , fill yellow → green

   It sits ABOVE the scroll area, not inside it, so it stays put while the room
   list scrolls under it.                                                    */
export function HousekeeperHeader({
  greeting,
  hostelName,
  name,
  photoUri,
  onAvatarPress,
  done = 0,
  total = 0,
  label,
}) {
  const pct = total > 0 ? done / total : 0;

  const initials = (name || '')
    .split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0]).join('').toUpperCase();

  return (
    <View style={styles.hkHeader}>
      <View style={styles.hkRow}>
        <View style={styles.hkText}>
          {!!hostelName && (
            <Text style={styles.hkHostel} numberOfLines={1}>{hostelName}</Text>
          )}
          {!!greeting && (
            <Text style={styles.hkGreeting} numberOfLines={1}>{greeting}</Text>
          )}
        </View>

        <TouchableOpacity
          onPress={onAvatarPress}
          disabled={!onAvatarPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={name}
          style={styles.hkAvatar}
        >
          {photoUri
            ? <Image source={{ uri: photoUri }} style={styles.hkAvatarImg} />
            : <Text style={styles.hkAvatarText}>{initials}</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.hkProgressCard}>
        <View style={styles.hkProgressRow}>
          <Text style={styles.hkProgressLabel} numberOfLines={1}>
            {label || `${done} / ${total}`}
          </Text>
          <Text style={styles.hkProgressPct}>{Math.round(pct * 100)}%</Text>
        </View>
        <ProgressBar value={pct} height={10} trackColor={NEUTRAL.track} />
      </View>
    </View>
  );
}

/* ── FloorHeader ───────────────────────────────────────────────────
   Accepts { label | title }, { count | done+total }, { collapsed | expanded },
   { onToggle | onPress }. `complete` is derived from done/total if omitted.  */
export function FloorHeader({
  label, title,
  count, done, total,
  complete,
  collapsed, expanded,
  onToggle, onPress,
}) {
  const text = label ?? title ?? '';
  const isOpen = expanded !== undefined ? expanded : !collapsed;
  const press = onToggle || onPress;
  const isComplete = complete !== undefined
    ? complete
    : (total > 0 && done >= total);
  const meta = count ?? (total !== undefined ? `${done ?? 0}/${total}` : null);

  return (
    <TouchableOpacity
      onPress={press}
      activeOpacity={0.7}
      disabled={!press}
      accessibilityRole="button"
      accessibilityState={{ expanded: !!isOpen }}
      style={styles.floorHeader}
    >
      <FloorAccent complete={isComplete} />
      <Text style={type('sectionName', { color: NEUTRAL.text, flex: 1 })} numberOfLines={1}>
        {text}
      </Text>
      {meta !== null && meta !== undefined && (
        <Text style={type('meta', { color: NEUTRAL.text4 })}>{meta}</Text>
      )}
      {!!press && (
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={18} color={NEUTRAL.text4} />
      )}
    </TouchableOpacity>
  );
}

/* ── RoomCard ──────────────────────────────────────────────────────
   Two modes:
   (a) Pass `number` → the card renders the handoff header itself (big room
       number, type pill, tags, chevron) and shows `children` when expanded.
   (b) Pass no `number` → the card is just the shell (surface, radius 20, 6px
       status accent, shadow) and renders `children` verbatim. This is what
       CleanerScreen uses, since it builds its own header row.               */
export function RoomCard({
  number,
  floorLabel,
  typeLabel,
  isDorm,
  tags = [],            // [{ label, status, icon }]
  accent = 'progress',  // 'progress' | 'bedsDone' | 'complete'
  expanded,
  onToggle,
  children,
  style,
}) {
  const shell = [styles.card, { borderLeftColor: ACCENT[accent] || ACCENT.progress }, style];

  // Mode (b): shell only.
  if (number === undefined || number === null) {
    return <View style={shell}>{children}</View>;
  }

  // Mode (a): full handoff header.
  return (
    <View style={shell}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.8}
        disabled={!onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: !!expanded }}
        style={styles.cardHead}
      >
        <View style={styles.numberBlock}>
          <Text style={type('roomNumberHk', { color: NEUTRAL.text })} numberOfLines={1}>
            {number}
          </Text>
          {!!floorLabel && (
            <Text style={type('meta', { color: NEUTRAL.text4 })} numberOfLines={1}>
              {floorLabel}
            </Text>
          )}
        </View>

        <View style={styles.tagBlock}>
          {!!typeLabel && <RoomTypePill isDorm={isDorm} label={typeLabel} />}
          {tags.map(t => (
            <StatusPill key={t.label} label={t.label} status={t.status} icon={t.icon} />
          ))}
        </View>

        <Icon name={expanded ? 'expand_less' : 'expand_more'} size={20} color={NEUTRAL.text4} />
      </TouchableOpacity>

      {expanded && <View style={styles.cardBody}>{children}</View>}
    </View>
  );
}

/* ── ManagerNote — blue callout inside an expanded room ────────────
   Accepts { note } or { text }, with an optional overline.                 */
export function ManagerNote({ note, text, overline = 'NOTE FROM MANAGER' }) {
  const body = note ?? text ?? '';
  if (!body) return null;
  return (
    <View style={styles.note}>
      <Text style={type('overline', { color: STATUS.cleaned.text })}>{overline}</Text>
      <Text style={type('bodyLg', { color: STATUS.cleaned.text, marginTop: 4 })}>{body}</Text>
    </View>
  );
}

/* ── BedGrid — two columns ─────────────────────────────────────────
   The letter falls back through letter → label → name → index, because room
   documents in Firestore store beds as { id, name } with no `letter` field.  */
export function BedGrid({ beds = [], onBedPress, labelFor }) {
  return (
    <View style={styles.bedGrid}>
      {beds.map((bed, i) => {
        const letter = bed.letter ?? bed.label ?? bed.name ?? String(i + 1);
        return (
          <View key={bed.id ?? i} style={styles.bedCell}>
            <BedChip
              letter={letter}
              status={bed.status}
              label={labelFor ? labelFor(bed) : bed.status}
              onPress={onBedPress ? () => onBedPress(bed, i) : undefined}
            />
          </View>
        );
      })}
    </View>
  );
}

/* ── RoomActionButton — disabled → navy → green ────────────────────
   'blocked' and 'disabled' are the same state; both spellings accepted.     */
export function RoomActionButton({ state, label, onPress }) {
  const map = {
    blocked:  { bg: NEUTRAL.deskBg,      fg: NEUTRAL.text4,         icon: 'lock' },
    disabled: { bg: NEUTRAL.deskBg,      fg: NEUTRAL.text4,         icon: 'lock' },
    ready:    { bg: BRAND.navy,          fg: '#FFFFFF',             icon: 'done_all' },
    done:     { bg: STATUS.inspected.bg, fg: STATUS.inspected.text, icon: 'check_circle' },
  };
  const s = map[state] || map.blocked;
  const enabled = state === 'ready';

  return (
    <TouchableOpacity
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      style={[styles.roomAction, { backgroundColor: s.bg }]}
    >
      <Icon name={s.icon} size={20} color={s.fg} />
      <Text style={type('btnPrimary', { color: s.fg })} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hkHeader: {
    backgroundColor: NEUTRAL.headerBg,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 14,
  },
  hkRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hkText: { flex: 1, minWidth: 0 },
  hkHostel: {
    ...type('label', { fontSize: 14, color: NEUTRAL.textOnLight }),
  },
  hkGreeting: {
    ...type('sectionName', { fontSize: 22, lineHeight: 25, color: BRAND.navy }),
  },
  hkAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: BRAND.navy,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  hkAvatarImg:  { width: 46, height: 46 },
  hkAvatarText: {
    ...type('sectionName', { fontSize: 18, color: BRAND.yellow, letterSpacing: 0.36 }),
  },
  hkProgressCard: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: NEUTRAL.glassBorder,
    backgroundColor: NEUTRAL.glassCard,
  },
  // flex-end aligns the 15px label to the baseline of the 40px number.
  hkProgressRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  hkProgressLabel: {
    ...type('label', { fontSize: 15, color: NEUTRAL.text, flex: 1 }),
  },
  hkProgressPct: {
    ...type('percentage', { fontSize: 40, lineHeight: 36, color: BRAND.navy }),
  },

  floorHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.base,
    minHeight: HIT.minTarget,
    marginTop: SPACE.huge, marginBottom: SPACE.md,
  },

  card: {
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADII.card,
    borderLeftWidth: 6,
    marginBottom: SPACE.base,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  cardHead: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.base,
    padding: SPACE.xl, minHeight: HIT.minTarget,
  },
  numberBlock: { minWidth: 68 },
  tagBlock:    { flex: 1, alignItems: 'flex-end', gap: 6 },
  cardBody:    { paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xl, gap: SPACE.base },

  note: {
    backgroundColor: STATUS.cleaned.bg,
    borderRadius: RADII.md,
    padding: SPACE.lg,
  },

  bedGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  bedCell: { width: '50%', paddingHorizontal: 5, paddingBottom: SPACE.md },

  roomAction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, minHeight: 56, borderRadius: RADII.md,
  },
});