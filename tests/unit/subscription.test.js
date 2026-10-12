/**
 * Plan detection (src/utils/subscription.js). Must agree with isPaid() and
 * isProPlus() in firestore.rules — the rules tests check the server side.
 */
import { describeSubscription, contactMailto, GRACE_DAYS } from '../../src/utils/subscription';

const DAY = 24 * 3600 * 1000;
const NOW = new Date(2026, 9, 12, 12, 0).getTime();
const ts = (ms) => ({ toMillis: () => ms });
const billing = (o = {}) => ({ status: 'active', currentPeriodEnd: ts(NOW + 10 * DAY), ...o });

describe('Pro and Pro+', () => {
  test('no billing document: nothing', () => {
    const s = describeSubscription(null, NOW);
    expect(s.active).toBe(false);
    expect(s.proPlus).toBe(false);
  });

  test('active without tier is plain Pro', () => {
    const s = describeSubscription(billing(), NOW);
    expect(s.active).toBe(true);
    expect(s.tier).toBe('pro');
    expect(s.proPlus).toBe(false);
  });

  test('tier "proplus" unlocks Maintenance', () => {
    const s = describeSubscription(billing({ tier: 'proplus' }), NOW);
    expect(s.proPlus).toBe(true);
  });

  test('plan is the billing period, not the tier: plan "proplus" alone does nothing', () => {
    expect(describeSubscription(billing({ plan: 'proplus' }), NOW).proPlus).toBe(false);
    expect(describeSubscription(billing({ plan: 'monthly', tier: 'proplus' }), NOW).proPlus).toBe(true);
  });

  test('a trial can be Pro+', () => {
    expect(describeSubscription(billing({ status: 'trialing', tier: 'proplus' }), NOW).proPlus).toBe(true);
  });

  test(`Pro+ survives the ${GRACE_DAYS}-day grace period, then stops`, () => {
    const inGrace = billing({ tier: 'proplus', currentPeriodEnd: ts(NOW - 1 * DAY) });
    const after = billing({ tier: 'proplus', currentPeriodEnd: ts(NOW - (GRACE_DAYS + 1) * DAY) });
    expect(describeSubscription(inGrace, NOW).proPlus).toBe(true);
    expect(describeSubscription(after, NOW).proPlus).toBe(false);
  });

  test('canceled Pro+ is not Pro+', () => {
    expect(describeSubscription(billing({ status: 'canceled', tier: 'proplus' }), NOW).proPlus).toBe(false);
  });

  test('a date typed as text in the console never grants access (same as the rules)', () => {
    const s = describeSubscription(billing({ tier: 'proplus', currentPeriodEnd: '2030-01-01' }), NOW);
    expect(s.active).toBe(false);
    expect(s.proPlus).toBe(false);
    expect(s.incomplete).toBe(true);
  });

  test('a misspelt tier is plain Pro, never Pro+', () => {
    expect(describeSubscription(billing({ tier: 'pro+' }), NOW).proPlus).toBe(false);
    expect(describeSubscription(billing({ tier: 'PROPLUS' }), NOW).proPlus).toBe(false);
  });
});

describe('upgrade email', () => {
  test('the Pro+ request names Maintenance and the hostel code', () => {
    const url = decodeURIComponent(contactMailto({ intent: 'proplus', hostelCode: 'ABC234', hostelName: 'Sunset' }));
    expect(url).toMatch(/Pro\+ \(Maintenance\) — ABC234/);
    expect(url).toMatch(/Hostel code: ABC234/);
  });

  test('the ordinary Pro request is unchanged', () => {
    const url = decodeURIComponent(contactMailto({ intent: 'subscribe', hostelCode: 'ABC234' }));
    expect(url).toMatch(/HostelKeep Pro subscription — ABC234/);
  });
});