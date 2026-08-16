// App.js imports './src/fonts' — this module did not exist in the repo, so the
// native bundle failed to resolve it. Re-exports expo-font's useFonts plus the
// font map, so App.js can call the hook unconditionally.
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export const INTER_FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};

export { useFonts };