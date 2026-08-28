// src/fonts.js — NATIVE font loading.
//
// REDESIGN: Inter is gone. The handoff uses two families:
//   Fredoka 600      → wordmark, room numbers, percentages, bed letters, titles
//   Rubik 400/500/600 → labels, body, buttons, inputs, meta
//
// Install first:
//   npx expo install @expo-google-fonts/fredoka @expo-google-fonts/rubik
//
// You can then `npm uninstall @expo-google-fonts/inter`.
import { useFonts } from 'expo-font';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
} from '@expo-google-fonts/rubik';

export const BRAND_FONTS = {
  Fredoka_600SemiBold,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
};

// Alias so App.js keeps working if you haven't renamed the import yet.
export const INTER_FONTS = BRAND_FONTS;

export { useFonts };