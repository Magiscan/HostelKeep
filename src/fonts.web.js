// src/fonts.web.js — WEB font loading.
//
// Native registers one family per weight (Rubik_500Medium, …) and the mobile
// screens rely on that: they set only fontFamily, never fontWeight. Google
// Fonts can only serve one family ("Rubik") with several weights, so when
// the phone layout ran in a browser everything fell back to weight 400.
// The web now registers the SAME family names as native, from our own
// hosting (public/fonts → app.hostelkeep.com/fonts).
//
// Each face is declared for the whole 100–900 range. The desktop screens
// also set fontWeight ('600' on the 600 face); with a single-weight
// declaration the browser would fake-bold on top of it. With the range,
// any weight maps to the real face and nothing is synthesised.
//
// Injected at import time, before the first render; font-display: swap means
// text never waits on the download.

const FACES = {
  Fredoka_600SemiBold: '/fonts/Fredoka_600SemiBold.ttf',
  Rubik_400Regular:    '/fonts/Rubik_400Regular.ttf',
  Rubik_500Medium:     '/fonts/Rubik_500Medium.ttf',
  Rubik_600SemiBold:   '/fonts/Rubik_600SemiBold.ttf',
};

if (typeof document !== 'undefined' && !document.getElementById('hk-brand-fonts')) {
  const style = document.createElement('style');
  style.id = 'hk-brand-fonts';
  style.textContent = Object.entries(FACES).map(([family, url]) => `
@font-face {
  font-family: '${family}';
  src: url('${url}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}`).join('\n');
  document.head.appendChild(style);
}

export const BRAND_FONTS = {};
export const INTER_FONTS = {};   // alias, see fonts.js

// App.js waits on this; the swap happens in the background.
export function useFonts() {
  return [true, null];
}