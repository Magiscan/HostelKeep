# HostelKeep

Housekeeping and maintenance management for hostels. Managers assign rooms and beds, housekeepers clean them from their phone, and everyone sees progress live. Maintenance problems are reported with a photo, assigned, and tracked until fixed.

- **Phone app** (Android and iOS) for owners, housekeepers and maintenance workers
- **Web app** at [app.hostelkeep.com](https://app.hostelkeep.com) with a full desktop dashboard for owners and manager-side staff
- **Marketing site** at [hostelkeep.com](https://hostelkeep.com) (separate project, hosted on Lovable)

Built with React Native + Expo (one codebase for Android, iOS and web) on Firebase's free Spark plan, with a Cloudflare Worker for email and push.

Published by **KohCiao Studio di Casasco Matteo** · support@hostelkeep.com

---

## Contents

1. [Features and plans](#features-and-plans)
2. [Roles](#roles)
3. [Tech stack](#tech-stack)
4. [Architecture](#architecture)
5. [Getting started](#getting-started)
6. [Project structure](#project-structure)
7. [Data model](#data-model)
8. [Authentication](#authentication)
9. [Security rules](#security-rules)
10. [Subscriptions](#subscriptions)
11. [Notifications and email](#notifications-and-email)
12. [Translations](#translations)
13. [Testing](#testing)
14. [Deploying](#deploying)
15. [Store publishing](#store-publishing)
16. [Conventions](#conventions)
17. [Known limitations](#known-limitations)

---

## Features and plans

| Feature | Free | Pro | Pro+ |
| --- | :---: | :---: | :---: |
| Floors, rooms (private / dorm), beds, room attributes | ✓ | ✓ | ✓ |
| Housekeeper accounts, password reset | ✓ | ✓ | ✓ |
| Room and per-bed assignment with instructions | ✓ | ✓ | ✓ |
| Housekeeper app: assigned rooms, bed-by-bed status, notes, extra time | ✓ | ✓ | ✓ |
| Extra-room requests with photo, approve / reject | ✓ | ✓ | ✓ |
| In-app and push notifications | ✓ | ✓ | ✓ |
| Web desktop dashboard | | ✓ | ✓ |
| Excel export of the day (web) | | ✓ | ✓ |
| Several properties per owner, hostel switcher (web) | | ✓ | ✓ |
| Live board ("Live activities") | | ✓ | ✓ |
| Saved daily history | | ✓ | ✓ |
| Manager-side staff accounts with custom roles and permissions | | ✓ | ✓ |
| Maintenance: report, triage, assign, checklists, due dates, photos, comments | | | ✓ |

Languages: English, Italian, Spanish.

Pro and Pro+ are sold directly to hostels (B2B, invoiced, bank transfer) and switched on manually. The store builds contain **no** purchase path; see [Subscriptions](#subscriptions).

---

## Roles

Stored in `users/{uid}.role`.

| Role | Who | Signs in with | Where |
| --- | --- | --- | --- |
| `manager` | **Owner.** Created the hostel. Every permission, can't be narrowed. Only role that edits roles and creates staff. | Real email + password | Phone app and web |
| `staff` | Manager-side account (reception, head housekeeper…). `roleId` points to a role in `hostels/{code}/config/roles`; every write is checked against that role's `perms`. Pro only. | Real email + password | Web only |
| `cleaner` | Housekeeper. With `team: 'maintenance'` they are a maintenance worker and see the maintenance screen instead of rooms. | Hostel code + username + password | Phone app |

Staff permission keys (`src/utils/permissions.js`): `assign`, `approve`, `editRooms`, `manageTeam`, `export`, `maintenance`. Visible sections: `dashboard`, `rooms`, `assign`, `team`, `extraRequests`, `maintenance`, `reports`, `history`.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI framework | React 19.1, React Native 0.81 (New Architecture on) |
| App platform | Expo SDK 54, EAS Build / EAS Submit |
| Web | react-native-web 0.21, bundled by Metro, served by Firebase Hosting |
| Navigation | React Navigation 7 (native stack, bottom tabs) |
| Animation / gestures | Reanimated 4, Gesture Handler, Worklets |
| Database | Cloud Firestore (real-time listeners) |
| Auth | Firebase Authentication, email + password |
| Server logic | Firestore security rules (no Cloud Functions on Spark) |
| Edge API | Cloudflare Worker at `api.hostelkeep.com` (`/welcome`, `/push`) |
| Email | Resend (called by the Worker) |
| Push | Expo Push Service → FCM (Android) / APNs (iOS) |
| Crash reporting | Sentry (`@sentry/react-native`, EU region, no PII) |
| i18n | i18next + react-i18next, expo-localization |
| Storage on device | AsyncStorage (auth session, language) |
| Images | expo-image-picker, expo-image-manipulator (stored as base64 in Firestore) |
| Files | xlsx-js-style (Excel reports), expo-file-system + expo-sharing |
| Dates | @react-native-community/datetimepicker |
| Fonts / icons | Fredoka, Rubik (Google Fonts), Material Symbols Rounded |
| Tests | Jest + jest-expo (unit), `@firebase/rules-unit-testing` + Firestore emulator (rules) |
| Domains / DNS | Cloudflare Registrar and DNS |

---

## Architecture

```
            ┌───────────────────────── one codebase (Expo) ─────────────────────────┐
            │  Android app (EAS)      iOS app (EAS)      Web app (Metro → dist/)    │
            └─────────┬──────────────────────┬─────────────────────┬────────────────┘
                      │ Firebase JS SDK       │                     │
                      ▼                       ▼                     ▼
             ┌────────────────────────────────────────────────────────────┐
             │ Firebase (Spark)                                           │
             │  • Authentication   • Firestore + security rules           │
             │  • Hosting: app.hostelkeep.com (+ /privacy, /delete-account)│
             └────────────────────────────────────────────────────────────┘
                      │ ID token
                      ▼
             ┌──────────────────────────────┐      ┌──────────┐
             │ Cloudflare Worker            │ ───▶ │ Resend   │  welcome email
             │ api.hostelkeep.com           │      └──────────┘
             │  /welcome   /push            │ ───▶ Expo Push ──▶ FCM / APNs
             └──────────────────────────────┘
                                                    Sentry ◀── crash reports (all clients)
```

Key ideas:

- **No backend code of our own on Firebase.** The Spark plan has no Cloud Functions, so all logic runs in the client and `firestore.rules` is the only server-side guard. Every new write path needs a matching rule.
- **The Worker** exists for the two things a client can't do safely: sending email with a secret API key, and sending push from the web (browsers can't call Expo's push API directly because of CORS). It verifies the caller's Firebase ID token first.
- **Real-time everywhere.** Screens subscribe with `onSnapshot` through `AppContext` and `useMaintenance`; there is no polling and no REST API.

---

## Getting started

### Prerequisites

- Node.js 20+
- `npm install -g firebase-tools eas-cli`
- Access to the Firebase project `keepclean-hostel` and the Expo account `tryout2000`

### Install and run

```bash
git clone https://github.com/Magiscan/KeepCleanBlank.git
cd KeepCleanBlank
npm install
npx expo start          # press w for web, or scan the QR with a development build
```

Native modules (camera, notifications, date picker, Sentry) mean **Expo Go is not enough** for the phone app. Make a development or preview build:

```bash
eas build -p android --profile preview     # installable APK
```

### Firebase config

The client config is public by design (it ships in every bundle); security comes from `firestore.rules`.

- Web: `src/firebase.js` (also starts App Check with reCAPTCHA v3)
- Native: `src/firebase.native.js` (Auth persisted with AsyncStorage)
- Android push: `google-services.json` (package `com.hostelkeep.app`)

Both files must point to the same project. Metro picks `.native.js` on phones and `.js` on web.

---

## Project structure

```
App.js                         Root: providers, Sentry, fonts, role-based routing
app.json / eas.json            Expo config, build profiles, submit profiles
firestore.rules                Security rules: the only server-side guard
firestore.indexes.json         Composite indexes
firebase.json                  Hosting (dist/), headers, rewrites, emulators
public/                        privacy.html, delete-account.html (served on app.hostelkeep.com)
web/index.html                 Web shell (Google Fonts, Material Symbols)
scripts/check-store-compliance.js   Pre-build store policy check
migrate-login-lookup.js        One-off Admin SDK migration (historic)
tests/unit/                    Jest unit tests
tests/rules/                   Firestore rules tests (emulator)

src/
├── contexts/
│   ├── AuthContext.js         Sign-in, hostel creation, cleaner accounts, password, migration
│   ├── AppContext.js          Hostel data listeners, subscription, roles, permissions (can())
│   └── NotificationContext.js In-app notification inbox
├── hooks/
│   ├── useMaintenance.js      Maintenance provider: tasks, actions, photo cleanup
│   ├── usePushRegistration.js Expo push token → users/{uid}.pushToken
│   ├── useDailyLogAutosave.js Saves the day to dailyLogs (Pro)
│   ├── useOwnedHostels.js     Multi-property owners
│   ├── useBreakpoint.js       Web breakpoints (768 / 1100 px)
│   └── useAvatarPicker.js
├── screens/
│   ├── LoginScreen(.web).js, CreateHostelScreen(.web).js, AccountScreen.js
│   ├── CleanerScreen.js       Housekeeper home
│   ├── MaintenanceScreen.js   Maintenance worker home
│   └── manager/
│       ├── ManagerApp.js      Phone manager shell (tabs)
│       ├── ManagerLayout.web.js  Desktop shell (sidebar) → *.desktop.js screens
│       └── Assign, Setup, Team, ExtraRequests, Reports, History, Roles, Paywall, MaintenanceBoard…
├── components/
│   ├── brand/                 Design-system pieces: Glass, sheets, pickers, toasts, RoomCard
│   ├── Dashboard/             Web dashboard: Sidebar, PageHeader, Drawer, KPI cards, tables
│   ├── maintenance/           Report/task sheets, due-date picker, team switch, upsell
│   └── BottomSheet.js, Icon(.web).js, UI.js
├── services/
│   ├── push.js                → api.hostelkeep.com/push
│   ├── email.js               → api.hostelkeep.com/welcome
│   └── sentry.js              Init + PII scrubbing
├── utils/                     assignment, dailyLog, dailyReport (Excel), permissions,
│                              subscription, accountDeletion, notify, maintenanceSchedule,
│                              photoRetention, cleanerColor, responsive
├── theme/                     Design tokens (tokens.js), colors, typography, spacing, radius, shadows
├── i18n.js, i18n.maintenance.js
└── firebase.js, firebase.native.js
```

### Platform file suffixes

| Suffix | Picked by | Used for |
| --- | --- | --- |
| `X.js` | Metro, all platforms | Default (phone) |
| `X.web.js` | Metro, automatically on web | Web-only variants (`LoginScreen.web.js`, `Icon.web.js`, `savePhoto.web.js`) |
| `X.native.js` | Metro, automatically on Android/iOS | `firebase.native.js` |
| `X.desktop.js` | **Imported explicitly** by `ManagerLayout.web.js` | Desktop versions of manager screens |

---

## Data model

```
users/{uid}                 username, role, hostelCode (active), hostelCodes[] (owners),
                            email, recoveryEmail, roleId (staff), team (cleaners),
                            pushToken, photoUri, tutorialSeenAt, …
loginLookup/{CODE_username} email, hostelCode           ← pre-auth lookup for cleaners
hostelCodes/{code}          uid, createdAt              ← who reserved the code; never deleted
billing/{code}              status, currentPeriodEnd, tier ('pro' | 'proplus'), plan, note
hostels/{code}              name, code, logoUri, …
  ├─ floors/{id}
  ├─ rooms/{id}             name, floorId, type, beds, attributes, assignedTo
  ├─ roomStatus/{roomId}    bed statuses, notes, managerNotes, assignmentBedStatus, extra time
  ├─ extraRequests/{roomId} cleanerId, status, imageBase64 (≤ 700 KB)
  ├─ notifications/{id}     type, message, roomId, read, timestamp
  ├─ dailyLogs/{date}       saved snapshot of the day (Pro)
  ├─ config/roles           { roles: { [roleId]: { name, sections[], perms[] } } }
  └─ maintenance/{taskId}   title, description, places[], area, priority, status,
       │                    assignees[], reportedBy, dueAt, checklist[], photoCount, …
       ├─ photos/{id}       data (base64), by, at, kind
       └─ comments/{id}     text, by, at
```

Photos are stored as compressed base64 strings in Firestore (Spark has no free Cloud Storage writes from clients in this setup). Large payloads live in subcollections so list queries stay light. Maintenance photos are deleted 30 days after a task is finished (`utils/photoRetention.js`, run by a manager's app).

---

## Authentication

- **Owners and staff** sign in with their real email. It is also their password-reset address.
- **Housekeepers and maintenance workers** sign in with **hostel code + username + password**. Firebase Auth needs an email, so each gets a synthetic one, `cleaner_<random>_<code>@keepclean.app`, that never receives mail.
- To turn code + username into that email *before* sign-in, the app reads `loginLookup/{CODE_username}`. Rules allow `get` by exact ID and deny `list`, so the collection can't be enumerated.
- A manager resets a cleaner's password by recreating the account and moving their rooms to the new UID (the client SDK can't change another user's password).
- Accounts created before the real-email change are migrated on first sign-in (`needsEmailMigration`).
- The synthetic domain is `keepclean.app` for historic reasons: existing accounts use it. Don't change it.

---

## Security rules

`firestore.rules` is the backend. Highlights:

- Every check starts by reading the caller's `users/{uid}`; a deleted profile makes an account inert.
- `role`, `hostelCode` and `roleId` can't be changed by their owner. Switching or adding hostels is owner-only, and only for codes the caller reserved in `hostelCodes`.
- Staff writes are checked against `config/roles` → `perms`; reads of history, extra requests and maintenance against `sections`.
- Paid features are enforced server-side via `isPaid()` / `isProPlus()` (with a 3-day grace period). Housekeepers are never blocked by billing, and deleting is never blocked.
- `billing/*` is read-only for everyone; only the Firebase console / Admin SDK writes it.

**Rules and clients ship together.** A mismatch has locked real users out before. Always deploy rules in the same release as the web app, and before a store build that depends on them.

---

## Subscriptions

- A new hostel has **no** `billing` document = Free.
- To activate, create `billing/{HOSTELCODE}` in the Firebase console:

```js
{
  status: 'active',              // 'trialing' | 'active' | 'past_due' | 'canceled'
  currentPeriodEnd: <Timestamp>, // access ends 3 days after this
  tier: 'proplus',               // optional; missing = Pro
  plan: 'monthly',               // your own bookkeeping
  note: 'Invoice 2026-014'
}
```

- `src/utils/subscription.js` mirrors the rules (`GRACE_DAYS`, statuses, tier).
- **Store compliance:** `SALES_ALLOWED` is `true` only on web. Phone builds show no prices, buttons, emails or links to buy. On iOS the Pro teaser and the Pro+ team options are hidden for hostels that don't have them (App Store 3.1.1 / 3.1.3(c)). `npm run check:store` fails the build if a purchase path leaks into a store-shipped file.

---

## Notifications and email

- **In-app:** documents in `hostels/{code}/notifications`, with deterministic IDs (type + room + day) so client writers never create duplicates.
- **Push:** the phone registers an Expo push token into `users/{uid}.pushToken`. To notify, the client calls `POST api.hostelkeep.com/push` with its Firebase ID token; the Worker checks it and forwards to Expo, which delivers through FCM (Android, using the FCM V1 key stored in EAS) or APNs (iOS, key created by EAS).
- **Welcome email:** `POST api.hostelkeep.com/welcome` → Worker → Resend.
- Push and email are best-effort: a failure never undoes the Firestore write.

The Worker's source lives outside this repo (Cloudflare dashboard / its own project).

---

## Translations

- `src/i18n.js` (core) and `src/i18n.maintenance.js` (maintenance), each with `en`, `it`, `es`.
- Language: saved choice in AsyncStorage, otherwise the device language, otherwise English.
- Every key must exist in all three languages; `tests/unit/i18n.test.js` and `maintenancei18n.test.js` fail otherwise.

---

## Testing

```bash
npm test                  # unit tests (jest-expo)
npm run test:rules        # rules tests on the Firestore emulator (needs Java)
npm run check:store       # store policy check on code and config
npm run check:store:online  # + checks the live privacy and deletion pages
```

Run all four before every production build.

---

## Deploying

### Backend and web (together)

```bash
npm run export                                               # builds dist/
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Hosting serves the web app at `app.hostelkeep.com` plus `/privacy` and `/delete-account` from `public/`.

### Phone apps (EAS)

```bash
eas build -p android --profile preview      # APK for testing
eas build -p android --profile production   # AAB for Google Play
eas build -p ios --profile production       # IPA for the App Store
eas submit -p android --latest              # → Play internal track, draft
eas submit -p ios --latest                  # → App Store Connect / TestFlight
```

- `appVersionSource: remote` + `autoIncrement`: EAS manages `versionCode` / `buildNumber`. Bump `version` in `app.json` for user-visible releases.
- Production builds need `SENTRY_AUTH_TOKEN` in EAS env (source maps and debug symbols).
- A new **native** dependency (anything with native code, e.g. the date picker) needs a new build; a JS-only change still needs a build too (no `expo-updates`).

Secrets never committed: `play-service-account.json`, `serviceAccountKey.json`, keystores, `.p8` keys (see `.gitignore`).

---

## Store publishing

| | Android | iOS |
| --- | --- | --- |
| ID | `com.hostelkeep.app` | `com.hostelkeep.app` |
| Account | Play Console, organization (D-U-N-S) | Apple Developer Program, individual (sole proprietor) |
| Devices | Phones | iPhone only (`supportsTablet: false`) |
| Privacy | Data safety form | App Privacy labels + privacy manifest in `app.json` |
| Account deletion | In app (Account → Delete account) + app.hostelkeep.com/delete-account | Same |
| Reviewer access | Demo hostel on Free, owner + housekeeper logins | Same, in App Review notes |

Step-by-step guides: *HostelKeep — Publishing on Google Play* and *HostelKeep — Publishing on the App Store* (project docs).

---

## Conventions

- **Design source of truth:** the prototype HTML export. Take exact values (sizes, colors, spacing) from it; it overrides this README.
- **Tokens:** `src/theme/tokens.js`. Navy `#0B1F3A`, gold `#F5B32B`, Fredoka 600 for display and numbers, Rubik 400/500/600 for UI, Material Symbols Rounded icons, pill radius 26.
- **Redesigns don't touch logic.** Visual changes keep business logic intact.
- **Long lists use `SectionList`**, not `ScrollView` (virtualization).
- **Cleaner colors:** sort cleaner IDs and index into the fixed palette (`buildCleanerColors`) so every screen agrees.
- **Android dialogs:** use `BottomSheet` (Modal), not absolute overlays.
- **Android crop:** `allowsEditing` is off (it breaks with edge-to-edge); crop with `expo-image-manipulator`.
- **Web-only code** may use CSS strings and `position: fixed` in `.web.js` files.
- **Deterministic IDs** over read-then-write deduplication.
- Production builds strip `console.*` (`babel-plugin-transform-remove-console`).

---

## Known limitations

Mostly consequences of running without Cloud Functions (Spark plan):

- Deleting a housekeeper or staff member removes their profile, but their Firebase Auth row stays (inert). Clean up in the console now and then.
- A cleaner password reset creates a new UID; the old auth row stays (inert).
- Push tokens of hostel members are readable by other members of the same hostel.
- Subscriptions are activated by hand in the console.
- Maintenance photo cleanup runs only when a manager with Pro+ opens the board.
- Photos as base64 in Firestore count against document size (1 MiB) and the free quota; uploads are compressed and capped.

### Housekeeping to do

- `lucide-react` is in `dependencies` but unused; `expo-secure-store` is installed and listed as a plugin but not used.
- `firebase/storage` and `firebase/functions` are initialised in `src/firebase.js` but unused.
- `functions/` contains only a `package.json` (no Cloud Functions are deployed).
- `src/theme.js` (older palette used by some native screens) and `src/theme/` overlap; consolidate into `src/theme/tokens.js`.