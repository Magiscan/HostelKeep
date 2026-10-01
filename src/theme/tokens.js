// ─────────────────────────────────────────────────────────────────────────────
// HostelKeep 2.0 — design tokens
// Single source of truth. Transcribed 1:1 from the KohCiao design handoff
// (design_handoff_hostelkeep_redesign/README.md → "Design Tokens").
//
// NOTHING in the app should hard-code a hex value. src/theme.js and
// src/theme/*.js both re-export from here so the two legacy palettes can no
// longer drift apart.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

/* ── Brand ─────────────────────────────────────────────────────── */
export const BRAND = {
  navy:       '#0B1F3A',   // titles, primary buttons, avatars, manager header
  navyHover:  '#132B4E',   // pressed / hover state of the primary button
  yellow:     '#F5B32B',   // "Keep", icons on navy, progress bar, selection
  yellowSoft: '#FEF6E3',
};

/* ── Surfaces & neutrals ───────────────────────────────────────── */
export const NEUTRAL = {
  appBg:      '#F4F6FA',   // background of every screen
  headerBg:   '#F2F3F8',   // housekeeper header strip (a touch cooler than appBg)
  glassCard:  'rgba(255,255,255,0.37)',  // translucent progress card (#FFFFFF5F)
  glassBorder:'#E2E8EF',
  track:      'rgba(11,31,58,0.16)',     // progress track (#0B1F3A29)
  textOnLight:'rgba(11,31,58,0.68)',     // hostel name above the greeting
  deskBg:     '#E7EBF2',   // outside the mockup / disabled surfaces
  surface:    '#FFFFFF',   // cards, panels, modals
  border:     '#E2E8F0',
  inputFill:  '#FBFCFE',

  text:       '#0F172A',   // body
  text2:      '#475569',   // subtitles
  text3:      '#64748B',   // labels, meta
  text4:      '#94A3B8',   // hints, disabled

  beigePill:  '#F4E4D0',   // "Dorm · 0/6 beds" pill
  slateChip:  '#F1F5F9',   // icon squares, excluded beds
};

/* ── Bed / room status ─────────────────────────────────────────────
   Every status is colour + icon + label — never colour alone (a11y).
   `icon` names are Material Symbols — src/components/Icon.js renders the
   "material" family, so Ionicons-style names ("checkmark-circle-outline")
   log a warning and render nothing.                                        */
export const STATUS = {
  dirty: {
    bg: '#FEF3C7', border: 'rgba(245,179,43,0.45)', text: '#92400E',
    icon: 'cleaning_services',
  },
  cleaned: {
    bg: '#DBEAFE', border: 'rgba(59,130,246,0.4)', text: '#1E40AF',
    icon: 'auto_awesome',
  },
  inspected: {
    bg: '#DCFCE7', border: 'rgba(34,197,94,0.4)', text: '#15803D',
    icon: 'check_circle',
  },
  early: {
    bg: '#FFE4EC', border: 'rgba(255,45,111,0.3)', text: '#9F1239',
    icon: 'login',
  },
  late: {
    bg: '#EDE9FE', border: 'rgba(139,92,246,0.3)', text: '#5B21B6',
    icon: 'schedule',
  },
  excluded: {
    bg: '#F1F5F9', border: '#E2E8F0', text: '#94A3B8',
    icon: 'remove_circle',
  },
  waiting: {
    bg: '#FEF6E3', border: '#F5B32B', text: '#B45309',
    icon: 'hourglass_empty',
  },
  error: {
    bg: '#FEE2E2', border: '#FECACA', text: '#B91C1C',
    icon: 'error',
  },
  info: {
    bg: '#DBEAFE', border: 'rgba(59,130,246,0.4)', text: '#1E40AF',
    icon: 'info',
  },
  // CleanerScreen maps two more internal bed states. Without these they fall
  // back to `dirty` and render yellow — wrong, and misleading to a housekeeper.
  common: {
    bg: '#F1F5F9', border: '#E2E8F0', text: '#94A3B8',
    icon: 'home',
  },
  stayover: {
    bg: '#F1F5F9', border: '#E2E8F0', text: '#64748B',
    icon: 'bedtime',
  },
  pending: {
    bg: '#FEF3C7', border: 'rgba(245,179,43,0.45)', text: '#92400E',
    icon: 'cleaning_services',
  },
};

/* Room-card left accent: yellow (in progress) → blue (beds done) → green. */
export const ACCENT = {
  progress: '#F5B32B',
  bedsDone: '#3B82F6',
  complete: '#22C55E',
};

/* Confetti palette (housekeeper hits 100%). */
export const CONFETTI_COLORS = [
  '#F5B32B', '#22C55E', '#3B82F6', '#FF2D6F', '#8B5CF6', '#0B1F3A',
];

/* Avatar colours for cleaners / team members.
 *
 * Chosen so that any two are easy to tell apart at 42px:
 *  • hues spaced roughly 36° apart around the wheel — the old set paired
 *    #3B82F6 with #0EA5E9 and #F5B32B with #F97316, which read as the same
 *    colour on a small circle
 *  • all in the 600–800 lightness range, so white initials clear 4.5:1 on
 *    every one of them
 *  • brand navy and brand yellow are deliberately absent: a cleaner's avatar
 *    should never be mistaken for a brand element or a status colour
 */
