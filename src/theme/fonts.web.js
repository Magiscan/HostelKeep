// Web build uses the system font stack (see theme/typography.js), so there is
// nothing to download. Same signature as expo-font's useFonts, letting App.js
// call the hook unconditionally instead of wrapping it in a Platform ternary.
export const INTER_FONTS = {};

export function useFonts() {
  return [true, null];
}