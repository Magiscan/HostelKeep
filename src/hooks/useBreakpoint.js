// src/hooks/useBreakpoint.js
//
// One place that decides what "narrow" means, so the sidebar, the Assign rail
// and every card grid agree. Screens were each inventing their own threshold
// (Assign used width < 900, others hardcoded minWidths) which meant the layout
// broke at three different widths on the way down.
//
// Thresholds:
//   mobile  < 768   phone. Sidebar becomes an overlay drawer, one card per row,
//                   tables scroll horizontally, floating bars go full width.
//   tablet  < 1100  narrow laptop / landscape tablet. Sidebar stays, but the
//                   Assign rail collapses to its icon strip and grids drop to
//                   two columns.
//   desktop >= 1100 the layout the prototype was drawn at.
import { Platform, useWindowDimensions } from 'react-native';

export const BREAKPOINTS = { mobile: 768, tablet: 1100 };

export default function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const isMobile = width < BREAKPOINTS.mobile;
  const isTablet = width < BREAKPOINTS.tablet;
  return {
    width,
    height,
    isMobile,
    isTablet,          // true on mobile too — it means "not full desktop"
    isDesktop: !isTablet,
  };
}

/**
 * Web only: should this browser get the phone UI (ManagerApp / CleanerScreen)
 * rather than the desktop dashboard? Width alone flips a phone to the desktop
 * layout, paywall included, as soon as it's turned sideways. A touch-first
 * device whose SHORT side is phone-sized keeps the phone layout either way
 * round. iPads (768 px and up on the short side) still get the desktop.
 */
export function usePhoneLayout() {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web') return true;
  if (width < BREAKPOINTS.mobile) return true;
  const coarse = typeof window !== 'undefined'
    && !!window.matchMedia?.('(pointer: coarse)').matches;
  return coarse && Math.min(width, height) < BREAKPOINTS.mobile;
}