// src/utils/subscription.js
//
// What "paid" means, in one place. Mirrors isPaid() in firestore.rules — if you
// change a number here, change it there too. Like permissions.js, this file
// decides what to RENDER; the rules decide what is ALLOWED.
//
// SHAPE ON DISK — billing/{hostelCode} (top-level, NOT under hostels/, because
// owners can write anything under hostels/{code}/config):
//
//   {
//     status: 'trialing' | 'active' | 'past_due' | 'canceled',
//     currentPeriodEnd: Timestamp,     // access ends GRACE_DAYS after this
//     // optional, for your own records:
//     plan: 'trial' | 'monthly' | 'yearly',
//     note: 'Trial requested by email 16/09',
//   }
//
// No app user can create, update or delete this document. A new hostel starts
// with none — unsubscribed — and every trial or subscription is switched on by
// you in the Firebase console after the owner gets in touch.

export const GRACE_DAYS = 3;            // keep in sync with firestore.rules
export const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'];
const KNOWN_STATUSES = [...ACTIVE_STATUSES, 'canceled'];
export const CONTACT_EMAIL = 'kohciaostudio@gmail.com';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Firestore Timestamp | Date | millis | ISO string → millis, or null. */
export function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Everything the UI needs to know about one hostel's subscription.
 * `billing` is the raw document data, or null when it doesn't exist.
 */
export function describeSubscription(billing, nowMs = Date.now()) {
  if (!billing) {
    return {
      exists: false, active: false, status: 'none', endsAt: null, accessUntil: null,
      daysLeft: 0, inGrace: false, isTrial: false, incomplete: false,
    };
  }
  const status = billing.status || 'none';
  // Only a real Firestore timestamp counts — the rules reject a date typed as
  // text, so the app must not accept one either.
  const endsAt = billing.currentPeriodEnd && typeof billing.currentPeriodEnd.toMillis === 'function'
    ? billing.currentPeriodEnd.toMillis()
    : null;
  const accessUntil = endsAt == null ? null : endsAt + GRACE_DAYS * DAY_MS;
  const active = ACTIVE_STATUSES.includes(status) && accessUntil != null && nowMs < accessUntil;
  const daysLeft = endsAt == null ? 0 : Math.max(0, Math.ceil((endsAt - nowMs) / DAY_MS));

  return {
    exists: true,
    active,
    status,
    endsAt,
    accessUntil,
    daysLeft,
    // Past the period end but still let in: the renewal hasn't been recorded.
    inGrace: active && endsAt != null && nowMs >= endsAt,
    isTrial: status === 'trialing',
    // A document that can never grant access because of a console mistake:
    // misspelt status, or the date missing / saved as text. The paywall says so
    // instead of "your subscription has ended".
    incomplete: !KNOWN_STATUSES.includes(status) || endsAt == null,
  };
}

/** Pre-filled email for a trial request or a subscription. */
export function contactMailto({ intent = 'subscribe', hostelCode, hostelName, email }) {
  const subject = intent === 'trial'
    ? `HostelKeep free trial request — ${hostelCode}`
    : `HostelKeep Pro subscription — ${hostelCode}`;
  const opening = intent === 'trial'
    ? "Hi, I'd like to try HostelKeep with a free trial."
    : "Hi, I'd like to subscribe to HostelKeep Pro.";
  const body = [
    opening,
    '',
    `Hostel: ${hostelName || ''}`,
    `Hostel code: ${hostelCode || ''}`,
    `Account email: ${email || ''}`,
    '',
  ].join('\n');
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}