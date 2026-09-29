/**
 * Translation checks. Runs with the unit tests (`npm test`).
 *
 * Catches the three things that silently break translations:
 *   1. A key that exists in one language but not another.
 *   2. A {{placeholder}} spelled differently in one language, which then
 *      prints literally as "{{name}}" on screen.
 *   3. Plural keys in the old `_plural` format, which current i18next ignores.
 * Then it renders a few real strings to prove interpolation works end to end.
 */
import i18n from '../../src/i18n';

const LANGS = ['en', 'it', 'es'];

// Flatten nested objects into dotted keys: { live: { title } } → 'live.title'.
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

const bundles = Object.fromEntries(
  LANGS.map((lng) => [lng, flatten(i18n.getResourceBundle(lng, 'translation'))]),
);

const placeholders = (s) => [...s.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();

describe('every language has the same keys', () => {
  const allKeys = [...new Set(LANGS.flatMap((l) => Object.keys(bundles[l])))].sort();

  for (const lng of LANGS) {
    test(`${lng} is not missing any key`, () => {
      const missing = allKeys.filter((k) => !(k in bundles[lng]));
      expect(missing).toEqual([]);
    });
  }
});

describe('placeholders match across languages', () => {
  const mismatches = [];
  for (const key of Object.keys(bundles.en)) {
    const expected = placeholders(bundles.en[key]).join(',');
    for (const lng of ['it', 'es']) {
      if (!(key in bundles[lng])) continue;   // reported by the test above
      const got = placeholders(bundles[lng][key]).join(',');
      if (got !== expected) mismatches.push(`${lng}.${key}: en has {${expected}}, ${lng} has {${got}}`);
    }
  }
  test('no language renames or drops a {{placeholder}}', () => {
    expect(mismatches).toEqual([]);
  });
});

describe('plural format', () => {
  test('no old-style _plural keys (i18next v21+ needs _one / _other)', () => {
    const old = LANGS.flatMap((l) => Object.keys(bundles[l]).filter((k) => k.endsWith('_plural')).map((k) => `${l}.${k}`));
    expect(old).toEqual([]);
  });

  test('English picks singular and plural correctly', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('assignSelected', { count: 1 })).toBe('Assign 1 room');
    expect(i18n.t('assignSelected', { count: 3 })).toBe('Assign 3 rooms');
  });

  test('Italian picks singular and plural correctly', async () => {
    await i18n.changeLanguage('it');
    expect(i18n.t('selectedRooms', { count: 1 })).toBe('1 stanza selezionata');
    expect(i18n.t('selectedRooms', { count: 4 })).toBe('4 stanze selezionate');
  });
});

describe('interpolation renders real values', () => {
  afterAll(() => i18n.changeLanguage('en'));

  test.each([
    ['en', 'greeting', { name: 'Maria' }, 'Maria'],
    ['it', 'cleanerRoomsStats', { done: 2, total: 5 }, '2/5'],
    ['es', 'notifRoomCleaned', { room: '101', cleaner: 'Luca' }, 'Luca'],
    ['it', 'live.roomsCleanedOf', { done: 3, total: 8 }, '3 di 8'],
  ])('%s %s', async (lng, key, vars, mustContain) => {
    await i18n.changeLanguage(lng);
    const out = i18n.t(key, vars);
    expect(out).toContain(mustContain);
    expect(out).not.toMatch(/\{\{/);   // nothing left un-substituted
  });
});