// src/components/maintenance/TaskDetailSheet.js
//
// One task, on a phone. What it offers depends on who is looking:
//   worker   (in assignees)      Start · Waiting · Mark fixed · Reopen, checklist, photos
//   manager  (board + perm)      Edit / Assign · Mark done · Dismiss / Restore · Delete
//   reporter (raised it)         read-only status; Withdraw while still 'reported'
// Everyone involved can comment.
//
// Pass taskId, not the task: the sheet reads the live document from the
// provider, so a manager's edit shows up while it's open.

import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import BottomSheet from '../BottomSheet';
import Icon from '../Icon';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { COLORS } from '../../theme/colors';
import { auth } from '../../firebase';
import { useApp } from '../../contexts/AppContext';
import { buildCleanerColors } from '../../utils/cleanerColor';
import {
  useMaintenance, useTaskThread, locationLabel, isFinished, isClearedFor, MAX_TASK_PHOTOS, MAX_NEW_PHOTOS,
} from '../../hooks/useMaintenance';
import {
  Overline, StatusPill, PriorityPill, DuePill, Avatar, ChecklistView,
  PhotoStrip, PhotoViewer, PhotoRetentionNote, PrimaryButton, GhostButton, maintStyles,
} from './MaintenanceParts';
import {
  pickPhotos, choosePhotoSource, photoErrorMessage, formatWhen, confirmDone, ask,
} from './maintenanceUi';

export default function TaskDetailSheet({ taskId, onClose, onEdit }) {
  const { t } = useTranslation();
  const m = useMaintenance();
  const task = m.tasks.find(x => x.id === taskId) || null;

  return (
    <BottomSheet visible={!!taskId} onClose={onClose} maxHeightRatio={0.92}>
      {task
        ? <Body key={task.id} task={task} m={m} onClose={onClose} onEdit={onEdit} />
        : <Text style={styles.gone}>{t('maint.taskGone', 'This task no longer exists.')}</Text>}
    </BottomSheet>
  );
}

