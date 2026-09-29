// src/services/email.js
//
// Transactional mail on the Firebase Spark plan, without Cloud Functions.
// The app calls our own Cloudflare Worker (hostelkeep-mail-worker), which:
//   • verifies the caller's Firebase ID token,
//   • checks in Firestore, with the caller's own token, that they manage `code`,
//   • sends the email through Resend to the address in the token.
// No email API key ships in the app any more (the EmailJS public key did).

import { auth } from '../firebase';
import i18n from '../i18n';

export const WELCOME_ENDPOINT = 'https://api.hostelkeep.com/welcome';

// Kept for the unit test and for anything else that links to pricing from email.
export const PRICING_URL = 'https://hostelkeep.com/#pricing';

const TIMEOUT_MS = 15000;

/**
 * Sends the hostel code to the new manager.
 *
 * Call it AFTER users/{uid} and hostels/{code} exist. Pass `user`: the Firebase
 * User you got back from createUserWithEmailAndPassword (`cred.user`). That
 * works even if the account was created on a secondary Firebase app, or if the
 * main `auth` isn't signed in to it yet. Without `user`, it falls back to
 * auth.currentUser. Call it before any signOut of that user.
 *
 * Best-effort: the code is always shown on screen, so a failure is logged by the
 * caller, never a reason to unwind a hostel that already exists. Throws with the
 * Worker's reason (e.g. "403 not_manager_of_hostel") so the log says why.
 *
 * `toEmail`, `managerName` and `hostelName` are still accepted so callers don't
 * change, but they're ignored: the Worker reads them from the token and Firestore.
 */
export async function sendWelcomeEmail({ code, user: givenUser }) {
  const user = givenUser || auth.currentUser;
  if (!user) throw new Error('Welcome email: not signed in (pass `user: cred.user`)');
  const idToken = await user.getIdToken();

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  try {
    const res = await fetch(WELCOME_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, lang: (i18n.language || 'en').slice(0, 2) }),
      signal: controller ? controller.signal : undefined,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(`Welcome email ${res.status}: ${data.error || res.statusText}${data.detail ? ` (${data.detail})` : ''}`);
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}