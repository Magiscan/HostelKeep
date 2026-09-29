// src/services/email.js
//
// Transactional mail on the Firebase Spark plan. There are no Cloud Functions
// and no Extensions, so mail is sent client-side through EmailJS.
//
// WHY NOT @emailjs/browser: that SDK reads browser globals (`location`,
// `localStorage`) that don't exist in React Native. That was the
// "Property 'location' doesn't exist" warning, and it meant no welcome email was
// ever sent from the Android app. The REST endpoint below is what the SDK calls
// under the hood, and a plain fetch works the same on web and native.
//
// EmailJS dashboard → Account → Security:
//   • "Allow EmailJS API for non-browser applications" must be ON, or every
//     call from the Android app is rejected with 403.
//   • "Allowed origins" only protects calls made from a browser. Native requests
//     carry no Origin header, so the public key below can be reused by anyone
//     who unpacks the app. Check Email History now and then; if you see sends
//     you didn't cause, rotate the public key and ship an update.
//
// Free tier: 200 requests/month. One request per hostel created.

const ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

const SERVICE_ID = 'service_ent2pnj';
const WELCOME_TEMPLATE_ID = 'template_yv989ip';
const PUBLIC_KEY = 'VadQA8HKnjAkRoMFh';

// Where the welcome email's button goes. Email is outside the app, so it may
// point at pricing (Google Play's Payments policy only restricts in-app steering).
export const PRICING_URL = 'https://hostelkeep.com/#pricing';

const TIMEOUT_MS = 15000;

/** The exact body EmailJS expects. Exported so it can be unit-tested. */
export function buildWelcomePayload({ toEmail, managerName, hostelName, code }) {
  return {
    service_id: SERVICE_ID,
    template_id: WELCOME_TEMPLATE_ID,
    user_id: PUBLIC_KEY,
    template_params: {
      to_email: toEmail,
      manager_name: managerName,
      hostel_name: hostelName,
      hostel_code: code,
      // The template still calls this variable sign_in_url. Its button text
      // should now read something like "See HostelKeep Pro".
      sign_in_url: PRICING_URL,
    },
  };
}

/**
 * Sends the hostel code to a new manager.
 *
 * Callers must treat this as best-effort: the code is always shown on screen,
 * so a delivery failure is an inconvenience, never a reason to unwind a hostel
 * that already exists. It throws with EmailJS's own message so the caller's
 * console.warn says WHY (e.g. "403: API calls are disabled for non-browser
 * applications").
 */
export async function sendWelcomeEmail(params) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildWelcomePayload(params)),
      signal: controller ? controller.signal : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`EmailJS ${res.status}: ${text || res.statusText || 'request failed'}`);
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}