// src/services/push.js
//
// Sends push notifications through our Cloudflare Worker (api.hostelkeep.com/push)
// instead of calling Expo directly. Two reasons:
//
//   1. Browsers can't call Expo's push API (CORS), so every push triggered from
//      the web app (a manager approving a request on the desktop dashboard, a
//      housekeeper using app.hostelkeep.com) used to be dropped silently.
//   2. The Worker looks up the recipients' tokens itself, so this device never
//      needs to read anyone else's push token.
//
// Best-effort, like before: callers .catch() and log. A failed push must never
// undo the Firestore write that caused it; the in-app notification still exists.

import { auth } from '../firebase';

export const PUSH_ENDPOINT = 'https://api.hostelkeep.com/push';
const TIMEOUT_MS = 10000;

async function post(payload) {
  const user = auth.currentUser;
  if (!user) return null;               // signed out mid-action: nothing to do
  const idToken = await user.getIdToken();

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  try {
    const res = await fetch(PUSH_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Push ${res.status}: ${out.error || res.statusText}`);
    if (out.errors?.length) console.warn('Push not delivered:', out.errors.join(', '));
    return out;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Every manager and staff member of the caller's current hostel (not the caller). */
export const pushToManagers = (title, body, data) =>
  post({ to: 'managers', title, body, data });

/** One user in the caller's hostel, e.g. the housekeeper a room was assigned to. */
export const pushToUser = (uid, title, body, data) =>
  post({ to: { uid }, title, body, data });