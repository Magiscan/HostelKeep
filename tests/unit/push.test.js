jest.mock('../../src/firebase', () => ({
  auth: { currentUser: null },
}));

import { auth } from '../../src/firebase';
import { pushToManagers, pushToUser, PUSH_ENDPOINT } from '../../src/services/push';

beforeEach(() => {
  global.fetch = jest.fn();
  auth.currentUser = { getIdToken: jest.fn(async () => 'id-token-xyz') };
});

const ok = (body = { ok: true, sent: 1, errors: [] }) =>
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => body });

test('managers push goes to the Worker with the ID token', async () => {
  ok();
  await pushToManagers('Room cleaned', '101 by Sara', { type: 'room_cleaned', roomId: 'r1' });

  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toBe(PUSH_ENDPOINT);
  expect(init.method).toBe('POST');
  expect(init.headers.Authorization).toBe('Bearer id-token-xyz');
  expect(JSON.parse(init.body)).toEqual({
    to: 'managers', title: 'Room cleaned', body: '101 by Sara',
    data: { type: 'room_cleaned', roomId: 'r1' },
  });
});

test('single-user push names the uid, never a push token', async () => {
  ok();
  await pushToUser('cleaner-uid', 'Approved', 'Room 12 is yours', { type: 'extra_approved' });
  const sent = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(sent.to).toEqual({ uid: 'cleaner-uid' });
  expect(JSON.stringify(sent)).not.toMatch(/PushToken/);
});

test('does nothing when signed out', async () => {
  auth.currentUser = null;
  await expect(pushToManagers('t', 'b')).resolves.toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("surfaces the Worker's reason on failure", async () => {
  global.fetch.mockResolvedValue({
    ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ error: 'invalid_token' }),
  });
  await expect(pushToManagers('t', 'b')).rejects.toThrow(/401.*invalid_token/);
});

test('logs Expo ticket errors without throwing', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  ok({ ok: true, sent: 0, errors: ['DeviceNotRegistered'] });
  await expect(pushToManagers('t', 'b')).resolves.toBeTruthy();
  expect(warn).toHaveBeenCalledWith('Push not delivered:', 'DeviceNotRegistered');
  warn.mockRestore();
});