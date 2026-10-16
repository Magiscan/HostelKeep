// src/screens/manager/MaintenanceBoardScreen.desktop.js
//
// Desktop Maintenance board, modelled on Flexkeeping's "Manutenzione":
//   status tabs with counts → search + assignee filter → one row per task
//   (location overline, bold title, priority, overdue "+20 h", assignees,
//   quick-complete circle) → right-hand drawer to triage / edit, with steps,
//   photos and comments underneath.
//
// Web only (imported by ManagerLayout.web.js). Hoists its "New task" button
// into PageHeader through onReady, like the other sections.

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import Icon from '../../components/Icon';
import { useApp } from '../../contexts/AppContext';
import { buildCleanerColors, fallbackCleanerColor } from '../../utils/cleanerColor';
import {
  useMaintenance, useTaskThread, locationLabel, PRIORITIES, isOverdue, MAX_TASK_PHOTOS, MAX_NEW_PHOTOS,
  isFinished, isClearedFor,
} from '../../hooks/useMaintenance';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { COLORS } from '../../theme/colors';
import MaintenanceUpsell from '../../components/maintenance/MaintenanceUpsell';
import { ContactDialog } from './PaywallScreen.web';
import { Drawer, FieldLabel, ConfirmDialog, drawerStyles as d } from '../../components/Dashboard/Drawer.web';
import {
  StatusPill, PriorityPill, DuePill, AvatarStack, Avatar, Chip, LocationPicker,
  ChecklistEditor, ChecklistView, PhotoStrip, PhotoViewer, PhotoRetentionNote, PhotoCleanupBanner,
  NewPhotosField,
} from '../../components/maintenance/MaintenanceParts';
import {
  PRIORITY_LOOK, useTaskForm, dueOptions, priorityLabel, statusLabel, formatWhen,
  pickPhotos, photoErrorMessage,
} from '../../components/maintenance/maintenanceUi';

// 'current' is the working view: everything open, plus finished tasks that
// stay put (greyed, with a ✕) until the person looking removes them.
const TABS = [
  { key: 'current',     statuses: ['reported', 'open', 'in_progress', 'on_hold', 'done', 'dismissed'], current: true },
  { key: 'reported',    statuses: ['reported'] },
  { key: 'open',        statuses: ['open'] },
  { key: 'in_progress', statuses: ['in_progress'] },
  { key: 'on_hold',     statuses: ['on_hold'] },
  { key: 'done',        statuses: ['done'] },
  { key: 'dismissed',   statuses: ['dismissed'] },
];

// In 'current', finished tasks this person already removed are hidden.
const inTab = (tb, task, uid) => tb.statuses.includes(task.status)
  && !(tb.current && isFinished(task) && isClearedFor(task, uid));

