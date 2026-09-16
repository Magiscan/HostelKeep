// src/utils/dailyLog.js
//
// Daily history without Cloud Functions.
//
// Nothing runs at 23:59 on the Spark plan, so the snapshot is taken by
// manager-side clients at the moments that matter:
//
//   1. LIVE AUTOSAVE — whenever rooms/statuses change, the day's log is
//      rewritten (debounced). History is always as fresh as the last manager
//      device that had the app open.
//
//   2. WORK DATE, NOT CLOCK DATE — every roomStatus write carries `updatedAt`.
//      The live state belongs to the day of its most recent change. Open the
//      app the next morning and the untouched state is still filed under
//      YESTERDAY, which closes yesterday's log before anyone edits today.
//
//   3. A PLAN NEVER OVERWRITES A WORKED DAY — if the stored log contains
//      completed work and the current state contains none (evening planning,
//      a "Clear all" to fix a mistake), the write is skipped.
//
//   4. CHECKPOINT BEFORE A WIPE — "Clear all", "Reset beds" and unassigning a
//      room that already has progress first save a separate checkpoint
//      document (`YYYY-MM-DD__cp_HHMMSS_mmm`), so a mid-shift mistake can never
//      silently erase work from history. Wipes with no progress (the usual
//      "fix the assignment" case) create nothing.

