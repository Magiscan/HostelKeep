# KeepClean – Hostel Cleaning Management

KeepClean is a mobile app (iOS / Android / Web) that helps hostels and hotels manage daily room cleaning.  
Managers build a digital floor plan, assign rooms to cleaners, and track progress in real time.  
Cleaners see only their assigned rooms, can mark beds as cleaned or skipped, add notes, and request extra rooms.

> Built with **React Native**, **Expo**, and **Firebase** (Firestore + Authentication).

---

## ✨ Features

- 🏨 **Building setup wizard** – floors, rooms (private / dorm), beds, custom attributes
- 👥 **Team management** – add cleaners with secure accounts
- 📋 **Smart assignment** – assign rooms to cleaners with optional bed instructions and room flags
- 🔍 **Manager dashboard** – search rooms, view progress, approve extra requests, see notes & extra time
- 🧹 **Cleaner dashboard** – prioritised room list, interactive bed cards, clean‑all, extra‑time toggle
- 🌍 **Multi‑language** – English, Italian, Spanish (ready for more)
- 🔒 **Offline‑first, secure** – all data stored in Firestore with per‑hostel isolation

---

## 📦 Tech Stack

- [React Native](https://reactnative.dev/) (Expo managed workflow)
- [Expo Router](https://docs.expo.dev/router/introduction/) (file‑based routing)
- [Firebase](https://firebase.google.com/) (Auth, Firestore)
- [i18next](https://www.i18next.com/) (translations)
- [Ionicons](https://ionic.io/ionicons) (icons)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Expo CLI](https://docs.expo.dev/workflow/expo-cli/) (`npm install -g expo-cli` – or use `npx expo`)
- A [Firebase](https://firebase.google.com/) project with **Firestore** and **Authentication** (Email/Password) enabled

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/keepclean.git
cd keepclean
2. Install dependencies
bash
npm install
3. Set up Firebase
Create a new Firebase project at console.firebase.google.com.

Enable Firestore Database (start in production mode, then update rules later).

Enable Authentication → Email/Password sign‑in method.

Go to Project settings → General → Your apps → Add app → Web.

Copy the firebaseConfig object.

Create a file src/firebase.js:

javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
4. Set up Firestore security rules
Go to Firebase Console → Firestore → Rules and paste the content of firestore.rules from this repository (or use the rules shown in the Firebase setup guide).

5. Start the development server
bash
npx expo start
Press w to open in your browser.

Scan the QR code with Expo Go (Android/iOS) to test on a real device.

For a full native build, run npx expo run:android or npx expo run:ios.

🌍 Translations
The app supports English, Italian, and Spanish.
Translations are managed in src/i18n.js. To add a new language:

Add the language object to the resources object in src/i18n.js.

Wrap all display strings with the t() function (already done).

🧪 Building for production
Android APK
bash
eas build -p android --profile preview
iOS (requires Apple Developer account)
bash
eas build -p ios --profile preview
Configure your eas.json profiles as needed.

📁 Project Structure
text
src/
├── components/          # Reusable UI components (Button, Card, Chip, etc.)
├── contexts/            # React contexts (Auth, AppData)
├── i18n.js              # Translation setup
├── screens/             # All screens
│   ├── LoginScreen.js
│   ├── CreateHostelScreen.js
│   ├── CleanerScreen.js
│   └── manager/         # Manager screens (Dashboard, Setup, Team, Assign)
├── theme.js             # Colours, fonts, spacing
├── utils/               # Helper functions (responsive scaling)
└── firebase.js          # Firebase config
🔒 Security

Session tokens are managed by Firebase Authentication.

Firestore security rules enforce per‑hostel data isolation.

No sensitive data is stored in AsyncStorage without encryption.
