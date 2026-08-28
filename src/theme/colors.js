// src/theme/colors.js — palette used by the WEB screens, components/Dashboard/*
// and (since the redesign) LoginScreen.js + CleanerScreen.js.
//
// Re-exports the same tokens as src/theme.js so the two can no longer drift.
// Every key the screens reference is defined here — a missing key silently
// resolves to `undefined`, which RN renders as "no colour" rather than throwing,
// so gaps here show up as invisible text rather than a stack trace.

import { BRAND, NEUTRAL, STATUS, ACCENT } from './tokens';

export const COLORS = {
  /* Brand */
  primary:       BRAND.navy,
  primaryLight:  '#E8EDF5',
  primaryDark:   BRAND.navyHover,
  onPrimary:     '#FFFFFF',        // text/icons ON navy
  onAccent:      BRAND.navy,       // text/icons ON yellow

  accent:        BRAND.yellow,
  accentLight:   BRAND.yellowSoft,
  accentDark:    '#B45309',        // readable yellow-family text

  /* Semantic */
  success:       ACCENT.complete,
  successLight:  STATUS.inspected.bg,
  successDark:   STATUS.inspected.text,
  warning:       BRAND.yellow,
  warningLight:  STATUS.waiting.bg,
  danger:        '#B91C1C',
  dangerLight:   STATUS.error.bg,
  dangerBorder:  STATUS.error.border,
  info:          STATUS.cleaned.text,
  infoLight:     STATUS.cleaned.bg,

  /* Surfaces */
  background:    NEUTRAL.appBg,      // #F4F6FA
  surface:       NEUTRAL.surface,    // #FFFFFF  cards, sheets
  surfaceAlt:    NEUTRAL.inputFill,  // #FBFCFE  input fills
  surfaceMuted:  NEUTRAL.slateChip,  // #F1F5F9  stepper trays, ghost buttons
  surfaceSunken: NEUTRAL.slateChip,  // #F1F5F9  badge wells
  disabledBg:    NEUTRAL.deskBg,     // #E7EBF2

  /* Lines */
  border:        NEUTRAL.border,
  borderStrong:  '#CBD5E1',        // AssignScreen stayover chip
  borderFocus:   BRAND.yellow,
  inputFill:     NEUTRAL.inputFill,

  /* Text */
  text:          NEUTRAL.text,
  textStrong:    NEUTRAL.text,     // Icon.js default `color` prop
  textSecondary: NEUTRAL.text2,
  textTertiary:  NEUTRAL.text3,
  textMuted:     NEUTRAL.text4,

  /* Decorative */
  beige:         NEUTRAL.beigePill,
  slate:         NEUTRAL.slateChip,

  white:         '#FFFFFF',
  black:         NEUTRAL.text,

  /* Sidebar (web) — navy panel */
  sidebar:         BRAND.navy,
  sidebarText:     '#A9BCD5',
  sidebarActive:   BRAND.yellow,
  sidebarActiveBg: 'rgba(245,179,43,0.15)',

  /* On-navy tones */
  onNavy:        '#FFFFFF',
  onNavyMuted:   '#A9BCD5',
  onNavySoft:    '#DCE6F2',

  shadow:        'rgba(11,31,58,0.08)',
};

export { STATUS, ACCENT };