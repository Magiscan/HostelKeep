const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

/**
 * Retrieves push tokens for all managers in a hostel.
 * @param {string} hostelCode
 * @return {Promise<string[]>}
 */
async function getManagerTokens(hostelCode) {
  const managersQuery = await admin.firestore()
      .collection("users")
      .where("hostelCode", "==", hostelCode)
      .where("role", "==", "manager")
      .get();

  const tokens = [];
  managersQuery.forEach((doc) => {
    const data = doc.data();
    if (data.pushToken) {
      tokens.push(data.pushToken);
    }
  });
  return tokens;
}

/**
 * Triggers when a new extra room request is created.
 */
exports.onExtraRequest = functions.firestore
    .document("hostels/{hostelCode}/extraRequests/{roomId}")
    .onCreate(async (snap, context) => {
      const {hostelCode, roomId} = context.params;

      const roomDoc = await admin.firestore()
          .doc(`hostels/${hostelCode}/rooms/${roomId}`)
          .get();
      const roomName = roomDoc.exists ?
          (roomDoc.data().name || roomId) :
          roomId;

      const tokens = await getManagerTokens(hostelCode);
      if (tokens.length === 0) return;

      const message = {
        tokens,
        notification: {
          title: "Extra Room Request",
          body: `Room ${roomName} requested by a cleaner.`,
        },
        data: {type: "extra_request", roomId},
      };

      return admin.messaging().sendMulticast(message);
    });

/**
 * Triggers when a new notification document is created.
 */
exports.onNewNotification = functions.firestore
    .document("hostels/{hostelCode}/notifications/{notifId}")
    .onCreate(async (snap, context) => {
      const notif = snap.data();
      const {hostelCode} = context.params;

      if (notif.read) return;

      const tokens = await getManagerTokens(hostelCode);
      if (tokens.length === 0) return;

      const message = {
        tokens,
        notification: {
          title: "KeepClean Update",
          body: notif.message || "New notification",
        },
        data: {
          type: notif.type || "general",
          roomId: notif.roomId || "",
        },
      };

      return admin.messaging().sendMulticast(message);
    });

/**
 * Triggers when a room status is updated to cleaned.
 */
exports.onRoomCleaned = functions.firestore
    .document("hostels/{hostelCode}/roomStatus/{roomId}")
    .onUpdate(async (change, context) => {
      const before = change.before.data();
      const after = change.after.data();

      if (!after.cleaned || before.cleaned) return;

      const {hostelCode, roomId} = context.params;

      const roomDoc = await admin.firestore()
          .doc(`hostels/${hostelCode}/rooms/${roomId}`)
          .get();
      const roomName = roomDoc.exists ?
          (roomDoc.data().name || roomId) :
          roomId;

      const tokens = await getManagerTokens(hostelCode);
      if (tokens.length === 0) return;

      const message = {
        tokens,
        notification: {
          title: "Room Cleaned",
          body: `Room ${roomName} has been marked as cleaned.`,
        },
        data: {type: "room_cleaned", roomId},
      };

      return admin.messaging().sendMulticast(message);
    });
