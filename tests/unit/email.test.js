jest.mock('../../src/firebase', () => ({
  auth: { currentUser: { getIdToken: jest.fn(async () => 'id-token-123') } },
}));
jest.mock('../../src/i18n', () => ({ language: 'it-IT' }));

import { auth } from '../../src/firebase';
import { sendWelcomeEmail, WELCOME_ENDPOINT, PRICING_URL } from '../../src/services/email';

const params = {
  toEmail: 'maria@example.com',
  managerName: 'Maria',
  hostelName: 'Sunset Hostel',
  code: 'ABC234',
};

beforeEach(() => {
  global.fetch = jest.fn();
  auth.currentUser = { getIdToken: jest.fn(async () => 'id-token-123') };
});

test('the email button points at pricing, not the paywalled web app', () => {
  expect(PRICING_URL).toBe('https://hostelkeep.com/#pricing');
});

test('posts code and language to our Worker with the Firebase ID token', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
  await sendWelcomeEmail(params);

  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toBe(WELCOME_ENDPOINT);
  expect(init.method).toBe('POST');
  expect(init.headers.Authorization).toBe('Bearer id-token-123');
  expect(JSON.parse(init.body)).toEqual({ code: 'ABC234', lang: 'it' });
});

test('never sends a recipient address: the Worker takes it from the token', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
  await sendWelcomeEmail(params);
  expect(global.fetch.mock.calls[0][1].body).not.toContain('maria@example.com');
});

test("surfaces the Worker's reason", async () => {
  global.fetch.mockResolvedValue({
    ok: false, status: 403, statusText: 'Forbidden',
    json: async () => ({ error: 'not_manager_of_hostel' }),
  });
  await expect(sendWelcomeEmail(params)).rejects.toThrow(/403.*not_manager_of_hostel/);
});

test('uses the user passed in (secondary-app sign-up) instead of auth.currentUser', async () => {
  auth.currentUser = null;
  const firebaseUser = { getIdToken: jest.fn(async () => 'secondary-token') };
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
  await sendWelcomeEmail({ ...params, user: firebaseUser });
  expect(firebaseUser.getIdToken).toHaveBeenCalled();
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer secondary-token');
});

test('rejects when nobody is signed in', async () => {
  auth.currentUser = null;
  await expect(sendWelcomeEmail(params)).rejects.toThrow(/not signed in/);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('uses the user passed in, even when auth.currentUser is empty', async () => {
  auth.currentUser = null;
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
  const newUser = { getIdToken: jest.fn(async () => 'new-owner-token') };
  await sendWelcomeEmail({ ...params, user: newUser });
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer new-owner-token');
});

test('a network failure rejects, so the caller can log it and carry on', async () => {
  global.fetch.mockRejectedValue(new Error('Network request failed'));
  await expect(sendWelcomeEmail(params)).rejects.toThrow('Network request failed');
});