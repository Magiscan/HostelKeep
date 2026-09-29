import {
  describeSubscription, GRACE_DAYS, SALES_ALLOWED, contactMailto,
} from '../../src/utils/subscription';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);
// Stands in for a Firestore Timestamp: describeSubscription only calls toMillis().
const ts = (ms) => ({ toMillis: () => ms });

describe('describeSubscription', () => {
  test('no billing document: locked, and not an error', () => {
    const s = describeSubscription(null, NOW);
    expect(s).toMatchObject({ exists: false, active: false, incomplete: false });
  });

  test('active with time left', () => {
    const s = describeSubscription({ status: 'active', currentPeriodEnd: ts(NOW + 10 * DAY) }, NOW);
    expect(s).toMatchObject({ active: true, inGrace: false, isTrial: false, daysLeft: 10 });
  });

  test('trial with time left', () => {
    const s = describeSubscription({ status: 'trialing', currentPeriodEnd: ts(NOW + 3 * DAY) }, NOW);
    expect(s).toMatchObject({ active: true, isTrial: true });
  });

  test('period ended but inside the grace window: still open, flagged as grace', () => {
    const s = describeSubscription({ status: 'active', currentPeriodEnd: ts(NOW - DAY) }, NOW);
    expect(s).toMatchObject({ active: true, inGrace: true, daysLeft: 0 });
  });

  test('past the grace window: locked', () => {
    const end = NOW - (GRACE_DAYS * DAY) - 1;
    const s = describeSubscription({ status: 'active', currentPeriodEnd: ts(end) }, NOW);
    expect(s.active).toBe(false);
  });

  test('canceled is locked even with time left', () => {
    const s = describeSubscription({ status: 'canceled', currentPeriodEnd: ts(NOW + 10 * DAY) }, NOW);
    expect(s).toMatchObject({ active: false, incomplete: false });
  });

  test('date typed as text in the console: incomplete and locked, like the rules', () => {
    const s = describeSubscription({ status: 'active', currentPeriodEnd: '2026-12-31' }, NOW);
    expect(s).toMatchObject({ active: false, incomplete: true });
  });

  test('misspelt status: incomplete and locked', () => {
    const s = describeSubscription({ status: 'actve', currentPeriodEnd: ts(NOW + 10 * DAY) }, NOW);
    expect(s).toMatchObject({ active: false, incomplete: true });
  });
});

describe('store builds do not sell', () => {
  // jest-expo's default preset runs as a native platform, like the Play build.
  test('SALES_ALLOWED is false on native', () => {
    expect(SALES_ALLOWED).toBe(false);
  });
});

describe('contactMailto (web only)', () => {
  test('includes the hostel code, safely encoded', () => {
    const url = contactMailto({
      intent: 'trial', hostelCode: 'ABC234', hostelName: 'Sunset & Co', email: 'a@b.com',
    });
    expect(url.startsWith('mailto:')).toBe(true);
    expect(decodeURIComponent(url)).toContain('ABC234');
    expect(url).not.toContain('Sunset & Co');   // the ampersand must be encoded
  });
});
