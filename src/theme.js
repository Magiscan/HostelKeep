/**
 * theme.js  (root level, same location as current theme.js)
 *
 * All dimension values now go through the responsive helpers so the
 * UI scales correctly across small phones, mid-range Androids, and tablets.
 */

import { rs, rf } from './utils/responsive';
import { Platform } from 'react-native';

export const COLORS = {
  primary:        '#2563EB',
  primaryLight:   '#EFF3FF',
  primaryDark:    '#1D4ED8',
  accent:         '#F59E0B',
  accentLight:    '#FFFBEB',
  success:        '#10B981',
  successLight:   '#ECFDF5',
  danger:         '#EF4444',
  dangerLight:    '#FEF2F2',
  text:           '#1E293B',
  textSecondary:  '#64748B',
  textMuted:      '#94A3B8',
  background:     '#F8FAFC',
  surface:        '#FFFFFF',
  border:         '#E2E8F0',
  white:          '#FFFFFF',
  black:          '#0F172A',
};

export const FONTS = Platform.select({
  web: {
    regular:  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    medium:   '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    semiBold: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    bold:     '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  default: {
    regular:  'Inter_400Regular',
    medium:   'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold:     'Inter_700Bold',
  },
});

/**
 * RADIUS values are now scaled so they look proportional on every screen.
 * Use rs() for horizontal radii (cards, inputs) and leave them as-is for
 * perfectly-round elements (full: 9999 always works).
 */
export const RADIUS = {
  sm:   rs(8),
  md:   rs(14),
  lg:   rs(18),
  xl:   rs(22),
  full: 9999,
};

export const SHADOW = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius:  2,
    elevation:     1,       // Android
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius:  8,
    elevation:     3,
  },
  glow: {
    shadowColor:   '#2563EB',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius:  12,
    elevation:     6,
  },
};

/**
 * Responsive font sizes used app-wide.
 * Import and use like: fontSize: FONT_SIZE.md
 */
export const FONT_SIZE = {
  xs:   rf(11),
  sm:   rf(13),
  md:   rf(15),
  lg:   rf(17),
  xl:   rf(20),
  xxl:  rf(24),
  xxxl: rf(30),
};

/**
 * Spacing scale (multiples of 4 px, scaled).
 * Use like: padding: SPACING[4]  → ~16 dp on reference device
 */
export const SPACING = {
  1:  rs(4),
  2:  rs(8),
  3:  rs(12),
  4:  rs(16),
  5:  rs(20),
  6:  rs(24),
  8:  rs(32),
  10: rs(40),
  12: rs(48),
};

/** Legacy helper – unchanged so existing code doesn't break */
export const genId = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36);