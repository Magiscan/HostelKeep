// src/utils/photoRetention.js
//
// Maintenance photos are kept for 30 days after a task is finished (done or
// archived), then deleted to keep Firestore inside the free plan. The task
// itself, its comments and its history stay. People get a warning 7 days
// before, and every photo has a Save button.
//
// There are no Cloud Functions on the Spark plan, so the deleting is done by
// the app of a manager who can manage maintenance, when their board loads
// (see usePhotoCleanup in hooks/useMaintenance.js). Pure functions here, no
// Firebase, so they can be tested on their own.

import { asMillis } from './maintenanceSchedule';

export const PHOTO_RETENTION_DAYS = 30;
export const PHOTO_WARNING_DAYS = 7;
const DAY = 24 * 3600 * 1000;

/** When the task was finished, or null if it isn't. Archived tasks from
    before `dismissedAt` existed fall back to their last update. */
export function finishedAt(task) {
  if (task?.status === 'done') return asMillis(task.doneAt) ?? asMillis(task.updatedAt);
  if (task?.status === 'dismissed') return asMillis(task.dismissedAt) ?? asMillis(task.updatedAt);
  return null;
}

/** When this task's photos will be (or were due to be) deleted; null if never. */
export function photosDeleteAt(task) {
  if (!(task?.photoCount > 0)) return null;
  const at = finishedAt(task);
  return at == null ? null : at + PHOTO_RETENTION_DAYS * DAY;
}

/** Tasks whose photos should be deleted now. */
export function photosToPurge(tasks, now = Date.now()) {
  return (tasks || []).filter((x) => {
    const at = photosDeleteAt(x);
    return at != null && at <= now;
  });
}

/** Tasks whose photos will be deleted within the warning window. */
export function photosExpiringSoon(tasks, now = Date.now()) {
  return (tasks || []).filter((x) => {
    const at = photosDeleteAt(x);
    return at != null && at > now && at - now <= PHOTO_WARNING_DAYS * DAY;
  });
}