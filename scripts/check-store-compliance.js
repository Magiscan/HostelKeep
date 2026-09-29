#!/usr/bin/env node
/**
 * Pre-build store compliance check. Run before every production build:
 *
 *   npm run check:store          # code and config only
 *   npm run check:store:online   # also checks the live privacy/deletion pages
 *
 * (PowerShell swallows a bare `--`, so `npm run check:store -- --online`
 * silently drops the flag there. Use the second script instead.)
 *
 * Exits with code 1 on any problem, so it can gate `eas build` in a script.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const problems = [];
const notes = [];
const fail = (msg) => problems.push(msg);
const rel = (p) => path.relative(ROOT, p);
const read = (p) => fs.readFileSync(p, 'utf8');

// Code only: comments that merely MENTION a banned API must not trip the check.
// The `[^:]` guard keeps the // inside URLs like https://example.com.
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
const readCode = (p) => stripComments(read(p));

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = [...walk(path.join(ROOT, 'src')), path.join(ROOT, 'App.js')].filter((f) => fs.existsSync(f));
const isWebOnly = (f) => /\.web\.(js|jsx|ts|tsx)$/.test(f);

/* 1. Nothing in a store-shipped file may lead to a purchase
      (Google Play Payments policy), unless it sits behind SALES_ALLOWED. */
const SALES_PATTERNS = [
  /contactMailto\s*\(/,
  /['"]pro\.subscribe['"]/,
  /early-access/,
  /app\.hostelkeep\.com/,
  /#pricing/,
  /intent:\s*['"](trial|subscribe)['"]/,
];
// Files allowed to contain these: the definitions themselves, and email
// (sent outside the app, where promotion is allowed).
const SALES_EXEMPT = new Set([
  path.join('src', 'utils', 'subscription.js'),
  path.join('src', 'services', 'email.js'),
]);

for (const f of files) {
  if (isWebOnly(f) || SALES_EXEMPT.has(rel(f))) continue;
  const src = readCode(f);
  const hits = SALES_PATTERNS.filter((re) => re.test(src));
  if (!hits.length) continue;
  if (!src.includes('SALES_ALLOWED')) {
    fail(`${rel(f)}: purchase path in a file that ships in the Play build, with no SALES_ALLOWED gate (${hits.join(', ')})`);
  } else {
    notes.push(`${rel(f)}: purchase path gated by SALES_ALLOWED. Check by eye that every match is inside the gate.`);
  }
}

/* 2. Known-bad code anywhere */
const BANNED = [
  [/(from\s+|require\(\s*)['"]@emailjs\/browser['"]/, 'imports @emailjs/browser, which fails on native (no `location`)'],
  [/\bMediaTypeOptions\./, 'uses deprecated ImagePicker.MediaTypeOptions'],
  [/keepclean-hostel\.web\.app/, 'links to the old Firebase domain'],
  // One contact address everywhere: CONTACT_EMAIL in src/utils/subscription.js.
  // Delete this line if hello@kohciao.com is a real, monitored inbox.
  [/hello@kohciao\.com/, 'uses hello@kohciao.com instead of CONTACT_EMAIL'],
];
for (const f of files) {
  const src = readCode(f);
  for (const [re, msg] of BANNED) if (re.test(src)) fail(`${rel(f)}: ${msg}`);
}

/* 3. app.json */
try {
  const app = JSON.parse(read(path.join(ROOT, 'app.json'))).expo;
  const android = app.android || {};
  if (app.slug !== 'hostelkeep') fail(`app.json: slug is "${app.slug}"`);
  if (android.package !== 'com.hostelkeep.app') fail(`app.json: android.package is "${android.package}"`);
  if (app.ios?.bundleIdentifier !== 'com.hostelkeep.app') fail(`app.json: ios.bundleIdentifier is "${app.ios?.bundleIdentifier}"`);
  if (!app.extra?.eas?.projectId) fail('app.json: extra.eas.projectId is missing');

  const requested = android.permissions || [];
  const blocked = android.blockedPermissions || [];
  for (const p of ['android.permission.READ_MEDIA_IMAGES', 'android.permission.RECORD_AUDIO']) {
    if (requested.includes(p)) fail(`app.json: ${p} is requested`);
    if (!blocked.includes(p)) fail(`app.json: ${p} is not in blockedPermissions`);
  }
  if (!fs.existsSync(path.join(ROOT, android.googleServicesFile || 'google-services.json'))) {
    fail('app.json: googleServicesFile does not exist on disk');
  } else {
    const gs = JSON.parse(read(path.join(ROOT, android.googleServicesFile || 'google-services.json')));
    const pkgs = (gs.client || []).map((c) => c.client_info?.android_client_info?.package_name);
    if (!pkgs.includes('com.hostelkeep.app')) fail('google-services.json has no client for com.hostelkeep.app');
  }
} catch (e) {
  fail(`app.json could not be read: ${e.message}`);
}

/* 4. package.json */
try {
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
  if (pkg.dependencies?.['expo-dev-client']) fail('package.json: expo-dev-client is in dependencies');
  if (pkg.dependencies?.['@emailjs/browser']) fail('package.json: @emailjs/browser is still installed');
} catch (e) {
  fail(`package.json could not be read: ${e.message}`);
}

/* 5. Secrets stay out of git */
const giPath = path.join(ROOT, '.gitignore');
const gi = fs.existsSync(giPath) ? read(giPath) : '';
for (const name of ['play-service-account.json', 'serviceAccountKey.json']) {
  if (!gi.includes(name)) fail(`.gitignore does not list ${name}`);
}
if (gi.includes('\u0000')) fail('.gitignore still contains the UTF-16 line (NUL bytes)');

/* 6. Live pages (optional) */
async function checkOnline() {
  const pages = [
    'https://hostelkeep.com/privacy',
    'https://hostelkeep.com/it/privacy',
    'https://hostelkeep.com/es/privacy',
    'https://hostelkeep.com/delete-account',
    'https://app.hostelkeep.com',
  ];
  for (const url of pages) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.status !== 200) { fail(`${url} returned ${res.status}`); continue; }
      if (url.includes('/privacy') || url.includes('/delete-account')) {
        const html = await res.text();
        // Pages the app links to must not lead on to a payment method.
        if (/#pricing|early-access|Start with Pro|Choose Pro/i.test(html)) {
          fail(`${url} links to pricing or sign-up; the app links here, so it must not`);
        }
      }
    } catch (e) {
      fail(`${url} unreachable: ${e.message}`);
    }
  }
}

(async () => {
  if (process.argv.includes('--online')) await checkOnline();

  notes.forEach((n) => console.log(`  note: ${n}`));
  if (problems.length) {
    console.error(`\n✗ Store compliance: ${problems.length} problem(s)`);
    problems.forEach((p) => console.error(`  • ${p}`));
    process.exit(1);
  }
  console.log('\n✓ Store compliance checks passed');
})();