# HostelKeep — Hostel Cleaning Management

HostelKeep is a web and mobile app that helps hostels and hotels manage daily
room cleaning. Managers build a digital floor plan, assign rooms to cleaners,
and track progress in real time. Cleaners see only their own rooms, mark beds
as cleaned or skipped, leave notes, and request extra rooms.

> Built with **React Native**, **Expo**, and **Firebase** (Firestore +
> Authentication). Runs entirely on Firebase's free **Spark** plan — no Cloud
> Functions, no billing account required.

---

## ✨ Features

- 🏨 **Building setup** — floors, rooms (private / dorm), beds, custom attributes
- 👥 **Team management** — add cleaners, reset their passwords
- 📋 **Smart assignment** — assign rooms with per-bed instructions and room flags
- 🔍 **Manager dashboard** — search rooms, track progress, approve extra
  requests, review notes and extra time
- 🧹 **Cleaner view** — prioritised room list, interactive bed cards, extra-time
  toggle, photo-backed extra-room requests
- 📊 **Daily reports** — end-of-day Excel export with per-cleaner and per-bed
  breakdowns
- 🌍 **Multi-language** — English, Italian, Spanish
- 🔒 **Per-hostel isolation** enforced by Firestore security rules

---

## 📦 Tech stack

- [React Native](https://reactnative.dev/) via [Expo](https://expo.dev/) (SDK 54)
- [React Navigation](https://reactnavigation.org/) — native stack
- [Firebase](https://firebase.google.com/) — Authentication + Firestore
- [i18next](https://www.i18next.com/) — translations
- Ionicons on native, [Lucide](https://lucide.dev/) on web

---

## 🚀 Getting started

### Prerequisites

- Node.js 20 or later
- A Firebase project with **Firestore** and **Authentication → Email/Password**
  enabled
- `npm install -g firebase-tools` for deployment

### 1. Install

```bash
git clone <your-repo-url>
cd KeepCleanBlank
npm install
```

### 2. Configure Firebase

Firebase Console → Project Settings → General → Your apps → Add app → Web, and
copy the config object.

Create `src/firebase.config.js` (gitignored):

```js
export const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};
```

These values are **not secrets** — they ship inside every client bundle. What
protects your data is `firestore.rules`, not this file.

`src/firebase.js` (web) and `src/firebase.native.js` both read from it, so the
two platforms cannot drift apart.

### 3. Deploy the security rules

```bash
firebase deploy --only firestore:rules
```

**Do this before anyone signs up.** A database left in test mode is readable and
writable by anyone who knows the project ID.

### 4. Run

```bash
npx expo start
```

Press `w` for the browser, or scan the QR code with Expo Go.

---

## 🔐 How authentication works

Users sign in with **hostel code + username + password** — not an email address.
Firebase Auth requires an email, so each account gets a synthetic internal one
(`cleaner_<random>_<hostelcode>@keepclean.app`) that is never shown to anyone.

Translating a username into that email has to happen *before* sign-in, so it
can't read a protected collection. That lookup lives in its own collection:

```
loginLookup/{HOSTELCODE_username} → { email, hostelCode, recoveryEmail? }
```

The rules allow `get` but deny `list`, so a document can only be read by an
**exact ID that the caller already knows**. The collection cannot be enumerated
or dumped, and `users` — which holds emails, roles and device tokens — stays
fully private.

Every write to `users` is mirrored into `loginLookup`. `create` fails if the
document already exists, which enforces username uniqueness within a hostel for
free.

---

## 🔒 Security

- Authentication is handled by Firebase Authentication. The app never stores,
  hashes or transmits passwords itself.
- `firestore.rules` enforces per-hostel isolation on every collection.
- Clients **cannot** modify their own `role` or `hostelCode` — the update rule
  allows only `pushToken` and `recoveryEmail`. This is what prevents a cleaner
  from promoting themselves to manager of another hostel.
- Cleaners may only write status for rooms assigned to them, and cannot
  overwrite manager notes or bed instructions.
- Extra-room requests can only be approved or rejected by a manager.
- Request photos are cleared as soon as a request is resolved.
- The forgot-password flow returns the same message whether or not an account
  exists, so it can't be used to enumerate usernames.

### Known limitations on the Spark plan

Fixing these requires Cloud Functions, which requires the paid Blaze plan:

- **Push tokens are readable by teammates.** Notifications are sent client-side,
  so a cleaner can read their managers' device tokens. Same-hostel only.
- **Deleting a cleaner leaves an orphaned Firebase Auth account.** It is inert —
  every rule begins by reading `users/{uid}`, which no longer exists — but the
  row stays in the Authentication console. Clean up manually now and then.
- **Password reset recreates the account.** Room assignments are migrated to the
  new UID, but the old auth account remains.
- **Login rate limiting is Firebase Auth's default only.**
- **A manager with no recovery email who forgets their password cannot be
  reset by anyone.** Always set a recovery email when creating a hostel.

---

## 📁 Project structure

```
App.js                      # Root: providers + navigation
index.js                    # Expo entry point
firestore.rules             # Security rules — deploy these
src/
├── components/             # Shared UI (UI.js, Icon.js, Card/, Dashboard/)
├── contexts/
│   ├── AuthContext.js      # Sign-in, account creation, password reset
│   ├── AppContext.js       # Hostel data + Firestore listeners
│   └── NotificationContext.js
├── screens/
│   ├── LoginScreen.js      # + .web.js variant
│   ├── CreateHostelScreen.js
│   ├── CleanerScreen.js
│   └── manager/            # Dashboard, Setup, Team, Assign, Reports, History
├── theme.js                # Palette used by native screens
├── theme/                  # Palette used by web screens + Dashboard components
├── fonts.js                # + fonts.web.js — font loading shim
├── utils/                  # responsive.js, dailyReport.js
├── i18n.js
└── firebase.js             # + firebase.native.js, firebase.config.js
```

> **Note:** there are currently two theme modules with slightly different
> values. `src/theme.js` (scaled spacing, numeric keys) is used by the native
> screens; `src/theme/*.js` (fixed spacing, named keys) by the web screens and
> `components/Dashboard/*`. Consolidating them is a known piece of tidying.

---

## 🌍 Translations

English, Italian and Spanish live in `src/i18n.js`. To add a language, add an
entry to the `resources` object — all display strings already go through `t()`.

---

## 🧪 Building

### Web

```bash
npm run export
firebase deploy --only hosting
```

### Mobile

```bash
eas build -p android --profile preview
eas build -p ios --profile preview      # requires an Apple Developer account
```

> **Mobile is not store-ready yet.** `app.json` still needs iOS permission
> strings (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`) and the
> `expo-image-picker` / `expo-notifications` config plugins. Without them the
> App Store rejects the build and the app crashes when a cleaner opens the
> camera. Two features are also mobile-incomplete: managers cannot approve
> extra requests, and cleaners do not register push tokens.

---

## 📄 Privacy

`privacy.html` is copied into the web build by `scripts/copy-privacy.js` on
`postexport`, and served at `/privacy.html`.