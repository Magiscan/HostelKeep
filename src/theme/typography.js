// src/theme/typography.js — Fredoka (display) + Rubik (everything else).

import { FONT_FAMILY, FONT_WEIGHT, TYPE } from './tokens';

export const FONTS = FONT_FAMILY;      // .display .regular .medium .semiBold .bold
export const WEIGHTS = FONT_WEIGHT;

/**
 * DISPLAY — Fredoka, for wordmark, room numbers, percentages, bed letters and
 * section titles. Only 600 SemiBold is loaded, so every key points at the same
 * face; `bold` and `semiBold` are aliases so either spelling works.
 *
 * WAS MISSING — this is what threw "cannot read property 'bold' of undefined".
 */
export const DISPLAY = {
  regular:  FONT_FAMILY.display,
  medium:   FONT_FAMILY.display,
  semiBold: FONT_FAMILY.display,
  bold:     FONT_FAMILY.display,
};

export const FONT_SIZE = {
  xs:   12,
  sm:   14,
  md:   16,
  lg:   18,
  xl:   21,
  xxl:  27,
  xxxl: 34,
};

/**
 * Ready-made text styles straight from the handoff type scale.
 * Usage: <Text style={type('roomNumberHk')}>402</Text>
 */
export function type(name, extra) {
  const t = TYPE[name];
  if (!t) return extra || {};
  return {
    fontFamily:  FONTS[t.family],
    fontWeight:  WEIGHTS[t.family],
    fontSize:    t.size,
    ...(t.lineHeight    ? { lineHeight: t.lineHeight } : null),
    ...(t.letterSpacing ? { letterSpacing: t.letterSpacing } : null),
    ...(t.uppercase     ? { textTransform: 'uppercase' } : null),
    ...extra,
  };
}

export { TYPE };