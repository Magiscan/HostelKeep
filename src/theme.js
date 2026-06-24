import { rs, rf, SCREEN } from './utils/responsive';
import { Platform } from 'react-native';

export const IS_WEB     = Platform.OS === 'web';
export const IS_TABLET  = SCREEN.IS_TABLET;
export const USE_SIDEBAR = IS_WEB && SCREEN.WIDTH >= 768;   // consistent with your existing 768 breakpoint

export const COLORS = {
  // Brand
  primary:        '#2563EB',
  primaryLight:   '#EFF6FF',
  primaryDark:    '#1D4ED8',

  // Accent / warning
  accent:         '#F59E0B',
  accentLight:    '#FFFBEB',
  amber:          '#D97706',
  amberLight:     '#FEF3C7',

  // Semantic
  success:        '#10B981',
  successLight:   '#ECFDF5',
  danger:         '#EF4444',
  dangerLight:    '#FEF2F2',
  blue:           '#3B82F6',
  blueLight:      '#EFF6FF',

  // Neutrals
  text:           '#1E293B',
  textSecondary:  '#475569',
  textMuted:      '#94A3B8',
  background:     '#F1F5F9',
  surface:        '#FFFFFF',
  border:         '#E2E8F0',
  borderFocus:    '#93C5FD',
  white:          '#FFFFFF',
  black:          '#0F172A',

  // Sidebar (web)
  sidebar:        '#1E293B',
  sidebarText:    '#CBD5E1',
  sidebarActive:  '#2563EB',
  sidebarActiveBg:'rgba(37,99,235,0.15)',
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

export const RADIUS = {
  xs:   rs(4),
  sm:   rs(8),
  md:   rs(12),
  lg:   rs(16),
  xl:   rs(22),
  full: 9999,
};

export const SHADOW = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  2,
    elevation:     1,
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius:  8,
    elevation:     3,
  },
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius:  16,
    elevation:     6,
  },
  glow: {
    shadowColor:   '#2563EB',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius:  12,
    elevation:     6,
  },
};

export const FONT_SIZE = {
  xs:   rf(11),
  sm:   rf(13),
  md:   rf(15),
  lg:   rf(17),
  xl:   rf(20),
  xxl:  rf(24),
  xxxl: rf(32),
};

export const SPACING = {
  1:  rs(4),
  2:  rs(8),
  3:  rs(12),
  4:  rs(16),
  5:  rs(20),
  6:  rs(24),
  7:  rs(28),
  8:  rs(32),
  10: rs(40),
  12: rs(48),
};

// Web layout constants
export const WEB_SIDEBAR_WIDTH  = 240;
export const WEB_CONTENT_MAX    = 900;

/** Legacy helper */
export const genId = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36);