import { sendWelcomeEmail, buildWelcomePayload, PRICING_URL } from '../../src/services/email';

const params = {
  toEmail: 'maria@example.com',
  managerName: 'Maria',
  hostelName: 'Sunset Hostel',
  code: 'ABC234',
};

beforeEach(() => {
  global.fetch = jest.fn();
});

test('payload has the shape EmailJS expects', () => {
  const p = buildWelcomePayload(params);
  expect(p.service_id).toMatch(/^service_/);
  expect(p.template_id).toMatch(/^template_/);
  expect(p.user_id).toBeTruthy();
  expect(p.template_params).toEqual({
    to_email: 'maria@example.com',
    manager_name: 'Maria',
    hostel_name: 'Sunset Hostel',
    hostel_code: 'ABC234',
    sign_in_url: PRICING_URL,
  });
});

test('the email button points at pricing, not the paywalled web app', () => {
  expect(PRICING_URL).toBe('https://hostelkeep.com/#pricing');
});

test('posts JSON to the EmailJS REST endpoint', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'OK' });
  await sendWelcomeEmail(params);

  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toBe('https://api.emailjs.com/api/v1.0/email/send');
  expect(init.method).toBe('POST');
  expect(init.headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(init.body).template_params.hostel_code).toBe('ABC234');
});

test('surfaces EmailJS\'s reason when native calls are not enabled', async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 403,
    statusText: 'Forbidden',
    text: async () => 'API calls are disabled for non-browser applications',
  });
  await expect(sendWelcomeEmail(params)).rejects.toThrow(/403.*non-browser/);
});

test('a network failure rejects, so the caller can log it and carry on', async () => {
  global.fetch.mockRejectedValue(new Error('Network request failed'));
  await expect(sendWelcomeEmail(params)).rejects.toThrow('Network request failed');
});
