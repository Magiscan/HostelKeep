// src/components/maintenance/TaskFormSheet.js
//
// Manager form on a phone: create a task, edit one, or triage a report
// (a 'reported' task gets assignees → it becomes 'open' and they get a push).
//
// Render it only while open, keyed by task id, so its state resets:
//   {form && <TaskFormSheet key={form.task?.id || 'new'} task={form.task} onClose={...} />}

import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Image, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import BottomSheet from '../BottomSheet';
import Icon from '../Icon';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { COLORS } from '../../theme/colors';
import { useApp } from '../../contexts/AppContext';
import { buildCleanerColors, fallbackCleanerColor } from '../../utils/cleanerColor';
import { useMaintenance, PRIORITIES } from '../../hooks/useMaintenance';
import {
  Overline, Chip, LocationPicker, ChecklistEditor, Avatar, PrimaryButton, maintStyles,
} from './MaintenanceParts';
import {
  useTaskForm, dueOptions, priorityLabel, formatWhen, capturePhoto, photoErrorMessage,
} from './maintenanceUi';

export default function TaskFormSheet({ task = null, onClose, onSaved }) {
  const { t } = useTranslation();
  const { rooms, cleaners } = useApp();
  const m = useMaintenance();
  const f = useTaskForm(task);
  const [busy, setBusy] = useState(false);
  const colors = useMemo(() => buildCleanerColors(cleaners), [cleaners]);
  const options = useMemo(() => dueOptions(t), [t]);

  const triage = task?.status === 'reported';
  const customDue = f.dueAt && !options.some(o => o.value === f.dueAt);

  const save = async () => {
    if (!f.valid) return;
    setBusy(true);
    try {
      if (task) {
        // Keep ticks made by the worker while this form was open.
        const live = m.tasks.find(x => x.id === task.id)?.checklist || [];
        const checklist = f.checklist.map(i => ({ ...i, done: live.find(x => x.id === i.id)?.done ?? i.done }));
        await m.updateTask(task, { ...f.values, checklist });
      } else {
        await m.createTask({ ...f.values, photoBase64: f.photoBase64 });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      Alert.alert(t('error', 'Error'), e.message);
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    try {
      const b64 = await capturePhoto();
      if (b64) f.setPhotoBase64(b64);
    } catch (e) {
      Alert.alert(t('error', 'Error'), photoErrorMessage(e, t));
    }
  };

  const saveLabel = busy
    ? t('saving', 'Saving…')
    : triage
      ? (f.assignees.length ? t('maint.assignAndSend', 'Assign & notify') : t('save', 'Save'))
      : task ? t('save', 'Save') : t('maint.createTask', 'Create task');

  return (
    <BottomSheet visible onClose={() => !busy && onClose()} maxHeightRatio={0.94}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {triage ? t('maint.triageTitle', 'Review report') : task ? t('maint.editTitle', 'Edit task') : t('maint.newTitle', 'New maintenance task')}
        </Text>

        <View>
          <Overline>{t('maint.titleLabel', 'Task')}</Overline>
          <TextInput
            value={f.title}
            onChangeText={f.setTitle}
            placeholder={t('maint.whatPlaceholder', 'e.g. Shower drain blocked')}
            placeholderTextColor={NEUTRAL.text4}
            maxLength={120}
            style={maintStyles.input}
          />
        </View>

        <View>
          <Overline>{t('maint.descriptionLabel', 'Description')}</Overline>
          <TextInput
            value={f.description}
            onChangeText={f.setDescription}
            placeholderTextColor={NEUTRAL.text4}
            maxLength={2000}
            multiline
            style={[maintStyles.input, maintStyles.multiline]}
          />
        </View>

        <View>
          <Overline>{t('maint.where', 'Where?')}</Overline>
          <LocationPicker rooms={rooms} value={f.location} onChange={f.setLocation} />
        </View>

        <View>
          <Overline>{t('maint.priorityLabel', 'Priority')}</Overline>
          <View style={styles.wrap}>
            {PRIORITIES.map(p => (
              <Chip key={p} label={priorityLabel(t, p)} selected={f.priority === p} onPress={() => f.setPriority(p)} />
            ))}
          </View>
        </View>

        <View>
          <Overline>{t('maint.dueLabel', 'Due')}</Overline>
          <View style={styles.wrap}>
            {options.map(o => (
              <Chip key={o.key} label={o.label} selected={!customDue && f.dueAt === o.value} onPress={() => f.setDueAt(o.value)} />
            ))}
            {customDue && <Chip label={formatWhen(f.dueAt)} selected onPress={() => {}} />}
          </View>
        </View>

        <View>
          <Overline>{t('maint.assignTo', 'Assign to')}</Overline>
          {m.assignable.length === 0 ? (
            <Text style={styles.hint}>{t('maint.noTeam', 'No maintenance staff yet. On the Team screen, add someone to the Maintenance team.')}</Text>
          ) : (
            <View style={{ gap: 6 }}>
              {m.assignable.map(c => {
                const on = f.assignees.includes(c.id);
                return (
                  <TouchableOpacity key={c.id} onPress={() => f.toggleAssignee(c.id)} style={[styles.personRow, on && styles.personRowOn]} activeOpacity={0.8}>
                    <Avatar name={c.username} color={colors[c.id] || fallbackCleanerColor(c.id)} size={30} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{c.username}</Text>
                      <Text style={styles.personTeam}>
                        {c.kind === 'manager' ? t('maint.kindManager', 'Manager') : t('maint.teamMaintenance', 'Maintenance')}
                      </Text>
                    </View>
                    <Icon name={on ? 'check_circle' : 'radio_button_unchecked'} size={24} color={on ? COLORS.success : NEUTRAL.text4} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View>
          <Overline>{t('maint.checklist', 'Steps')}</Overline>
          <ChecklistEditor items={f.checklist} onAdd={f.addItem} onRemove={f.removeItem} />
        </View>

        {!task && (
          <View>
            <Overline>{t('maint.photo', 'Photo')}</Overline>
            {f.photoBase64 ? (
              <TouchableOpacity onPress={() => f.setPhotoBase64(null)} activeOpacity={0.8} style={styles.photoRow}>
                <Image source={{ uri: `data:image/jpeg;base64,${f.photoBase64}` }} style={styles.photo} />
                <Text style={[styles.hint, { color: COLORS.danger }]}>{t('removePhoto', 'Remove photo')}</Text>
              </TouchableOpacity>
            ) : (
              <Chip label={t('cleanerScreen.addPhoto', 'Add a photo')} icon="photo_camera" onPress={takePhoto} />
            )}
          </View>
        )}

        <PrimaryButton label={saveLabel} icon={triage ? 'send' : 'save'} onPress={save} disabled={!f.valid || busy} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 18, paddingBottom: 28 },
  title: { fontFamily: FONTS.display, fontSize: 22, color: BRAND.navy },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: FONTS.regular, fontSize: 13.5, color: NEUTRAL.text3 },
  personRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 12, borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  personRowOn: { borderColor: COLORS.success, backgroundColor: COLORS.successLight },
  personName: { fontFamily: FONTS.semiBold, fontSize: 15, color: NEUTRAL.text },
  personTeam: { fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text3 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 72, height: 72, borderRadius: 12 },
});