// src/utils/cleanerColor.js
//
// One colour per cleaner, distinct from every other cleaner, identical on
// every screen.
//
// THREE APPROACHES, AND WHY THIS ONE:
//
//   index-in-array   — what the app did originally. Guarantees distinct
//                      colours, but only agrees between screens while every
//                      screen iterates the same array in the same order. It
//                      didn't, which is why Assign and Team disagreed.
//
//   hash-the-id      — what I suggested last time. Order-independent, but
//                      hashing into N buckets collides: with 7 colours and 5
//                      cleaners there's already a ~50% chance two share one.
//                      Fine for decoration, not for telling people apart.
//
//   canonical order  — this. Sort the ids (a total order that doesn't depend
//                      on how the list was built), then assign by position.
//                      Distinct AND order-independent.
//
// The cost is that it needs the whole roster, not just one id — so it returns
// a map rather than a single colour. That also makes it cheap to memoise.
import { AVATAR_COLORS } from '../theme/tokens';

/**
 * @param   {Array<{id: string}>} cleaners
 * @returns {Object<string, string>} cleaner id → hex colour
 */
export function buildCleanerColors(cleaners = []) {
  const map = {};
  // Sorting by id gives the same sequence regardless of whether the caller
  // passed the context array, a filtered copy, or a list sorted by username.
  [...cleaners]
    .map(c => c.id)
    .sort()
    .forEach((id, i) => {
      map[id] = AVATAR_COLORS[i % AVATAR_COLORS.length];
    });
  return map;
}

/**
 * Convenience for the rare call site that only has one id and no roster.
 * Prefer buildCleanerColors — this one CAN collide, because without the full
 * list there's no way to know which colours are already taken.
 */
export function fallbackCleanerColor(id) {
  if (!id) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}