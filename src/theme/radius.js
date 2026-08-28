// src/theme/radius.js
import { RADII } from './tokens';

export const RADIUS = {
  xs:      RADII.xs,      //  8
  sm:      RADII.sm,      // 12
  md:      RADII.md,      // 14
  lg:      RADII.lg,      // 16
  xl:      RADII.card,    // 20
  xxl:     RADII.sheet,   // 26  ← bottom sheets. WAS MISSING.
  card:    RADII.card,
  sheet:   RADII.sheet,
  bubble:  RADII.bubble,
  toolbar: RADII.toolbar,
  pill:    28,           // floating tab items / lightbox buttons
  full:    RADII.full,
};