function Body({ task, m, onClose, onEdit }) {
  const { t } = useTranslation();
  const { rooms, cleaners } = useApp();
  const uid = auth.currentUser?.uid;
  const colors = useMemo(() => buildCleanerColors(cleaners), [cleaners]);
  const { comments, photos, addComment, addPhoto } = useTaskThread(task);

  const isWorker = (task.assignees || []).includes(uid);
  const isManager = m.canManage;
  const isReporter = task.reportedBy === uid;

  const [viewer, setViewer] = useState(null);
  const [comment, setComment] = useState('');
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (e) { Alert.alert(t('error', 'Error'), e.message); } finally { setBusy(false); }
  };

  const status = (next, extra) => run(() => m.setStatus(task, next, extra));

  const onAddPhoto = async () => {
    const left = MAX_TASK_PHOTOS - photos.length;
    if (left <= 0) return;
    try {
      const source = await choosePhotoSource(t);
      if (!source) return;
      setAdding(true);
      const picked = await pickPhotos({ source, limit: Math.min(left, MAX_NEW_PHOTOS) });
      for (const b64 of picked) {
        // eslint-disable-next-line no-await-in-loop
        await addPhoto(b64, task.status === 'done' ? 'fix' : 'progress');
      }
    } catch (e) {
      Alert.alert(t('error', 'Error'), photoErrorMessage(e, t));
    } finally {
      setAdding(false);
    }
  };

  const send = async () => {
    const text = comment.trim();
    if (!text) return;
    setComment('');
    try { await addComment(text); } catch (e) { setComment(text); Alert.alert(t('error', 'Error'), e.message); }
  };

  const confirmDelete = async () => {
    const ok = await ask({
      title: isManager ? t('maint.deleteTitle', 'Delete this task?') : t('maint.withdrawTitle', 'Withdraw this report?'),
      message: t('maint.deleteBody', 'Photos and comments are removed too. This cannot be undone.'),
      confirmLabel: isManager ? t('delete', 'Delete') : t('maint.withdraw', 'Withdraw'),
      cancelLabel: t('cancel', 'Cancel'),
      destructive: true,
    });
    if (ok) run(async () => { await m.deleteTask(task); onClose(); });
  };

  const canWork = (isWorker || isManager) && ['open', 'in_progress', 'on_hold', 'done'].includes(task.status);
  const where = locationLabel(task, rooms);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Heading ── */}
        <View style={{ gap: 6 }}>
          <Text style={styles.where}>{where.toUpperCase()}</Text>
          <Text style={styles.title}>{task.title}</Text>
          <View style={styles.pillRow}>
            <StatusPill status={task.status} />
            <PriorityPill priority={task.priority} />
            <DuePill task={task} />
          </View>
        </View>

        {!!task.description && <Text style={styles.description}>{task.description}</Text>}

        {task.status === 'on_hold' && !!task.holdReason && (
          <View style={styles.holdBox}>
            <Icon name="pause_circle" size={18} color={COLORS.accentDark} />
            <Text style={styles.holdText}>{task.holdReason}</Text>
          </View>
        )}

        <Text style={styles.meta}>
          {t('maint.reportedByOn', 'Reported by {{who}} · {{when}}', {
            who: m.nameOf(task.reportedBy), when: formatWhen(task.reportedAt),
          })}
          {task.dueAt ? `\n${t('maint.dueOn', 'Due {{when}}', { when: formatWhen(task.dueAt) })}` : ''}
          {task.doneAt ? `\n${t('maint.doneByOn', 'Fixed by {{who}} · {{when}}', {
            who: m.nameOf(task.doneBy), when: formatWhen(task.doneAt),
          })}` : ''}
        </Text>

        {/* ── Assignees ── */}
        {(task.assignees || []).length > 0 && (
          <View>
            <Overline>{t('maint.assignedTo', 'Assigned to')}</Overline>
            <View style={styles.people}>
              {task.assignees.map(id => (
                <View key={id} style={styles.person}>
                  <Avatar name={m.nameOf(id)} color={colors[id]} size={26} />
                  <Text style={styles.personName}>{m.nameOf(id)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Checklist ── */}
        {(task.checklist || []).length > 0 && (
          <View>
            <Overline>{t('maint.checklist', 'Steps')}</Overline>
            <ChecklistView
              items={task.checklist}
              onToggle={canWork ? (id) => run(() => m.toggleChecklistItem(task, id)) : undefined}
              disabled={busy}
            />
          </View>
        )}

        {/* ── Photos ── */}
        {(photos.length > 0 || canWork || !!task.photosPurgedAt) && (
          <View>
            <Overline>{t('maint.photos', 'Photos')}</Overline>
            <PhotoStrip
              photos={photos}
              onOpen={(_, p) => setViewer(p)}
              onAdd={canWork && photos.length < MAX_TASK_PHOTOS ? onAddPhoto : undefined}
              adding={adding}
            />
            <PhotoRetentionNote task={task} />
          </View>
        )}

        {/* ── Comments ── */}
        <View>
          <Overline>{t('maint.comments', 'Comments')}</Overline>
          {comments.length === 0 && (
            <Text style={styles.empty}>{t('maint.noComments', 'No comments yet.')}</Text>
          )}
          <View style={{ gap: 8 }}>
            {comments.map(c => (
              <View key={c.id} style={[styles.bubble, c.by === uid && styles.bubbleMine]}>
                <Text style={styles.bubbleWho}>
                  {m.nameOf(c.by)} · {formatWhen(c.at)}
                </Text>
                <Text style={styles.bubbleText}>{c.text}</Text>
              </View>
            ))}
          </View>
          <View style={styles.commentRow}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t('maint.addComment', 'Add a comment…')}
              placeholderTextColor={NEUTRAL.text4}
              maxLength={1000}
              multiline
              style={[maintStyles.input, { flex: 1, maxHeight: 110 }]}
            />
            <TouchableOpacity
              onPress={send}
              disabled={!comment.trim()}
              style={[styles.sendBtn, !comment.trim() && { opacity: 0.4 }]}
              activeOpacity={0.85}
            >
              <Icon name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hold reason prompt ── */}
        {holdOpen && (
          <View style={styles.holdPrompt}>
            <Overline>{t('maint.holdWhy', 'What are you waiting for?')}</Overline>
            <TextInput
              value={holdReason}
              onChangeText={setHoldReason}
              placeholder={t('maint.holdPlaceholder', 'e.g. Spare part ordered, back Friday')}
              placeholderTextColor={NEUTRAL.text4}
              maxLength={200}
              style={maintStyles.input}
              autoFocus
            />
            <View style={styles.actionRow}>
              <GhostButton label={t('cancel', 'Cancel')} onPress={() => setHoldOpen(false)} style={{ flex: 1 }} />
              <PrimaryButton
                label={t('maint.putOnHold', 'Put on hold')}
                icon="pause"
                disabled={busy}
                onPress={() => { setHoldOpen(false); status('on_hold', { holdReason }); }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {/* ── Actions ── */}
        {!holdOpen && (
          <View style={{ gap: 10 }}>
            {canWork && task.status === 'open' && (
              <PrimaryButton label={t('maint.start', 'Start')} icon="play_arrow" disabled={busy}
                onPress={() => status('in_progress')} />
            )}
            {canWork && ['in_progress', 'on_hold'].includes(task.status) && (
              <View style={styles.actionRow}>
                {task.status === 'in_progress' ? (
                  <GhostButton label={t('maint.waiting', 'Waiting')} icon="pause" disabled={busy}
                    onPress={() => { setHoldReason(task.holdReason || ''); setHoldOpen(true); }} style={{ flex: 1 }} />
                ) : (
                  <GhostButton label={t('maint.resume', 'Resume')} icon="play_arrow" disabled={busy}
                    onPress={() => status('in_progress')} style={{ flex: 1 }} />
                )}
                <PrimaryButton label={t('maint.markFixed', 'Mark fixed')} icon="task_alt" tone="success"
                  disabled={busy} onPress={() => confirmDone(t, task, () => status('done'))} style={{ flex: 1.4 }} />
              </View>
            )}
            {/* Managers can close a task straight from "To do" too. */}
            {isManager && task.status === 'open' && (
              <PrimaryButton label={t('maint.markFixed', 'Mark fixed')} icon="task_alt" tone="success"
                disabled={busy} onPress={() => confirmDone(t, task, () => status('done'))} />
            )}
            {canWork && task.status === 'done' && (
              <GhostButton label={t('maint.reopen', 'Reopen')} icon="undo" disabled={busy}
                onPress={() => status('in_progress')} />
            )}
            {/* Finished: stays on this person's list until they remove it. */}
            {isFinished(task) && (isWorker || isReporter || isManager) && !isClearedFor(task, uid) && (
              <GhostButton
                label={t('maint.removeFromList', 'Remove from my list')}
                icon="playlist_remove"
                disabled={busy}
                onPress={() => run(async () => { await m.clearForMe(task); onClose(); })}
              />
            )}

            {isManager && (
              <View style={styles.actionRow}>
                {!!onEdit && (
                  <PrimaryButton
                    label={task.status === 'reported' ? t('maint.assign', 'Assign') : t('edit', 'Edit')}
                    icon={task.status === 'reported' ? 'person_add' : 'edit'}
                    onPress={() => onEdit(task)}
                    style={{ flex: 1 }}
                  />
                )}
                {['reported', 'open'].includes(task.status) && (
                  <GhostButton label={t('maint.dismiss', 'Dismiss')} icon="block" disabled={busy}
                    onPress={() => run(() => m.dismiss(task))} style={{ flex: 1 }} />
                )}
                {task.status === 'dismissed' && (
                  <GhostButton label={t('maint.restore', 'Restore')} icon="undo" disabled={busy}
                    onPress={() => run(() => m.restore(task))} style={{ flex: 1 }} />
                )}
              </View>
            )}

            {(isManager || (isReporter && task.status === 'reported')) && (
              <GhostButton
                label={isManager ? t('delete', 'Delete') : t('maint.withdrawReport', 'Withdraw report')}
                icon="delete"
                danger
                disabled={busy}
                onPress={confirmDelete}
              />
            )}
          </View>
        )}
      </ScrollView>

      <PhotoViewer base64={viewer?.data} at={viewer?.at} name={task.title} onClose={() => setViewer(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 18, paddingBottom: 28 },
  gone: { fontFamily: FONTS.regular, fontSize: 15, color: NEUTRAL.text3, padding: 24, textAlign: 'center' },
  where: { fontFamily: FONTS.medium, fontSize: 12, letterSpacing: 0.6, color: NEUTRAL.text3 },
  title: { fontFamily: FONTS.display, fontSize: 22, color: BRAND.navy },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  description: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: NEUTRAL.text },
  meta: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, color: NEUTRAL.text3 },
  holdBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    padding: 12, borderRadius: 12, backgroundColor: COLORS.warningLight,
  },
  holdText: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: NEUTRAL.text },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  personName: { fontFamily: FONTS.medium, fontSize: 14, color: NEUTRAL.text },
  empty: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text4, marginBottom: 8 },
  bubble: { padding: 10, borderRadius: 12, backgroundColor: NEUTRAL.slateChip, alignSelf: 'flex-start', maxWidth: '88%' },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: BRAND.yellowSoft },
  bubbleWho: { fontFamily: FONTS.medium, fontSize: 11.5, color: NEUTRAL.text3, marginBottom: 2 },
  bubbleText: { fontFamily: FONTS.regular, fontSize: 14.5, color: NEUTRAL.text },
  commentRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 10 },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: BRAND.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  holdPrompt: { gap: 10, padding: 14, borderRadius: 14, backgroundColor: NEUTRAL.slateChip },
  actionRow: { flexDirection: 'row', gap: 10 },
});