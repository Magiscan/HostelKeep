/**
 * responsive.js – clamped scaling for mobile/web
 *
 * Prevents UI from becoming comically large on desktop browsers.
 * Adjust MAX_SCALE and WEB_MAX_SCALE to your taste.
 */

import { Dimensions, PixelRatio, Platform } from 'react-native';

const BASE_WIDTH  = 390;
const BASE_HEIGHT = 844;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Maximum allowed scale factor for width-based scaling (phones up to large tablets)
const MAX_SCALE = 2.0;       // 2× baseline – good for 780px wide tablet

// For web (large screens) we typically want an even tighter cap
const WEB_MAX_SCALE = 1.5;   // 1.5× baseline – looks comfortable on 1920px monitor

// Determine which cap to use
const isWeb = Platform.OS === 'web';
const maxScale = isWeb ? WEB_MAX_SCALE : MAX_SCALE;

/** Compute raw scale and clamp */
const clampedWidthScale = () => {
  const raw = SCREEN_WIDTH / BASE_WIDTH;
  return Math.min(raw, maxScale);
};

/** Horizontal (width-based) scale with clamping */
export const rs = (size) =>
  Math.round(clampedWidthScale() * size);

/** Vertical (height-based) scale with similar clamping (optional) */
const clampedHeightScale = () => {
  const raw = SCREEN_HEIGHT / BASE_HEIGHT;
  return Math.min(raw, maxScale);
};

export const rvs = (size) =>
  Math.round(clampedHeightScale() * size);

/**
 * Font scale – already clamped between 0.85 and 1.25.
 * You can keep it as is, or also apply the same maxScale logic.
 */
export const rf = (size) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  // Use same clamping range, but also respect maxScale for upper bound
  const clamped = Math.min(Math.max(scale, 0.85), Math.min(1.25, maxScale));
  return Math.round(PixelRatio.roundToNearestPixel(size * clamped));
};

/** Padding / margin alias */
export const rp = rs;

/** Exposed screen dimensions */
export const SCREEN = {
  WIDTH:  SCREEN_WIDTH,
  HEIGHT: SCREEN_HEIGHT,
  IS_TABLET: SCREEN_WIDTH >= 768,
  IS_SMALL:  SCREEN_WIDTH <= 360,
};

export const isAndroid = Platform.OS === 'android';
export const isIOS     = Platform.OS === 'ios';