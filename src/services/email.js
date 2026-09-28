  // src/services/email.js
  //
  // Transactional mail on the Firebase Spark plan. There are no Cloud Functions
  // and no Extensions, so mail is sent client-side through EmailJS, which holds
  // the SMTP credentials on its own servers — nothing secret ships in the bundle.
  //
  // The public key is public by design. Protect the quota by whitelisting your
  // origins in the EmailJS dashboard (Account → Security → Allowed origins).
  //
  // Free tier: 200 requests/month, 2 templates. One request per hostel created.

  import emailjs from '@emailjs/browser';

  const SERVICE_ID = 'service_ent2pnj';
  const WELCOME_TEMPLATE_ID = 'template_yv989ip';
  const PUBLIC_KEY = 'VadQA8HKnjAkRoMFh';

  const SIGN_IN_URL = 'https://hostelkeep.com/#pricing';

  /**
   * Sends the hostel code to a new manager.
   *
   * Callers must treat this as best-effort: the code is always shown on screen,
   * so a delivery failure is an inconvenience, never a reason to unwind a hostel
   * that already exists.
   */

  emailjs.init({
    publicKey: PUBLIC_KEY,
    limitRate: { id: 'hostelkeep-welcome', throttle: 60000 },
  });

  export async function sendWelcomeEmail({ toEmail, managerName, hostelName, code }) {
    return emailjs.send(
      SERVICE_ID,
      WELCOME_TEMPLATE_ID,
      {
        to_email: toEmail,
        manager_name: managerName,
        hostel_name: hostelName,
        hostel_code: code,
        sign_in_url: SIGN_IN_URL,
      },
      { publicKey: PUBLIC_KEY },
    );
  }