// src/fonts.web.js — WEB font loading.
//
// REDESIGN: the web build used to fall back to the system stack. It now pulls
// Fredoka + Rubik from Google Fonts. The <link> is injected here rather than in
// web/index.html so the two Expo entry points stay in sync; index.html also has
// a preconnect for a faster first paint.
import { useEffect, useState } from 'react';

const HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Fredoka:wght@400;500;600' +
  '&family=Rubik:wght@400;500;600' +
  '&display=swap';

export const BRAND_FONTS = {};
export const INTER_FONTS = {};   // alias, see fonts.js

export function useFonts() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') { setLoaded(true); return; }
    if (!document.getElementById('hk-brand-fonts')) {
      const link = document.createElement('link');
      link.id   = 'hk-brand-fonts';
      link.rel  = 'stylesheet';
      link.href = HREF;
      document.head.appendChild(link);
    }
    // Don't block the first paint on the font CDN — `display=swap` handles it.
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => setLoaded(true)).catch(() => setLoaded(true));
    } else {
      setLoaded(true);
    }
  }, []);

  // Returning `true` unconditionally keeps App.js's 2s fallback timer moot on
  // web while the swap happens in the background.
  return [true, null];
}