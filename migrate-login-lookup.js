/**
 * migrate-login-lookup.js
 *
 * One-off script. Reads every document in `users` and creates the matching
 * `loginLookup/{HOSTELCODE_username}` document, so existing accounts can sign
 * in under the new rules without being deleted and recreated.
 *
 * This is the Firebase ADMIN SDK, not a Cloud Function — it runs on your own
 * machine with a service account key. No Blaze plan required.
 *
 * Setup:
 *   1. Console → Project Settings (gear icon) → Service Accounts
 *   2. "Generate new private key" → downloads a JSON file
 *   3. Save it as serviceAccountKey.json in this same folder
 *   4. Add serviceAccountKey.json to .gitignore — NEVER commit it, it's a
 *      full-access credential for your project
 *   5. npm install firebase-admin --no-save    (--no-save: don't want this
 *      as a permanent app dependency, it's Admin-only)
 *
 * Run:
 *   node migrate-login-lookup.js            (dry run — prints, writes nothing)
 *   node migrate-login-lookup.js --apply    (writes for real)
 */

// firebase-admin v12+ uses the modular API: cert/initializeApp are top-level
// exports from 'firebase-admin/app', and firestore() moved to its own
// subpath. The old `admin.credential.cert()` / `admin.firestore()` namespace
// object no longer exists on the default import.
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(APPLY ? '=== APPLY MODE — writing for real ===' : '=== DRY RUN — no writes ===');
  console.log('');

  const usersSnap = await db.collection('users').get();

  if (usersSnap.empty) {
    console.log('No documents found in `users`. Nothing to do.');
    return;
  }

  const seenKeys = new Map(); // detect collisions before writing anything
  const rows = [];

  usersSnap.forEach((doc) => {
    const data = doc.data();
    const { username, hostelCode, email, role, recoveryEmail } = data;

    if (!username || !hostelCode || !email) {
      console.warn(`⚠ SKIPPING ${doc.id} — missing username/hostelCode/email:`, data);
      return;
    }

    const key = `${hostelCode.trim().toUpperCase()}_${username.trim()}`;

    if (seenKeys.has(key)) {
      console.error(
        `✗ COLLISION: "${key}" already claimed by uid ${seenKeys.get(key)}, ` +
        `also matches uid ${doc.id}. Two users have the same username in the ` +
        `same hostel — rename one of them in Firestore before running --apply.`,
      );
    }
    seenKeys.set(key, doc.id);

    rows.push({
      uid: doc.id,
      key,
      email,
      hostelCode: hostelCode.trim().toUpperCase(),
      role,
      username,
      ...(recoveryEmail ? { recoveryEmail } : {}),
    });
  });

  console.log(`Found ${rows.length} valid user document(s):\n`);
  rows.forEach((r) => {
    console.log(`  loginLookup/${r.key}`);
    console.log(`    email: ${r.email}`);
    console.log(`    role:  ${r.role}`);
    if (r.recoveryEmail) console.log(`    recoveryEmail: ${r.recoveryEmail}`);
    console.log('');
  });

  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to write these documents.');
    return;
  }

  const batch = db.batch();
  rows.forEach((r) => {
    const ref = db.collection('loginLookup').doc(r.key);
    const payload = { email: r.email, hostelCode: r.hostelCode };
    if (r.recoveryEmail) payload.recoveryEmail = r.recoveryEmail;
    batch.set(ref, payload);
  });

  await batch.commit();
  console.log(`✓ Wrote ${rows.length} loginLookup document(s).`);
  console.log('');
  console.log('Next: deploy the new client + rules, then test each account.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });