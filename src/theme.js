// ─────────────────────────────────────────────────────────────────────────────
// src/theme.js — palette used by the NATIVE screens.
//
// REDESIGN: every export name and shape is unchanged (COLORS, FONTS, RADIUS,
// SHADOW, FONT_SIZE, SPACING with numeric keys, IS_WEB, IS_TABLET,
// USE_SIDEBAR, WEB_SIDEBAR_WIDTH, WEB_CONTENT_MAX, genId), so no existing
// import breaks. Only the VALUES moved to the HostelKeep 2.0 tokens.
//
// This is the highest-leverage file in the restyle: swapping it repaints every
// native screen that reads COLORS.primary / COLORS.background / FONTS.* .
// ─────────────────────────────────────────────────────────────────────────────

import { rs, rf, SCREEN } from './utils/responsive';
import { Platform } from 'react-native';
import {
  BRAND, NEUTRAL, STATUS, ACCENT, RADII, SHADOWS,
  FONT_FAMILY, GLASS,
} from './theme/tokens';

export const IS_WEB      = Platform.OS === 'web';
export const IS_TABLET   = SCREEN.IS_TABLET;
export const USE_SIDEBAR = IS_WEB && SCREEN.WIDTH >= 768;

export const COLORS = {
  // Brand — `primary` is now NAVY, not blue. This single line is what turns
  // every existing primary button, active tab and focus ring navy.
  primary:        BRAND.navy,
  primaryLight:   '#E8EDF5',
  primaryDark:    BRAND.navyHover,

  // Accent — yellow. Used for "Keep", progress fills, selection states.
  accent:         BRAND.yellow,
  accentLight:    BRAND.yellowSoft,
  amber:          '#B45309',
  amberLight:     '#FEF3C7',

  // Semantic (aligned to the status table)
  success:        ACCENT.complete,
  successLight:   STATUS.inspected.bg,
  successText:    STATUS.inspected.text,
  danger:         '#B91C1C',
  dangerLight:    STATUS.error.bg,
  dangerBorder:   STATUS.error.border,
  warning:        BRAND.yellow,
  warningLight:   STATUS.waiting.bg,
  blue:           ACCENT.bedsDone,
  blueLight:      STATUS.cleaned.bg,
  blueText:       STATUS.cleaned.text,

  // Neutrals
  text:           NEUTRAL.text,
  textStrong:     NEUTRAL.text,   // Icon.js default `color` prop
  textSecondary:  NEUTRAL.text2,
  textTertiary:   NEUTRAL.text3,
  textMuted:      NEUTRAL.text4,
  background:     NEUTRAL.appBg,
  backgroundAlt:  NEUTRAL.deskBg,
  surface:        NEUTRAL.surface,
  border:         NEUTRAL.border,
  borderFocus:    BRAND.yellow,      // focus ring is yellow now, not light blue
  inputFill:      NEUTRAL.inputFill,
  white:          '#FFFFFF',
  black:          NEUTRAL.text,

  // Decorative
  beige:          NEUTRAL.beigePill,
  slate:          NEUTRAL.slateChip,

  // Aliases referenced by LoginScreen / CleanerScreen. Kept in sync with
  // src/theme/colors.js — add to BOTH or one platform goes colourless.
  onPrimary:      '#FFFFFF',
  onAccent:       BRAND.navy,
  accentDark:     '#B45309',
  successDark:    STATUS.inspected.text,
  info:           STATUS.cleaned.text,
  infoLight:      STATUS.cleaned.bg,
  surfaceAlt:     NEUTRAL.inputFill,
  surfaceMuted:   NEUTRAL.slateChip,
  surfaceSunken:  NEUTRAL.slateChip,

  // Disabled
  disabledBg:     NEUTRAL.deskBg,
  disabledText:   NEUTRAL.text4,

  // Sidebar (web) — navy panel
  sidebar:        BRAND.navy,
  sidebarText:    '#A9BCD5',
  sidebarActive:  BRAND.yellow,
  sidebarActiveBg:'rgba(245,179,43,0.15)',

  // On-navy text tones (header, paywall)
  onNavy:         '#FFFFFF',
  onNavyMuted:    '#A9BCD5',
  onNavySoft:     '#DCE6F2',
  onNavyBody:     '#C6D3E4',
  onNavyFill:     'rgba(255,255,255,0.08)',
  onNavyFill2:    'rgba(255,255,255,0.07)',
  onNavyTrack:    'rgba(255,255,255,0.16)',
};

// Re-exported so screens can pull status colours without a second import.
export { STATUS, ACCENT, GLASS };

export const FONTS = FONT_FAMILY;   // .display (Fredoka) + .regular/.medium/.semiBold/.bold (Rubik)

export const RADIUS = {
  xs:      rs(RADII.xs),
  sm:      rs(RADII.sm),
  md:      rs(RADII.md),
  lg:      rs(RADII.lg),
  xl:      rs(RADII.card),
  xxl:     rs(RADII.sheet),
  card:    rs(RADII.card),
  sheet:   rs(RADII.sheet),
  bubble:  rs(RADII.bubble),
  toolbar: rs(RADII.toolbar),
  full:    9999,
};

export const SHADOW = {
  // Legacy keys kept so old call sites still resolve.
  sm:      SHADOWS.card,
  md:      SHADOWS.bubble,
  lg:      SHADOWS.toolbar,
  // `glow` used to be a blue halo. It is now the navy FAB shadow — the design
  // has no coloured glow anywhere.
  glow:    SHADOWS.fab,
  // New, named after the handoff.
  card:    SHADOWS.card,
  bubble:  SHADOWS.bubble,
  toolbar: SHADOWS.toolbar,
  fab:     SHADOWS.fab,
  toast:   SHADOWS.toast,
};

export const FONT_SIZE = {
  xs:   rf(11),
  sm:   rf(13),
  md:   rf(15),
  lg:   rf(17),
  xl:   rf(21),
  xxl:  rf(27),
  xxxl: rf(34),
};

export const SPACING = {
  // Numeric keys — used by the older native screens.
  1:  rs(4),
  2:  rs(8),
  3:  rs(12),
  4:  rs(16),
  5:  rs(18),
  6:  rs(22),
  7:  rs(28),
  8:  rs(32),
  10: rs(40),
  12: rs(48),
  // Named keys — LoginScreen.web.js mixes SPACING.lg with SPACING[4] in the
  // same StyleSheet. Both spellings now resolve to the same scale.
  xs:  rs(4),
  sm:  rs(8),
  md:  rs(12),
  lg:  rs(18),
  xl:  rs(22),
  xxl: rs(32),
  screenX:      rs(18),
  scrollBottom: 120,
};

// Web layout constants
export const WEB_SIDEBAR_WIDTH = 240;
export const WEB_CONTENT_MAX   = 900;

/** Legacy helper */
export const genId = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36);