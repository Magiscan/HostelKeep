/**
 * KeepClean / HostelKeep — Cloud Functions
 *
 * Rewritten for firebase-functions v7 (2nd gen API) and firebase-admin v13.
 *
 * What changed and why:
 *  • v1 triggers (functions.firestore.document) are no longer exported from the
 *    package root as of firebase-functions v6. Everything is now v2.
 *  • admin.messaging().sendMulticast() was removed in firebase-admin v13.
 *    More importantly, the app stores EXPO push tokens
 *    (ExponentPushToken[...]), which FCM cannot deliver at all. Push is now
 *    sent to Expo's push service instead, server-side.
 *  • Account creation, password reset and deletion moved off the client so the
 *    Firestore rules can forbid clients writing `role` / `hostelCode`.
 *  • Notification documents are created HERE, not on the client. That removes
 *    the duplicate-notification problem and the client-side cleanup sweep.
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {setGlobalOptions} = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// Pick the region closest to your users. Keep this consistent with the
// `getFunctions(app, REGION)` call in src/firebase.js.
setGlobalOptions({region: "europe-west1", maxInstances: 10});

const EMAIL_DOMAIN = "keepclean.app";
const MIN_PASSWORD_LENGTH = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Expo push transport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends push notifications through Expo's push service.
 * Expo accepts at most 100 messages per request.
 * @param {string[]} tokens Expo push tokens.
 * @param {string} title Notification title.
 * @param {string} body Notification body.
 * @param {Object} data Arbitrary data payload.
 * @return {Promise<void>}
 */
async function sendExpoPush(tokens, title, body, data) {
  const valid = (tokens || []).filter(
      (t) => typeof t === "string" && t.startsWith("ExponentPushToken"),
  );
  if (valid.length === 0) return;

  for (let i = 0; i < valid.length; i += 100) {
    const chunk = valid.slice(i, i + 100);
    const messages = chunk.map((to) => ({
      to,
      title,
      body,
      data: data || {},
      sound: "default",
      priority: "high",
    }));

    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        logger.warn("Expo push HTTP error", {status: res.status});
        continue;
      }

      const payload = await res.json();
      const receipts = payload.data || [];
      // Prune tokens Expo tells us are dead, so they don't accumulate forever.
      await Promise.all(receipts.map(async (r, idx) => {
        if (r.status !== "error") return;
        const code = r.details && r.details.error;
        if (code !== "DeviceNotRegistered") return;
        const snap = await db.collection("users")
            .where("pushToken", "==", chunk[idx]).get();
        await Promise.all(
            snap.docs.map((d) => d.ref.update({
              pushToken: admin.firestore.FieldValue.delete(),
            })),
        );
      }));
    } catch (err) {
      logger.warn("Expo push failed", {error: err.message});
    }
  }
}

/**
 * Collects Expo push tokens for every manager of a hostel.
 * @param {string} hostelCode The hostel code.
 * @return {Promise<string[]>} Deduplicated token list.
 */
async function getManagerTokens(hostelCode) {
  const snap = await db.collection("users")
      .where("hostelCode", "==", hostelCode)
      .where("role", "==", "manager")
      .get();

  const tokens = new Set();
  snap.forEach((doc) => {
    const token = doc.data().pushToken;
    if (token) tokens.add(token);
  });
  return Array.from(tokens);
}

/**
 * Writes a notification document and pushes it to the hostel's managers.
 * Deduplicates against an existing unread notification for the same
 * room + type, matching the old client-side behaviour.
 * @param {string} hostelCode The hostel code.
 * @param {Object} notif Notification fields: type, message, roomId.
 * @return {Promise<void>}
 */