const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (ms) => {
  if (!ms) return '';
  const x = new Date(ms);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

export default function MaintenanceBoardScreen({ onReady }) {
  const { t } = useTranslation();
  const { rooms, cleaners } = useApp();
  const m = useMaintenance();
  const colors = useMemo(() => buildCleanerColors(cleaners), [cleaners]);

  const [tab, setTab] = useState('current');
  const [confirmDoneTask, setConfirmDoneTask] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [search, setSearch] = useState('');
  const [who, setWho] = useState(null);          // assignee filter
  const [drawer, setDrawer] = useState(null);    // { id } | { id: null } for new

  useEffect(() => {
    if (!onReady) return;
    onReady(m.canManage && m.enabled ? { newTask: () => setDrawer({ id: null }) } : null);
  }, [onReady, m.canManage, m.enabled]);

  const counts = useMemo(() => {
    const c = {};
    TABS.forEach(tb => {
      c[tb.key] = m.tasks.filter(x => inTab(tb, x, m.uid) && !(tb.current && isFinished(x))).length;
    });
    return c;
  }, [m.tasks, m.uid]);

  const list = useMemo(() => {
    const tb = TABS.find(x => x.key === tab) || TABS[0];
    const needle = search.trim().toLowerCase();
    let out = m.tasks.filter(x => inTab(tb, x, m.uid));
    if (who) out = out.filter(x => (x.assignees || []).includes(who));
    if (needle) {
      out = out.filter(x => `${x.title} ${x.description || ''} ${locationLabel(x, rooms)}`
        .toLowerCase().includes(needle));
    }
    if (tab === 'done' || tab === 'dismissed') {
      out = [...out].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else if (tab === 'current') {
      // Open work first (already sorted), finished at the bottom, newest first.
      const open = out.filter(x => !isFinished(x));
      const fin = out.filter(isFinished).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      out = [...open, ...fin];
    }
    return out;
  }, [m.tasks, m.uid, tab, search, who, rooms]);

  const finishedHere = tab === 'current' ? list.filter(isFinished) : [];

  // Every write from the list surfaces its error. A rejected write otherwise
  // looks like "the state didn't save": Firestore shows the change locally,
  // then quietly rolls it back when the server says no.
  const act = (p) => Promise.resolve(p).catch((e) => {
    console.error('Maintenance write failed:', e.code, e.message);
    setActionError(e.message || String(e));
  });

  const tabLabel = (key) => (key === 'current'
    ? t('maint.boardTab.current', 'Current')
    : statusLabel(t, key));

  const openTask = drawer?.id ? m.tasks.find(x => x.id === drawer.id) : null;

  // Maintenance is Pro+. (Hooks above run unconditionally, so this is safe.)
  if (m.billingLoaded && !m.enabled) {
    return (
      <>
        <MaintenanceUpsell onContact={() => setUpgradeOpen(true)} />
        <ContactDialog visible={upgradeOpen} intent="proplus" onClose={() => setUpgradeOpen(false)} />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}>
        {m.canManage && (
          <PhotoCleanupBanner
            tasks={m.tasks}
            onShow={(soon) => {
              const kinds = new Set(soon.map(x => x.status));
              setTab(kinds.size === 1 ? [...kinds][0] : 'current');
            }}
          />
        )}

        {/* ── Tabs ── */}
        <View style={styles.tabs}>
          {TABS.map(tb => {
            const on = tab === tb.key;
            return (
              <TouchableOpacity key={tb.key} onPress={() => setTab(tb.key)} style={[styles.tab, on && styles.tabOn]} activeOpacity={0.8}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{tabLabel(tb.key)}</Text>
                {counts[tb.key] > 0 && (
                  <View style={[styles.count, tb.key === 'reported' && { backgroundColor: BRAND.yellow }]}>
                    <Text style={styles.countText}>{counts[tb.key]}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Filters ── */}
        <View style={styles.filters}>
          <View style={styles.searchBox}>
            <Icon name="search" size={18} color={NEUTRAL.text3} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('maint.searchTasks', 'Search tasks, rooms, places…')}
              placeholderTextColor={NEUTRAL.text4}
              style={styles.searchInput}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
            <Chip label={t('maint.everyone', 'Everyone')} selected={!who} onPress={() => setWho(null)} />
            {m.assignable.map(c => (
              <Chip key={c.id} label={c.username} selected={who === c.id} onPress={() => setWho(who === c.id ? null : c.id)} />
            ))}
          </ScrollView>
        </View>

        {!!actionError && (
          <TouchableOpacity onPress={() => setActionError('')} style={styles.errorBar} activeOpacity={0.8}>
            <Icon name="error" size={18} color={COLORS.danger} />
            <Text style={[styles.error, { flex: 1 }]}>{actionError}</Text>
            <Icon name="close" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        )}

        {finishedHere.length > 1 && (
          <View style={styles.clearBar}>
            <Text style={styles.hint}>
              {t('maint.finishedCount', '{{count}} finished', { count: finishedHere.length })}
            </Text>
            <TouchableOpacity onPress={() => act(m.clearForMe(finishedHere))} style={d.btnGhost} activeOpacity={0.8}>
              <Icon name="playlist_remove" size={18} color={BRAND.navy} />
              <Text style={d.btnGhostText}>{t('maint.clearFinished', 'Remove all finished')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── List ── */}
        {list.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="build" size={30} color={NEUTRAL.text4} />
            <Text style={styles.emptyTitle}>
              {tab === 'reported'
                ? t('maint.emptyReview', 'No reports waiting')
                : t('maint.emptyFiltered', 'No tasks here')}
            </Text>
            {tab === 'reported' && (
              <Text style={styles.emptySub}>{t('maint.emptyReviewHint', 'When a housekeeper reports a problem, it lands here.')}</Text>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {list.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                rooms={rooms}
                colors={colors}
                nameOf={m.nameOf}
                selected={drawer?.id === task.id}
                canManage={m.canManage}
                onOpen={() => setDrawer({ id: task.id })}
                onQuick={() => (task.status === 'done'
                  ? act(m.setStatus(task, 'in_progress'))
                  : setConfirmDoneTask(task))}
                onRemove={tab === 'current' ? () => act(m.clearForMe(task)) : undefined}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {!!drawer && (
        <TaskDrawer
          key={drawer.id || 'new'}
          task={openTask}
          isNew={!drawer.id}
          onClose={() => setDrawer(null)}
          colors={colors}
          onConfirmDone={setConfirmDoneTask}
        />
      )}

      <ConfirmDialog
        visible={!!confirmDoneTask}
        title={t('maint.confirmDoneTitle', 'Task completed?')}
        message={t('maint.confirmDoneBody', '"{{title}}" will be marked as fixed and the manager notified.', {
          title: confirmDoneTask?.title || '',
        })}
        confirmLabel={t('maint.confirmDoneYes', "Yes, it's fixed")}
        onConfirm={() => {
          const task = confirmDoneTask;
          setConfirmDoneTask(null);
          act(m.setStatus(task, 'done'));
        }}
        onCancel={() => setConfirmDoneTask(null)}
      />
    </View>
  );
}

/* ─── Row ─────────────────────────────────────────────────────── */

function TaskRow({ task, rooms, colors, nameOf, selected, canManage, onOpen, onQuick, onRemove }) {
  const { t } = useTranslation();
  const finished = isFinished(task);
  const look = finished
    ? { accent: task.status === 'done' ? COLORS.success : NEUTRAL.text4 }
    : (PRIORITY_LOOK[task.priority] || PRIORITY_LOOK.medium);
  const steps = task.checklist || [];
  const quick = canManage && ['open', 'in_progress', 'on_hold', 'done'].includes(task.status);
  return (
    <TouchableOpacity
      onPress={onOpen}
      style={[styles.row, { borderLeftColor: look.accent }, selected && styles.rowSelected,
        isOverdue(task) && styles.rowLate, finished && styles.rowFinished]}
      activeOpacity={0.85}
    >
      <View style={styles.rowIcon}>
        <Icon name="build" size={20} color={BRAND.navy} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowWhere} numberOfLines={1}>{locationLabel(task, rooms).toUpperCase()}</Text>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {task.title}
          {!!task.description && <Text style={styles.rowDesc}>  {task.description}</Text>}
        </Text>
      </View>
      <View style={styles.rowPills}>
        {task.status !== 'open' && <StatusPill status={task.status} />}
        <PriorityPill priority={task.priority} />
        <DuePill task={task} />
        {steps.length > 0 && (
          <Text style={styles.rowMeta}>{steps.filter(s => s.done).length}/{steps.length}</Text>
        )}
        {task.photoCount > 0 && <Icon name="image" size={17} color={NEUTRAL.text3} />}
      </View>
      <View style={styles.rowPeople}>
        <AvatarStack ids={task.assignees} colors={colors} nameOf={nameOf} size={30} />
      </View>
      {task.status === 'reported' && canManage ? (
        <View style={styles.reviewTag}>
          <Text style={styles.reviewTagText}>{t('maint.review', 'Review')}</Text>
        </View>
      ) : quick ? (
        <TouchableOpacity
          onPress={(e) => { e?.stopPropagation?.(); onQuick(); }}
          style={styles.quick}
          activeOpacity={0.7}
          accessibilityLabel={task.status === 'done' ? t('maint.reopen', 'Reopen') : t('maint.markFixed', 'Mark fixed')}
        >
          <Icon
            name={task.status === 'done' ? 'check_circle' : 'radio_button_unchecked'}
            size={28}
            color={task.status === 'done' ? COLORS.success : NEUTRAL.text4}
          />
        </TouchableOpacity>
      ) : <View style={styles.quick} />}
      {finished && onRemove ? (
        <TouchableOpacity
          onPress={(e) => { e?.stopPropagation?.(); onRemove(); }}
          style={styles.removeBtn}
          activeOpacity={0.7}
          accessibilityLabel={t('maint.remove', 'Remove')}
        >
          <Icon name="close" size={18} color={NEUTRAL.text2} />
        </TouchableOpacity>
      ) : onRemove ? <View style={styles.removeBtn} /> : null}
    </TouchableOpacity>
  );
}

/* ─── Drawer: create / triage / edit + activity ───────────────── */

function TaskDrawer({ task, isNew, onClose, colors, onConfirmDone }) {
  const { t } = useTranslation();
  const { rooms } = useApp();
  const m = useMaintenance();
  const f = useTaskForm(task);
  const options = useMemo(() => dueOptions(t), [t]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Opened a task that was deleted meanwhile.
  if (!isNew && !task) return null;

  const editable = m.canManage;
  const triage = task?.status === 'reported';

  const run = async (fn, close = true) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (close) onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Past triage, existing steps are ticked live (by the worker too), so the
  // form must not write back its stale copy: keep the live list and append
  // only the steps added in this drawer.
  const liveSteps = task?.checklist || [];
  const newSteps = f.checklist.filter(i => !liveSteps.some(x => x.id === i.id));
  const values = (!isNew && !triage)
    ? { ...f.values, checklist: [...liveSteps, ...newSteps] }
    : f.values;

  const save = () => run(() => (isNew
    ? m.createTask({ ...f.values, photos: f.photos })
    : m.updateTask(task, values)));

  const title = isNew
    ? t('maint.newTitle', 'New maintenance task')
    : triage ? t('maint.triageTitle', 'Review report') : t('maint.editTitle', 'Edit task');

  const subtitle = isNew
    ? t('maint.newSub', 'Assign it and the team gets a notification.')
    : t('maint.reportedByOn', 'Reported by {{who}} · {{when}}', {
      who: m.nameOf(task.reportedBy), when: formatWhen(task.reportedAt),
    });

  const saveLabel = busy
    ? t('saving', 'Saving…')
    : isNew ? t('maint.createTask', 'Create task')
      : triage && f.assignees.length ? t('maint.assignAndSend', 'Assign & notify') : t('save', 'Save');

  return (
    <>
      <Drawer
        visible
        onClose={onClose}
        width={640}
        title={title}
        subtitle={subtitle}
        footer={editable ? (
          <>
            {!isNew && (
              <TouchableOpacity onPress={() => setConfirmDelete(true)} style={[d.btnGhost, styles.dangerGhost]} activeOpacity={0.8}>
                <Icon name="delete" size={18} color={COLORS.danger} />
              </TouchableOpacity>
            )}
            {!isNew && ['reported', 'open'].includes(task.status) && (
              <TouchableOpacity onPress={() => run(() => m.dismiss(task))} style={d.btnGhost} activeOpacity={0.8}>
                <Text style={d.btnGhostText}>{t('maint.dismiss', 'Dismiss')}</Text>
              </TouchableOpacity>
            )}
            {!isNew && task.status === 'dismissed' && (
              <TouchableOpacity onPress={() => run(() => m.restore(task))} style={d.btnGhost} activeOpacity={0.8}>
                <Text style={d.btnGhostText}>{t('maint.restore', 'Restore')}</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} style={d.btnGhost} activeOpacity={0.8}>
              <Text style={d.btnGhostText}>{t('cancel', 'Cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={save}
              disabled={busy || !f.valid}
              style={[d.btnPrimary, (busy || !f.valid) && { opacity: 0.5 }]}
              activeOpacity={0.9}
            >
              <Icon name={triage ? 'send' : 'save'} size={20} color={BRAND.yellow} />
              <Text style={d.btnPrimaryText}>{saveLabel}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      >
        {!!error && <Text style={styles.error}>{error}</Text>}

        {/* ── Status (existing, past triage) ── */}
        {!isNew && !triage && task.status !== 'dismissed' && editable && (
          <View>
            <FieldLabel>{t('maint.statusLabel', 'Status')}</FieldLabel>
            <View style={styles.wrap}>
              {['open', 'in_progress', 'on_hold', 'done'].map(s => (
                <Chip
                  key={s}
                  label={statusLabel(t, s)}
                  selected={task.status === s}
                  disabled={busy}
                  onPress={() => {
                    if (task.status === s) return;
                    if (s === 'done') onConfirmDone(task);
                    else run(() => m.setStatus(task, s), false);
                  }}
                />
              ))}
            </View>
            {task.status === 'on_hold' && !!task.holdReason && (
              <Text style={styles.hold}>{task.holdReason}</Text>
            )}
          </View>
        )}

        {editable ? (
          <>
            <View>
              <FieldLabel>{t('maint.titleLabel', 'Task')}</FieldLabel>
              <TextInput
                value={f.title}
                onChangeText={f.setTitle}
                placeholder={t('maint.whatPlaceholder', 'e.g. Shower drain blocked')}
                placeholderTextColor={NEUTRAL.text4}
                maxLength={120}
                style={d.textInput}
              />
            </View>

            <View>
              <FieldLabel>{t('maint.descriptionLabel', 'Description')}</FieldLabel>
              <TextInput
                value={f.description}
                onChangeText={f.setDescription}
                multiline
                maxLength={2000}
                placeholderTextColor={NEUTRAL.text4}
                style={[d.textInput, { minHeight: 90, textAlignVertical: 'top' }]}
              />
            </View>

            <View>
              <FieldLabel>{t('maint.where', 'Where?')}</FieldLabel>
              <LocationPicker rooms={rooms} value={f.location} onChange={f.setLocation} />
            </View>

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <FieldLabel>{t('maint.priorityLabel', 'Priority')}</FieldLabel>
                <View style={styles.wrap}>
                  {PRIORITIES.map(p => (
                    <Chip key={p} label={priorityLabel(t, p)} selected={f.priority === p} onPress={() => f.setPriority(p)} />
                  ))}
                </View>
              </View>
            </View>

            <View>
              <FieldLabel>{t('maint.dueLabel', 'Due')}</FieldLabel>
              <View style={[styles.wrap, { alignItems: 'center' }]}>
                {options.map(o => (
                  <Chip key={o.key} label={o.label} selected={f.dueAt === o.value} onPress={() => f.setDueAt(o.value)} />
                ))}
                {React.createElement('input', {
                  type: 'datetime-local',
                  value: toLocalInput(f.dueAt),
                  onChange: (e) => f.setDueAt(e.target.value ? new Date(e.target.value).getTime() : null),
                  style: {
                    height: 38, padding: '0 10px', borderRadius: 10, border: `1px solid ${NEUTRAL.border}`,
                    fontFamily: 'inherit', fontSize: 14, color: NEUTRAL.text, background: NEUTRAL.inputFill,
                  },
                })}
              </View>
            </View>

            <View>
              <FieldLabel>{t('maint.assignTo', 'Assign to')}</FieldLabel>
              {m.assignable.length === 0 ? (
                <Text style={styles.hint}>{t('maint.noTeam', 'No maintenance staff yet. On the Team screen, add someone to the Maintenance team.')}</Text>
              ) : (
                <View style={styles.wrap}>
                  {m.assignable.map(c => {
                    const on = f.assignees.includes(c.id);
                    return (
                      <TouchableOpacity key={c.id} onPress={() => f.toggleAssignee(c.id)} style={[styles.person, on && styles.personOn]} activeOpacity={0.8}>
                        <Avatar name={c.username} color={colors[c.id] || fallbackCleanerColor(c.id)} size={26} />
                        <View>
                          <Text style={styles.personName}>{c.username}</Text>
                          <Text style={styles.personTeam}>
                            {c.kind === 'manager' ? t('maint.kindManager', 'Manager') : t('maint.teamMaintenance', 'Maintenance')}
                          </Text>
                        </View>
                        {on && <Icon name="check" size={18} color={COLORS.success} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View>
              <FieldLabel>{t('maint.checklist', 'Steps')}</FieldLabel>
              {isNew || triage ? (
                <ChecklistEditor items={f.checklist} onAdd={f.addItem} onRemove={f.removeItem} />
              ) : (
                <>
                  <ChecklistView items={task.checklist} onToggle={(id) => m.toggleChecklistItem(task, id)} />
                  <View style={{ marginTop: 10 }}>
                    <ChecklistEditor items={newSteps} onAdd={f.addItem} onRemove={f.removeItem} />
                    {newSteps.length > 0 && (
                      <Text style={styles.hint}>{t('maint.stepsUnsaved', 'New steps are added when you save.')}</Text>
                    )}
                  </View>
                </>
              )}
            </View>

            {isNew && (
              <View>
                <FieldLabel>{t('maint.photos', 'Photos')}</FieldLabel>
                <NewPhotosField photos={f.photos} onChange={f.setPhotos} onError={setError} />
              </View>
            )}
          </>
        ) : (
          <ReadOnly task={task} rooms={rooms} nameOf={m.nameOf} />
        )}

        {!isNew && <Activity task={task} />}
      </Drawer>

      <ConfirmDialog
        visible={confirmDelete}
        title={t('maint.deleteTitle', 'Delete this task?')}
        message={t('maint.deleteBody', 'Photos and comments are removed too. This cannot be undone.')}
        confirmLabel={t('delete', 'Delete')}
        onConfirm={() => { setConfirmDelete(false); run(() => m.deleteTask(task)); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function ReadOnly({ task, rooms, nameOf }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.rowWhere}>{locationLabel(task, rooms).toUpperCase()}</Text>
      <Text style={styles.roTitle}>{task.title}</Text>
      <View style={styles.wrap}>
        <StatusPill status={task.status} />
        <PriorityPill priority={task.priority} />
        <DuePill task={task} />
      </View>
      {!!task.description && <Text style={styles.roDesc}>{task.description}</Text>}
      <Text style={styles.hint}>
        {t('maint.assignedTo', 'Assigned to')}: {(task.assignees || []).map(nameOf).join(', ') || '—'}
      </Text>
      <ChecklistView items={task.checklist} />
    </View>
  );
}

/* Photos + comments. Its own component so the listeners only run while open. */
function Activity({ task }) {
  const { t } = useTranslation();
  const m = useMaintenance();
  const { comments, photos, addComment, addPhoto } = useTaskThread(task);
  const [viewer, setViewer] = useState(null);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const clean = text.trim();
    if (!clean) return;
    setText('');
    try { await addComment(clean); } catch (e) { setText(clean); setError(e.message); }
  };

  const onAddPhoto = async () => {
    const left = MAX_TASK_PHOTOS - photos.length;
    if (left <= 0) return;
    setAdding(true);
    setError('');
    try {
      const picked = await pickPhotos({ source: 'library', limit: Math.min(left, MAX_NEW_PHOTOS) });
      for (const b64 of picked) {
        // eslint-disable-next-line no-await-in-loop
        await addPhoto(b64, task.status === 'done' ? 'fix' : 'progress');
      }
    } catch (e) {
      setError(photoErrorMessage(e, t));
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={styles.activity}>
      <View>
        <FieldLabel>{t('maint.photos', 'Photos')}</FieldLabel>
        <PhotoStrip
          photos={photos}
          onOpen={(_, p) => setViewer(p)}
          onAdd={m.canManage && task.status !== 'reported' && photos.length < MAX_TASK_PHOTOS ? onAddPhoto : undefined}
          adding={adding}
        />
        {photos.length === 0 && !m.canManage && <Text style={styles.hint}>—</Text>}
        <PhotoRetentionNote task={task} />
      </View>

      <View>
        <FieldLabel>{t('maint.comments', 'Comments')}</FieldLabel>
        <View style={{ gap: 8 }}>
          {comments.length === 0 && <Text style={styles.hint}>{t('maint.noComments', 'No comments yet.')}</Text>}
          {comments.map(c => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.commentWho}>{m.nameOf(c.by)} · {formatWhen(c.at)}</Text>
              <Text style={styles.commentText}>{c.text}</Text>
            </View>
          ))}
        </View>
        <View style={styles.commentRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('maint.addComment', 'Add a comment…')}
            placeholderTextColor={NEUTRAL.text4}
            multiline
            maxLength={1000}
            style={[d.textInput, { flex: 1, minHeight: 44 }]}
          />
          <TouchableOpacity onPress={send} disabled={!text.trim()} style={[d.btnPrimary, !text.trim() && { opacity: 0.4 }]} activeOpacity={0.9}>
            <Icon name="send" size={18} color={BRAND.yellow} />
          </TouchableOpacity>
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>

      <PhotoViewer base64={viewer?.data} at={viewer?.at} name={task.title} onClose={() => setViewer(null)} />
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NEUTRAL.appBg },
  page: { padding: 28, gap: 18, maxWidth: 1280, width: '100%', alignSelf: 'center' },

  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderBottomWidth: 1, borderBottomColor: NEUTRAL.border },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1,
  },
  tabOn: { borderBottomColor: BRAND.navy },
  tabText: { fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14.5, color: NEUTRAL.text3 },
  tabTextOn: { color: BRAND.navy, fontFamily: FONTS.semiBold, fontWeight: '600' },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: NEUTRAL.slateChip, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 11.5, color: BRAND.navy },

  filters: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: 340,
    height: 42, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  searchInput: { flex: 1, fontFamily: FONTS.regular, fontSize: 14.5, color: NEUTRAL.text, outlineStyle: 'none' },

  list: { gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
    backgroundColor: NEUTRAL.surface, borderWidth: 1, borderColor: NEUTRAL.border, borderLeftWidth: 4,
  },
  rowSelected: { borderColor: BRAND.navy },
  rowLate: { backgroundColor: '#FFFBFB' },
  rowFinished: { backgroundColor: NEUTRAL.inputFill, opacity: 0.85 },
  removeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: NEUTRAL.slateChip },
  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12,
    backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: COLORS.dangerBorder || COLORS.danger,
  },
  clearBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: NEUTRAL.slateChip, alignItems: 'center', justifyContent: 'center' },
  rowWhere: { fontFamily: FONTS.medium, fontWeight: '500', fontSize: 12, letterSpacing: 0.5, color: NEUTRAL.text3 },
  rowTitle: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 15.5, color: NEUTRAL.text, marginTop: 2 },
  rowDesc: { fontFamily: FONTS.regular, fontWeight: '400', fontSize: 14, color: NEUTRAL.text3 },
  rowPills: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowMeta: { fontFamily: FONTS.medium, fontSize: 12.5, color: NEUTRAL.text3 },
  rowPeople: { width: 90, alignItems: 'flex-end' },
  quick: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  reviewTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: BRAND.yellowSoft },
  reviewTagText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13, color: BRAND.navy },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 64 },
  emptyTitle: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 16, color: NEUTRAL.text2 },
  emptySub: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3 },

  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  twoCol: { flexDirection: 'row', gap: 20 },
  hint: { fontFamily: FONTS.regular, fontSize: 13.5, color: NEUTRAL.text3, marginTop: 6 },
  hold: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.accentDark, marginTop: 8 },
  error: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.danger },
  dangerGhost: { borderColor: COLORS.dangerBorder || COLORS.danger, paddingHorizontal: 12 },

  person: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 999,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  personOn: { borderColor: COLORS.success, backgroundColor: COLORS.successLight },
  personName: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13.5, color: NEUTRAL.text },
  personTeam: { fontFamily: FONTS.regular, fontSize: 11.5, color: NEUTRAL.text3 },

  roTitle: { fontFamily: FONTS.display, fontSize: 22, color: BRAND.navy },
  roDesc: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: NEUTRAL.text },

  activity: { gap: 20, paddingTop: 18, marginTop: 4, borderTopWidth: 1, borderTopColor: NEUTRAL.border },
  comment: { padding: 10, borderRadius: 12, backgroundColor: NEUTRAL.slateChip },
  commentWho: { fontFamily: FONTS.medium, fontSize: 12, color: NEUTRAL.text3, marginBottom: 2 },
  commentText: { fontFamily: FONTS.regular, fontSize: 14.5, color: NEUTRAL.text },
  commentRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 10 },
});