export const AVATAR_COLORS = [
  '#DC2626',  // red
  '#0369A1',  // blue
  '#16A34A',  // green
  '#7E22CE',  // purple
  '#EA580C',  // orange
  '#0F766E',  // teal
  '#BE185D',  // magenta
  '#4338CA',  // indigo
  '#A16207',  // bronze
  '#4D7C0F',  // olive
];

/* ── Typography ────────────────────────────────────────────────────
   Fredoka 600  → wordmark, room numbers, percentages, section titles,
                  bed letters, person names.
   Rubik 400/500/600 → everything else.                                  */
export const FONT_FAMILY = Platform.select({
  web: {
    display:  '"Fredoka_600SemiBold", "Trebuchet MS", sans-serif',
    regular:  '"Rubik_400Regular", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    medium:   '"Rubik_500Medium", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    semiBold: '"Rubik_600SemiBold", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    bold:     '"Rubik_600SemiBold", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  default: {
    display:  'Fredoka_600SemiBold',
    regular:  'Rubik_400Regular',
    medium:   'Rubik_500Medium',
    semiBold: 'Rubik_600SemiBold',
    // The handoff never goes above 600 — "bold" is an alias so the ~40 existing
    // `FONTS.bold` call sites keep rendering instead of falling back to system.
    bold:     'Rubik_600SemiBold',
  },
});

/* Web needs an explicit weight; native picks it from the family name. */
export const FONT_WEIGHT = Platform.OS === 'web'
  ? { display: '600', regular: '400', medium: '500', semiBold: '600', bold: '600' }
  : { display: undefined, regular: undefined, medium: undefined, semiBold: undefined, bold: undefined };

/* Type scale straight from the handoff table. */
export const TYPE = {
  wordmarkLogin:  { family: 'display', size: 27 },
  wordmarkHeader: { family: 'display', size: 23 },
  screenTitle:    { family: 'display', size: 27 },   // 25–29
  roomNumberHk:   { family: 'display', size: 38 },
  roomNumberMgr:  { family: 'display', size: 31 },   // 30–32
  percentage:     { family: 'display', size: 30 },
  bedLetter:      { family: 'display', size: 28 },
  sectionName:    { family: 'display', size: 21 },   // 20–21
  btnPrimary:     { family: 'semiBold', size: 17 },
  btnSecondary:   { family: 'semiBold', size: 15 },
  label:          { family: 'medium',   size: 15 },
  input:          { family: 'medium',   size: 17 },
  body:           { family: 'regular',  size: 15, lineHeight: 21 },
  bodyLg:         { family: 'regular',  size: 16, lineHeight: 23 },
  meta:           { family: 'regular',  size: 13 },
  tabLabel:       { family: 'semiBold', size: 11 },
  overline:       { family: 'semiBold', size: 13, letterSpacing: 1.04, uppercase: true },
};

/* ── Radii ─────────────────────────────────────────────────────── */
export const RADII = {
  xs:      8,    // small pill tags
  sm:      12,   // bed status chips (12–16)
  md:      14,   // buttons, inputs
  lg:      16,
  card:    20,   // cards (20–22)
  sheet:   26,   // bottom sheets
  bubble:  30,   // liquid-glass bubbles (26–35)
  toolbar: 34,
  full:    999,
};

/* ── Spacing (2/4/6/8/10/12/14/16/18/20/22) ────────────────────── */
export const SPACE = {
  xxs: 2, xs: 4, s: 6, sm: 8, md: 10, base: 12,
  lg: 14, xl: 16, xxl: 18, xxxl: 20, huge: 22,
  screenX: 18,        // horizontal screen padding
  scrollBottom: 120,  // so content clears the FAB / floating toolbar
};

/* ── Shadows ───────────────────────────────────────────────────── */
export const SHADOWS = {
  card: {
    shadowColor: '#0B1F3A', shadowOpacity: 0.06,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  bubble: {
    shadowColor: '#0B1F3A', shadowOpacity: 0.12,
    shadowRadius: 26, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  toolbar: {
    shadowColor: '#0B1F3A', shadowOpacity: 0.18,
    shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 14,
  },
  fab: {
    shadowColor: '#0B1F3A', shadowOpacity: 0.30,
    shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 16,
  },
  toast: {
    shadowColor: '#0B1F3A', shadowOpacity: 0.35,
    shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 18,
  },
};

/* ── Liquid glass (iOS 26/27 style) ────────────────────────────────
   Native uses <BlurView> from expo-blur; these are the surrounding
   layer values. Web gets a real backdrop-filter.                       */
export const GLASS = {
  tint:        'rgba(255,255,255,0.72)',
  tintStrong:  'rgba(255,255,255,0.85)',
  border:      'rgba(255,255,255,0.68)',
  blurIntensity: 28,
  overlay:     'rgba(11,31,58,0.55)',   // bottom-sheet scrim
  overlayPro:  'rgba(11,31,58,0.62)',   // paywall scrim
  webStyle: Platform.OS === 'web'
    ? { backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }
    : {},
};

/* ── Motion ────────────────────────────────────────────────────── */
export const MOTION = {
  progress:    350,   // progress-bar width / colour
  floorAccent: 250,
  tab:         200,
  toast:       2600,  // auto-dismiss
  confetti:    4200,  // cleanup
};

/* ── Accessibility ─────────────────────────────────────────────── */
export const HIT = { minTarget: 44 };