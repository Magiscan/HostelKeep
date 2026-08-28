// src/components/Icon.web.js
//
// WHY THIS FILE EXISTS
// Icon.js uses @expo/vector-icons, which renders glyphs by CODEPOINT out of a
// bundled MaterialIcons.ttf. That works in dev because the dev server serves the
// font from node_modules. In a deployed static build the .ttf has to be exported
// and served by your host — and when it isn't, every icon becomes a tofu
// rectangle, because the codepoints fall through to a font that has no glyphs
// at those positions. That's the bug you're seeing.
//
// On web we already load "Material Symbols Rounded" from Google Fonts in
// web/index.html. That font is a LIGATURE font: you render the icon's name as
// text and the font substitutes the glyph. No font binary of ours to serve, no
// hosting configuration to get wrong, and Google's CDN is a more reliable
// origin than our own bundle.
//
// The one hazard is the gap before the font arrives, when the literal text
// "check_circle" would be visible. We wait on document.fonts and render nothing
// until it's ready — a brief blank is much better than words where icons go.
//
// Metro picks this file automatically on web; Icon.js stays as the native path.
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { COLORS } from '../theme/colors';

const FONT = 'Material Symbols Rounded';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:' +
  'opsz,wght,FILL@20..48,400..700,0..1&display=block';

// Module-level so every icon shares one wait, and later mounts skip it.
let fontReady = false;
let fontFailed = false;
let fontPromise = null;

/**
 * Make sure the stylesheet is actually on the page.
 *
 * We inject it here rather than relying on web/index.html because the deployed
 * index.html is not always the one you edited — Expo's web export uses the
 * template only if it finds it, and a stale hosting directory serves an older
 * copy. Injecting at runtime makes the icons independent of that.
 */
function ensureStylesheet() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('hk-material-symbols')) return;
  const link = document.createElement('link');
  link.id = 'hk-material-symbols';
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

/**
 * Wait until the family is genuinely usable.
 *
 * `document.fonts.load()` is NOT sufficient on its own: if the family has no
 * @font-face declaration it resolves immediately with zero faces and reports
 * success. That is why icons rendered as raw text — the promise resolved, the
 * font did not exist. `document.fonts.check()` is the honest signal, so we poll
 * it and give up after a bounded wait.
 */
function waitForFont() {
  if (fontReady || fontFailed) return Promise.resolve();
  if (fontPromise) return fontPromise;

  fontPromise = (async () => {
    ensureStylesheet();

    if (typeof document === 'undefined' || !document.fonts) {
      fontFailed = true;
      return;
    }

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      try {
        if (document.fonts.check(`24px "${FONT}"`)) { fontReady = true; return; }
        await document.fonts.load(`24px "${FONT}"`, 'check_circle');
        if (document.fonts.check(`24px "${FONT}"`)) { fontReady = true; return; }
      } catch (_) { /* keep trying until the deadline */ }
      await new Promise(r => setTimeout(r, 150));
    }

    // Five seconds is long past "slow network". Something is blocking the CDN
    // — a CSP, an ad blocker, an offline device. Render blanks rather than
    // leaking "check_circle" into the interface.
    fontFailed = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[Icon] "Material Symbols Rounded" did not load. Icons will be blank. ' +
      'Check that fonts.googleapis.com is reachable and not blocked by CSP.',
    );
  })();

  return fontPromise;
}

// Old Ionicons names → Material Symbols. Kept identical to Icon.js so both
// platforms accept the same props.
const LEGACY_MAP = {
  'grid-outline': 'grid_view',
  'grid': 'grid_view',
  'construct-outline': 'construction',
  'construct': 'construction',
  'people-outline': 'group',
  'people': 'group',
  'person-circle-outline': 'account_circle',
  'person-remove-outline': 'person_remove',
  'swap-horizontal-outline': 'swap_horiz',
  'swap-horizontal': 'swap_horiz',
  'search-outline': 'search',
  'close': 'close',
  'close-circle': 'cancel',
  'close-circle-outline': 'cancel',
  'refresh': 'refresh',
  'refresh-circle': 'refresh',
  'pencil': 'edit',
  'create-outline': 'edit',
  'key-outline': 'key',
  'globe-outline': 'language',
  'log-out-outline': 'logout',
  'chevron-up': 'expand_less',
  'chevron-down': 'expand_more',
  'chevron-left': 'chevron_left',
  'chevron-right': 'chevron_right',
  'arrow-back': 'arrow_back',
  'arrow-forward': 'arrow_forward',
  'checkmark': 'check',
  'checkmark-circle': 'check_circle',
  'checkmark-done-outline': 'done_all',
  'checkbox-outline': 'check_box',
  'add-circle-outline': 'add_circle',
  'layers-outline': 'layers',
  'options-outline': 'tune',
  'download-outline': 'download',
  'ellipsis-vertical': 'more_vert',
  'trash-outline': 'delete',
  'hourglass-outline': 'hourglass_empty',
  'send-outline': 'send',
  'alarm-outline': 'notifications',
  'notifications-outline': 'notifications',
  'time-outline': 'schedule',
  'bed-outline': 'bed',
  'home-outline': 'home',
  'ellipse-outline': 'radio_button_unchecked',
  'flash-outline': 'bolt',
  'eye-outline': 'visibility',
  'eye-off-outline': 'visibility_off',
  'alert-circle': 'error',
  'calendar-outline': 'calendar_today',
  'print-outline': 'print',
  'flag-outline': 'flag',
  'flag': 'flag',
  'document-text-outline': 'description',
  'settings-outline': 'settings',
  'camera-outline': 'photo_camera',
  'image-outline': 'image',
  'lock-closed-outline': 'lock',
  'information-circle-outline': 'info',
  'help-circle-outline': 'help',
  'star-outline': 'star',
  'star': 'star',
  'bar-chart-outline': 'bar_chart',
  'sparkles-outline': 'auto_awesome',
  'brush-outline': 'cleaning_services',
  'moon-outline': 'bedtime',
  'person-add-outline': 'person_add',
  'person-add': 'person_add',
  'bunk_bed': 'bed',
};

function resolveName(name) {
  if (!name) return 'help';
  return LEGACY_MAP[name] || name;
}

export default function Icon({
  name,
  size = 22,
  color = COLORS.textStrong,
  filled = false,
  style,
}) {
  const [ready, setReady] = useState(fontReady);

  useEffect(() => {
    if (ready) return undefined;
    let alive = true;
    waitForFont().then(() => { if (alive) setReady(fontReady); });
    return () => { alive = false; };
  }, [ready]);

  const glyph = resolveName(name);

  // Reserve the space so nothing reflows when the glyph appears. If the font
  // failed outright we keep rendering this blank forever — an empty square is
  // a far smaller failure than the word "check_circle" in the middle of a
  // button.
  if (!ready || fontFailed) {
    return <Text style={[{ width: size, height: size }, style]} />;
  }

  return (
    <Text
      selectable={false}
      style={[
        {
          fontFamily: FONT,
          fontSize: size,
          lineHeight: size,
          width: size,
          height: size,
          color,
          textAlign: 'center',
          // FILL is a variable axis on this font — free on web, unlike native.
          fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'opsz' ${size}`,
          // Ligature substitution is what turns "check_circle" into a glyph.
          fontFeatureSettings: '"liga"',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        },
        style,
      ]}
    >
      {glyph}
    </Text>
  );
}