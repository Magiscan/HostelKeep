// src/utils/notify.js
//
// One notification document per (type, room, day). The ID is derived from the
// event, not generated — so if two devices race, they aim at the SAME document.
// The Firestore rules allow `create` but not overwrite, so the loser of the
// race gets permission-denied and we swallow it. That is the duplicate fix,
// and it is enforced server-side rather than hoped for on the client.

import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const dayKey = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
};

// Firestore doc IDs can't contain '/', and we want them predictable.
const safe = (s) => String(s ?? '').replace(/[^A-Za-z0-9_-]/g, '') || 'x';

// Short stable hash, so "note changed" produces a new ID but "same note
// written twice" does not.
export const bucketOf = (s) => {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) {
    h = (h * 31 + String(s).charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
};

export async function notifyHostel(hostelCode, { type, message, roomId, bucket }) {
  if (!hostelCode || !type) return;

  const id = [safe(type), safe(roomId || 'none'), dayKey(), bucket && safe(bucket)]
    .filter(Boolean)
    .join('__');

  try {
    await setDoc(doc(db, 'hostels', hostelCode, 'notifications', id), {
      type,
      message,
      roomId: roomId || null,
      read: false,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    // permission-denied here is the expected outcome for a duplicate.
    if (e?.code !== 'permission-denied') console.warn('notify failed:', e.message);
  }
}