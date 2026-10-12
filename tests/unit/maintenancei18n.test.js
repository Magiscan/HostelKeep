/**
 * Maintenance translations. The general i18n test checks that the three
 * languages match each other; this one checks that every maintenance string
 * the CODE asks for actually exists. A missing key doesn't crash — it quietly
 * shows the English fallback to Italian and Spanish users, which is exactly
 * how it slips through manual testing in English.
 */
import fs from 'fs';
import path from 'path';
import MAINT from '../../src/i18n.maintenance';

const SRC = path.resolve(__dirname, '../../src');
const FILES = [
  'hooks/useMaintenance.js',
  'screens/MaintenanceScreen.js',
  'screens/manager/MaintenanceBoardScreen.js',
  'screens/manager/MaintenanceBoardScreen.desktop.js',
  'components/maintenance/CleanerMaintenanceSection.js',
  'components/maintenance/DueDatePicker.js',
  'components/maintenance/DueDatePicker.web.js',
  'components/maintenance/savePhoto.js',
  'components/maintenance/savePhoto.web.js',
  'components/maintenance/MaintenanceParts.js',
  'components/maintenance/MaintenanceUpsell.js',
  'components/maintenance/ReportIssueSheet.js',
  'components/maintenance/TaskDetailSheet.js',
  'components/maintenance/TaskFormSheet.js',
  'components/maintenance/TeamSwitch.js',
  'components/maintenance/maintenanceUi.js',
].filter(f => fs.existsSync(path.join(SRC, f)));

// Keys this file owns. Shared keys like 'cancel' or 'error' live in i18n.js.
const OWNED = /^(maint\.|maint[A-Z]|notifMaint|teamSwitch|contactProPlus|sidebarMaintenance|secMaintenance|actionNewTask$|teamLabel$|teamHousekeepingHint$|teamMaintenanceHint$)/;

const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
};
const bundles = { en: flatten(MAINT.en), it: flatten(MAINT.it), es: flatten(MAINT.es) };
const placeholders = (s) => [...s.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(m => m[1]).sort().join(',');

const used = new Map();   // key → first file that uses it
for (const f of FILES) {
  const src = fs.readFileSync(path.join(SRC, f), 'utf8');
  for (const m of src.matchAll(/\b(?:t|tr|i18n\.t)\(\s*'([^']+)'/g)) {
    if (OWNED.test(m[1]) && !used.has(m[1])) used.set(m[1], f);
  }
}

test('the scan found the maintenance code', () => {
  expect(FILES.length).toBeGreaterThan(5);
  expect(used.size).toBeGreaterThan(50);
});

for (const lng of ['en', 'it', 'es']) {
  test(`every maintenance key used in the code exists in ${lng}`, () => {
    const missing = [...used.keys()].filter(k => !(k in bundles[lng])).map(k => `${k}  (${used.get(k)})`);
    expect(missing).toEqual([]);
  });
}

test('status, priority and tab labels built at runtime all exist', () => {
  const dynamic = [
    ...['reported', 'open', 'in_progress', 'on_hold', 'done', 'dismissed'].map(s => `maint.status.${s}`),
    ...['low', 'medium', 'high', 'urgent'].map(p => `maint.priority.${p}`),
    ...['review', 'open', 'closed', 'current'].map(k => `maint.boardTab.${k}`),
  ];
  for (const lng of ['en', 'it', 'es']) {
    expect(dynamic.filter(k => !(k in bundles[lng]))).toEqual([]);
  }
});

test('Italian and Spanish have exactly the English keys', () => {
  const en = Object.keys(bundles.en).sort();
  expect(Object.keys(bundles.it).sort()).toEqual(en);
  expect(Object.keys(bundles.es).sort()).toEqual(en);
});

test('placeholders match in every language', () => {
  const bad = [];
  for (const [k, v] of Object.entries(bundles.en)) {
    for (const lng of ['it', 'es']) {
      if (k in bundles[lng] && placeholders(bundles[lng][k]) !== placeholders(v)) bad.push(`${lng}:${k}`);
    }
  }
  expect(bad).toEqual([]);
});

test('the English fallbacks written in the code match the translation file', () => {
  // t('maint.x', 'Fallback') — if the two drift, English users and the
  // fallback path show different wording.
  const drift = [];
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(SRC, f), 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'(maint\.[^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g)) {
      const key = m[1];
      const fallback = m[2].replace(/\\'/g, "'");
      if (key in bundles.en && bundles.en[key] !== fallback) drift.push(`${key}: "${fallback}" vs "${bundles.en[key]}"`);
    }
  }
  expect(drift).toEqual([]);
});