/* ── Dates ─────────────────────────────────────────────────────────────── */
export function localDateStr(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function hhmmssms(d) {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${p(d.getMilliseconds(), 3)}`;
}

export function lastActivityOf(roomStatus = {}) {
  let max = 0;
  Object.values(roomStatus).forEach(s => {
    const t = Number(s?.updatedAt) || 0;
    if (t > max) max = t;
  });
  return max || null;
}

/** The day the current live state belongs to, or null if nothing is stamped yet. */
export function workDateOf(roomStatus = {}) {
  const last = lastActivityOf(roomStatus);
  return last ? localDateStr(new Date(last)) : null;
}

/* ── Work ──────────────────────────────────────────────────────────────── */
/**
 * Units of completed work: rooms marked clean, beds marked clean, housekeeper
 * notes, extra time, extra cleanings. Only used to decide whether a snapshot
 * is worth protecting — not shown anywhere.
 */
export function countWork(roomStatus = {}, roomIds = null) {
  let n = 0;
  (roomIds || Object.keys(roomStatus)).forEach(id => {
    const s = roomStatus[id];
    if (!s) return;
    if (s.cleaned) n += 1;
    n += Object.values(s.bedStatus || {}).filter(b => b?.status === 'cleaned').length;
    if (typeof s.notes === 'string' && s.notes.trim()) n += 1;
    if (Number(s.extraTime) > 0) n += 1;
    if (s.extraCleaning) n += 1;
  });
  return n;
}

/** Work count of a log already in Firestore, including logs saved before this change. */
export function storedWorkCount(log) {
  if (!log) return 0;
  if (typeof log.workCount === 'number') return log.workCount;
  if (log.roomStatusSnapshot) return countWork(log.roomStatusSnapshot);
  let n = 0;
  Object.values(log.cleaners || {}).forEach(c => {
    (c.rooms || []).forEach(r => {
      if (r.cleaned) n += 1;
      if (r.notes) n += 1;
      if (Number(r.extraTime) > 0) n += 1;
    });
  });
  return n;
}

/* ── Snapshot builder ──────────────────────────────────────────────────── */
// Firestore caps a document at 1 MiB. User documents carry base64 profile
// photos (up to 400 KB each) and extra requests carry base64 room photos (up
// to 700 KB each) — copying either into the log is what made saves fail.
// Push tokens and emails don't belong in history either.
const slimCleaner = (c) => ({ id: c.id, username: c.username || '', role: c.role || 'cleaner' });
const slimRequest = (r) => {
  const { imageBase64, ...rest } = r || {};
  return rest;
};

export function buildDailyLog({
  hostelName = '',
  rooms = [],
  roomStatus = {},
  cleaners = [],
  floors = [],
  extraRequests = [],
  date = null,
  today = localDateStr(),
}) {
  const logDate = date || workDateOf(roomStatus) || today;

  const nameById = {};
  cleaners.forEach(c => { nameById[c.id] = c.username; });

  const cleanerMap = {};
  rooms.forEach(room => {
    if (!room.assignedTo) return;
    const status = roomStatus[room.id] || {};
    const cleanerId = room.assignedTo;
    if (!cleanerMap[cleanerId]) {
      cleanerMap[cleanerId] = {
        cleanerName: nameById[cleanerId] || 'Deleted cleaner',
        rooms: [],
      };
    }
    cleanerMap[cleanerId].rooms.push({
      roomId: room.id,
      roomName: room.name,
      cleaned: status.cleaned || false,
      notes: status.notes || '',
      extraTime: status.extraTime || 0,
      bedStatus: status.bedStatus || {},
      assignmentBedStatus: status.assignmentBedStatus || {},
      managerNotes: status.managerNotes || '',
      commonOnly: status.commonOnly || false,
      assignmentAttributes: status.assignmentAttributes || {},
      extraCleaning: status.extraCleaning || false,
    });
  });

  return {
    date: logDate,
    hostelName: hostelName || '',
    cleaners: cleanerMap,
    workCount: countWork(roomStatus),
    lastActivityAt: lastActivityOf(roomStatus),

    // Full snapshots for rich report generation later
    roomsSnapshot: rooms,
    floorsSnapshot: floors,
    cleanersSnapshot: cleaners.map(slimCleaner),
    extraRequestsSnapshot: extraRequests.map(slimRequest),
    roomStatusSnapshot: roomStatus,
  };
}

/* ═════════════════════════════════════════════════════════════════════════
   Autosave controller — no React, no Firebase imports, so it can be tested.
   The hook in src/hooks/useDailyLogAutosave.js wires it to Firestore.
   ═════════════════════════════════════════════════════════════════════════ */
export function createDailyLogAutosaver({
  readLog,          // (hostelCode, date) => Promise<log|null>
  writeLog,         // (hostelCode, docId, log) => Promise
  onSaved = () => {},
  onError = () => {},
  debounceMs = 20000,
  maxWaitMs = 120000,
  maxBytes = 900000,
  now = () => new Date(),
}) {
  let latest = null;
  let pending = null;          // { code, log, sig }
  let timer = null;
  let firstPendingAt = 0;
  let lastCheckpointKey = null;
  let chain = Promise.resolve();
  const written = new Map();   // "code/date" → signature last sent
  const knownWork = new Map(); // "code/date" → work count of the stored log

  const keyOf = (e) => `${e.code}/${e.log.date}`;

  const snapshot = () => {
    const s = latest;
    if (!s || !s.enabled || !s.ready || !s.hostelCode) return null;
    // Rooms arrived but the team hasn't: names would be saved as "Deleted cleaner".
    if (s.rooms.some(r => r.assignedTo) && s.cleaners.length === 0) return null;
    const log = buildDailyLog({ ...s, today: localDateStr(now()) });
    return { code: s.hostelCode, log, sig: JSON.stringify(log) };
  };

  const cancelPending = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
    firstPendingAt = 0;
  };

  const process = async (entry) => {
    const key = keyOf(entry);
    if (written.get(key) === entry.sig) return;

    if (!knownWork.has(key)) {
      try {
        const stored = await readLog(entry.code, entry.log.date);
        knownWork.set(key, stored ? storedWorkCount(stored) : 0);
      } catch (e) {
        // Can't see what's stored (offline). Never risk replacing a worked day
        // with an empty one; a snapshot WITH work is safe to send.
        if (entry.log.workCount === 0) return;
      }
    }

    if (entry.log.workCount === 0 && (knownWork.get(key) || 0) > 0) return;

    if (entry.sig.length > maxBytes) {
      onError('too-large');
      return;
    }

    written.set(key, entry.sig);
    knownWork.set(key, entry.log.workCount);
    // Not awaited: Firestore resolves writes on server ack, which never comes
    // offline. The SDK queues the write locally, in order, either way.
    Promise.resolve()
      .then(() => writeLog(entry.code, entry.log.date, entry.log))
      .then(() => onSaved(entry.log.date))
      .catch(e => {
        if (written.get(key) === entry.sig) written.delete(key);
        onError(e);
      });
  };

  const enqueue = (entry) => {
    chain = chain.then(() => process(entry)).catch(e => onError(e));
    return chain;
  };

  const flush = () => {
    const entry = pending;
    cancelPending();
    return entry ? enqueue(entry) : chain;
  };

  const update = (inputs) => {
    latest = inputs;
    if (!inputs?.enabled) { cancelPending(); return; }

    const entry = snapshot();
    if (!entry) return;

    // The work date rolled over (or the hostel changed): close the old one now.
    if (pending && keyOf(pending) !== keyOf(entry)) flush();

    if (written.get(keyOf(entry)) === entry.sig) {
      cancelPending();
      return;
    }

    pending = entry;
    const t = now().getTime();
    if (!firstPendingAt) firstPendingAt = t;
    const isPastDay = entry.log.date < localDateStr(now());
    const delay = isPastDay
      ? 0
      : Math.max(0, Math.min(debounceMs, maxWaitMs - (t - firstPendingAt)));
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  };

  /**
   * Call synchronously right BEFORE a destructive write. `roomIds` narrows the
   * checkpoint decision to the rooms being wiped (single unassign).
   */
  const closeBeforeWipe = (reason, roomIds = null) => {
    const entry = snapshot();
    if (!entry) return chain;

    if (pending && keyOf(pending) !== keyOf(entry)) flush();
    else cancelPending();

    const done = enqueue(entry);

    // A past day is fully closed by the main write above — the wipe starts today.
    if (entry.log.date !== localDateStr(now())) return done;

    const affected = roomIds
      ? countWork(latest.roomStatus, roomIds)
      : entry.log.workCount;
    if (!affected) return done;

    // clearAll calls unassignRoom once per room, all before the first snapshot
    // arrives — they see identical state, so only one checkpoint is written.
    const cpKey = `${entry.code}/${entry.sig}`;
    if (lastCheckpointKey === cpKey) return done;
    lastCheckpointKey = cpKey;
    if (entry.sig.length > maxBytes) return done;

    const at = now();
    const id = `${entry.log.date}__cp_${hhmmssms(at)}`;
    Promise.resolve()
      .then(() => writeLog(entry.code, id, {
        ...entry.log,
        checkpoint: { reason: String(reason || 'wipe'), at: at.toISOString() },
      }))
      .catch(e => onError(e));
    return done;
  };

  const dispose = () => flush();

  return { update, flush, closeBeforeWipe, dispose };
}