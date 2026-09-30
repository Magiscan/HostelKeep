// src/services/sentry.js
//
// Crash and error reporting. One place for everything Sentry-related, so the
// privacy policy and the Play Data safety form can be checked against this file.
//
// WHAT IS SENT: the error, its stack trace, device model / OS version, app
// version, and two tags (role, hostelCode).
// WHAT IS NOT SENT: names, usernames, email addresses, IP addresses
// (sendDefaultPii: false, plus "Prevent storing of IP addresses" in the Sentry
// project settings), screenshots, session replays.
//
// The DSN is not a secret: it only allows SENDING events to this project.
// It is safe in the app bundle.

import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

// Paste the DSN from Sentry → Project Settings → Client Keys (DSN).
// An EU-region DSN contains "ingest.de.sentry.io".
const SENTRY_DSN = 'https://a2a5e5b0f7f3afe343a62de7762597d5@o4512172771704832.ingest.de.sentry.io/4512172777996368';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const scrub = (s) => (typeof s === 'string' ? s.replace(EMAIL, '[email]') : s);

// Some console.warn lines and Firebase errors can contain an email address
// (sign-in failures, "No user document for …"). Strip them before sending.
function scrubEvent(event) {
  delete event.user;
  if (event.message) event.message = scrub(event.message);
  event.exception?.values?.forEach((v) => { v.value = scrub(v.value); });
  event.breadcrumbs?.forEach((b) => { b.message = scrub(b.message); });
  return event;
}

function scrubBreadcrumb(crumb) {
  crumb.message = scrub(crumb.message);
  if (crumb.data?.url) crumb.data.url = scrub(crumb.data.url);
  return crumb;
}

let started = false;

export function initSentry() {
  if (started) return;
  started = true;

  Sentry.init({
    dsn: SENTRY_DSN,
    // Development sessions (expo start, dev builds) never report.
    enabled: !__DEV__ && !SENTRY_DSN.includes('REPLACE_ME'),
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    // Errors only. No performance tracing, no profiling, no session replay:
    // nothing to add to the privacy policy beyond crash reports, and the free
    // plan's quota goes to errors.
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });

  Sentry.setTag('platform', Platform.OS);
}

/**
 * Called whenever the signed-in user changes. Only the role and the hostel
 * code: enough to see "this crash hits housekeepers of hostel X", no identity.
 */
export function setSentryContext(user) {
  if (!started) return;
  Sentry.setTag('role', user?.role || 'signed_out');
  Sentry.setTag('hostelCode', user?.hostelCode || 'none');
}

/** For the preview-only diagnostics panel: proves events reach Sentry. */
export function sendSentryTestEvent() {
  Sentry.captureException(new Error(`Sentry test from ${Platform.OS} at ${new Date().toISOString()}`));
}

export { Sentry };