async function notifyManagers(hostelCode, notif) {
  const col = db.collection("hostels").doc(hostelCode).collection("notifications");

  const dupe = await col
      .where("roomId", "==", notif.roomId)
      .where("type", "==", notif.type)
      .where("read", "==", false)
      .limit(1)
      .get();
  if (!dupe.empty) return;

  await col.add({
    type: notif.type,
    message: notif.message,
    roomId: notif.roomId,
    read: false,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  const tokens = await getManagerTokens(hostelCode);
  await sendExpoPush(tokens, "KeepClean", notif.message, {
    type: notif.type,
    roomId: notif.roomId,
  });
}

/**
 * Resolves a room's display name, falling back to its document ID.
 * @param {string} hostelCode The hostel code.
 * @param {string} roomId The room document ID.
 * @return {Promise<string>} Display name.
 */
async function roomName(hostelCode, roomId) {
  const doc = await db.doc(`hostels/${hostelCode}/rooms/${roomId}`).get();
  return (doc.exists && doc.data().name) || roomId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared auth helpers for callables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads the calling user's profile, asserting they are a signed-in manager.
 * @param {Object} request The callable request.
 * @return {Promise<{uid: string, hostelCode: string}>} Caller profile.
 */
async function requireManager(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const snap = await db.doc(`users/${request.auth.uid}`).get();
  if (!snap.exists || snap.data().role !== "manager") {
    throw new HttpsError("permission-denied", "Manager access required.");
  }
  return {uid: request.auth.uid, hostelCode: snap.data().hostelCode};
}

/**
 * Simple fixed-window rate limiter backed by Firestore.
 * @param {string} key Bucket identifier.
 * @param {number} limit Maximum attempts per window.
 * @param {number} windowMs Window length in milliseconds.
 * @return {Promise<void>} Rejects with resource-exhausted when over limit.
 */
async function rateLimit(key, limit, windowMs) {
  const ref = db.collection("_rateLimits").doc(key);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;

    if (!data || now - data.windowStart > windowMs) {
      tx.set(ref, {windowStart: now, count: 1});
      return;
    }
    if (data.count >= limit) {
      throw new HttpsError(
          "resource-exhausted",
          "Too many attempts. Please wait a few minutes.",
      );
    }
    tx.update(ref, {count: data.count + 1});
  });
}

/**
 * Generates a random 6-character hostel code.
 * @return {string} The code.
 */
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusable 0/O/1/I
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Callable: resolveLogin
// Replaces the pre-auth `users` query in AuthContext.login(). Returns only an
// email address, and only for an exact hostelCode + username match.
// ─────────────────────────────────────────────────────────────────────────────

exports.resolveLogin = onCall(async (request) => {
  const hostelCode = String(request.data.hostelCode || "").trim().toUpperCase();
  const username = String(request.data.username || "").trim();

  if (!hostelCode || !username) {
    throw new HttpsError("invalid-argument", "Hostel code and username are required.");
  }

  // 10 attempts per 10 minutes per hostel+username pair.
  await rateLimit(
      `login_${hostelCode}_${username}`.replace(/[^A-Za-z0-9_]/g, "_"),
      10,
      10 * 60 * 1000,
  );

  const snap = await db.collection("users")
      .where("hostelCode", "==", hostelCode)
      .where("username", "==", username)
      .limit(2)
      .get();

  // Deliberately identical error for "no such user" and "no email on file", so
  // this endpoint cannot be used to enumerate valid accounts.
  if (snap.empty || !snap.docs[0].data().email) {
    throw new HttpsError("not-found", "Invalid username or hostel code.");
  }
  if (snap.size > 1) {
    logger.error("Duplicate username in hostel", {hostelCode, username});
    throw new HttpsError(
        "failed-precondition",
        "Duplicate account detected. Please contact your manager.",
    );
  }

  return {email: snap.docs[0].data().email};
});

// ─────────────────────────────────────────────────────────────────────────────
// Callable: requestPasswordReset
// Replaces the second pre-auth `users` query, in LoginScreen's
// handleForgotPassword. The old version returned different messages for
// "user not found" vs "synthetic email", which let anyone test whether a
// given username existed in a given hostel. This one always reports the
// same thing.
// ─────────────────────────────────────────────────────────────────────────────

exports.requestPasswordReset = onCall(async (request) => {
  const hostelCode = String(request.data.hostelCode || "").trim().toUpperCase();
  const username = String(request.data.username || "").trim();

  if (!hostelCode || !username) {
    throw new HttpsError("invalid-argument", "Hostel code and username are required.");
  }

  await rateLimit(
      `reset_${hostelCode}_${username}`.replace(/[^A-Za-z0-9_]/g, "_"),
      5,
      15 * 60 * 1000,
  );

  const snap = await db.collection("users")
      .where("hostelCode", "==", hostelCode)
      .where("username", "==", username)
      .limit(1)
      .get();

  // Uniform response regardless of outcome — never confirm or deny that an
  // account exists. The email is only sent when there is a real recovery
  // address on file.
  if (!snap.empty) {
    const recoveryEmail = snap.docs[0].data().recoveryEmail;
    if (recoveryEmail && !recoveryEmail.endsWith(`@${EMAIL_DOMAIN}`)) {
      try {
        const link = await auth.generatePasswordResetLink(recoveryEmail);
        // Firebase does not send this for you from the Admin SDK. Either wire
        // up your own mail provider here, or switch this function to return
        // the link over a channel you trust. Logging it is a stopgap for
        // development only.
        logger.info("Password reset link generated", {recoveryEmail, link});
      } catch (err) {
        logger.warn("Reset link generation failed", {error: err.message});
      }
    }
  }

  return {
    ok: true,
    message:
      "If a recovery email is on file for that account, a reset link has been sent.",
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Callable: createHostel
// Creates the manager auth account, their user document and the hostel document
// in one server-side operation. The client then signs in normally.
// ─────────────────────────────────────────────────────────────────────────────

exports.createHostel = onCall(async (request) => {
  const hostelName = String(request.data.hostelName || "").trim();
  const username = String(request.data.username || "").trim();
  const password = String(request.data.password || "");
  const recoveryEmail = String(request.data.recoveryEmail || "").trim();

  if (!hostelName || !username) {
    throw new HttpsError("invalid-argument", "Hostel name and username are required.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError(
        "invalid-argument",
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  // Find an unused hostel code.
  let code = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode();
    const existing = await db.doc(`hostels/${candidate}`).get();
    if (!existing.exists) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    throw new HttpsError("internal", "Could not allocate a hostel code. Try again.");
  }

  const email = `manager_${code.toLowerCase()}@${EMAIL_DOMAIN}`;

  let userRecord;
  try {
    userRecord = await auth.createUser({email, password});
  } catch (err) {
    logger.error("createHostel auth failure", {error: err.message});
    throw new HttpsError("internal", "Could not create the account. Try again.");
  }

  try {
    const batch = db.batch();
    batch.set(db.doc(`users/${userRecord.uid}`), {
      username,
      role: "manager",
      hostelCode: code,
      email,
      ...(recoveryEmail ? {recoveryEmail} : {}),
    });
    batch.set(db.doc(`hostels/${code}`), {
      name: hostelName,
      code,
      roomAttributes: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    // Don't leave an orphaned auth account behind.
    await auth.deleteUser(userRecord.uid).catch(() => {});
    logger.error("createHostel firestore failure", {error: err.message});
    throw new HttpsError("internal", "Could not create the hostel. Try again.");
  }

  return {code, email};
});

// ─────────────────────────────────────────────────────────────────────────────
// Callable: createCleaner
// Replaces the secondary-Firebase-app hack in AuthContext.registerCleaner().
// ─────────────────────────────────────────────────────────────────────────────

exports.createCleaner = onCall(async (request) => {
  const {hostelCode} = await requireManager(request);
  const username = String(request.data.username || "").trim();
  const password = String(request.data.password || "");

  if (!username) {
    throw new HttpsError("invalid-argument", "A username is required.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError(
        "invalid-argument",
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  // Enforce username uniqueness within the hostel — the old client code had no
  // such check, which silently locked one of the two users out of logging in.
  const clash = await db.collection("users")
      .where("hostelCode", "==", hostelCode)
      .where("username", "==", username)
      .limit(1)
      .get();
  if (!clash.empty) {
    throw new HttpsError(
        "already-exists",
        "Someone in your hostel already uses that name.",
    );
  }

  // Collision-proof, unlike the old Date.now()-based address.
  const email =
    `cleaner_${db.collection("_").doc().id.toLowerCase()}` +
    `_${hostelCode.toLowerCase()}@${EMAIL_DOMAIN}`;

  const userRecord = await auth.createUser({email, password});

  try {
    await db.doc(`users/${userRecord.uid}`).set({
      username,
      role: "cleaner",
      hostelCode,
      email,
    });
  } catch (err) {
    await auth.deleteUser(userRecord.uid).catch(() => {});
    throw new HttpsError("internal", "Could not create the cleaner account.");
  }

  return {uid: userRecord.uid};
});

// ─────────────────────────────────────────────────────────────────────────────
// Callable: resetCleanerPassword
// The old native implementation deleted and recreated the cleaner, which left
// the original Firebase Auth account alive (old password still worked!) and
// orphaned every `assignedTo` reference. This changes the password in place.
// ─────────────────────────────────────────────────────────────────────────────

exports.resetCleanerPassword = onCall(async (request) => {
  const {hostelCode} = await requireManager(request);
  const cleanerUid = String(request.data.cleanerUid || "");
  const newPassword = String(request.data.newPassword || "");

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError(
        "invalid-argument",
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  const target = await db.doc(`users/${cleanerUid}`).get();
  if (!target.exists || target.data().hostelCode !== hostelCode) {
    throw new HttpsError("not-found", "No such cleaner in your hostel.");
  }
  if (target.data().role !== "cleaner") {
    throw new HttpsError("permission-denied", "Only cleaner passwords can be reset here.");
  }

  await auth.updateUser(cleanerUid, {password: newPassword});
  // Force existing sessions on the old password to re-authenticate.
  await auth.revokeRefreshTokens(cleanerUid);

  return {ok: true};
});

// ─────────────────────────────────────────────────────────────────────────────
// Callable: deleteCleaner
// Removes the auth account as well as the document, and unassigns their rooms.
// ─────────────────────────────────────────────────────────────────────────────

exports.deleteCleaner = onCall(async (request) => {
  const {hostelCode} = await requireManager(request);
  const cleanerUid = String(request.data.cleanerUid || "");

  const target = await db.doc(`users/${cleanerUid}`).get();
  if (!target.exists || target.data().hostelCode !== hostelCode) {
    throw new HttpsError("not-found", "No such cleaner in your hostel.");
  }
  if (target.data().role !== "cleaner") {
    throw new HttpsError("permission-denied", "Only cleaners can be removed here.");
  }

  // Release their rooms so the assignments don't dangle.
  const assigned = await db.collection(`hostels/${hostelCode}/rooms`)
      .where("assignedTo", "==", cleanerUid).get();

  const batch = db.batch();
  assigned.forEach((doc) => batch.update(doc.ref, {assignedTo: null}));
  batch.delete(db.doc(`users/${cleanerUid}`));
  await batch.commit();

  await auth.deleteUser(cleanerUid).catch((err) => {
    logger.warn("Auth user already gone", {cleanerUid, error: err.message});
  });

  return {ok: true};
});

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: extra room requested
// ─────────────────────────────────────────────────────────────────────────────

exports.onExtraRequestCreated = onDocumentCreated(
    "hostels/{hostelCode}/extraRequests/{roomId}",
    async (event) => {
      const {hostelCode, roomId} = event.params;
      const name = await roomName(hostelCode, roomId);

      const snap = event.data;
      const cleanerId = snap && snap.data().cleanerId;
      let who = "a cleaner";
      if (cleanerId) {
        const cleaner = await db.doc(`users/${cleanerId}`).get();
        if (cleaner.exists) who = cleaner.data().username || who;
      }

      await notifyManagers(hostelCode, {
        type: "extra_request",
        message: `Extra room requested by ${who} for room ${name}`,
        roomId,
      });
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: room status changed
// Replaces the roomStatus watching that used to live in NotificationContext.
// ─────────────────────────────────────────────────────────────────────────────

exports.onRoomStatusUpdated = onDocumentUpdated(
    "hostels/{hostelCode}/roomStatus/{roomId}",
    async (event) => {
      const before = event.data.before.data() || {};
      const after = event.data.after.data() || {};
      const {hostelCode, roomId} = event.params;

      const events = [];

      if (after.cleaned && !before.cleaned) {
        events.push({
          type: "room_cleaned",
          message: "Room {{name}} has been marked as cleaned.",
        });
      }

      if (after.notes && after.notes !== before.notes) {
        const excerpt = String(after.notes).slice(0, 60);
        const ellipsis = String(after.notes).length > 60 ? "…" : "";
        events.push({
          type: "note",
          message: `Note on room {{name}}: "${excerpt}${ellipsis}"`,
        });
      }

      if ((after.extraTime || 0) > (before.extraTime || 0)) {
        events.push({
          type: "extra_time",
          message: `Extra time on room {{name}}: +${after.extraTime} min`,
        });
      }

      if (events.length === 0) return;

      const name = await roomName(hostelCode, roomId);
      for (const ev of events) {
        await notifyManagers(hostelCode, {
          type: ev.type,
          message: ev.message.replace("{{name}}", name),
          roomId,
        });
      }
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled cleanup
// Replaces the client-side sweeps in NotificationContext and
// cleanupOldExtraRequests(), which raced between devices and burned writes.
// ─────────────────────────────────────────────────────────────────────────────

exports.cleanupOldData = onSchedule("every 24 hours", async () => {
  const cutoff = admin.firestore.Timestamp.fromMillis(
      Date.now() - 24 * 60 * 60 * 1000,
  );

  const hostels = await db.collection("hostels").get();

  for (const hostel of hostels.docs) {
    const stale = await hostel.ref.collection("notifications")
        .where("timestamp", "<", cutoff)
        .limit(400)
        .get();

    if (!stale.empty) {
      const batch = db.batch();
      stale.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      logger.info("Pruned notifications", {
        hostel: hostel.id,
        count: stale.size,
      });
    }

    // Resolved extra requests older than 24h, including their base64 photos —
    // this is what the privacy policy promises.
    const requests = await hostel.ref.collection("extraRequests")
        .where("status", "in", ["approved", "rejected"])
        .limit(400)
        .get();

    const old = requests.docs.filter((doc) => {
      const at = doc.data().requestedAt;
      const ms = at && at.toMillis ? at.toMillis() : Date.parse(at || "");
      return Number.isFinite(ms) && ms < cutoff.toMillis();
    });

    if (old.length > 0) {
      const batch = db.batch();
      old.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  // Expire stale rate-limit buckets.
  const buckets = await db.collection("_rateLimits")
      .where("windowStart", "<", Date.now() - 24 * 60 * 60 * 1000)
      .limit(400)
      .get();
  if (!buckets.empty) {
    const batch = db.batch();
    buckets.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
});
