// src/components/maintenance/DueDatePicker.js
//
// "Due" on a phone: the quick chips (No date · Today · Tomorrow · …) plus
// "Pick date & time", which opens the system pickers.
//   Android  calendar dialog, then the clock dialog
//   iOS      inline calendar + time under the chips, with a Done button
// The web version is DueDatePicker.web.js (a datetime-local field).
//
// Needs @react-native-community/datetimepicker:  npx expo install @react-native-community/datetimepicker
// It's a native module, so the app has to be rebuilt (a new EAS build), not
// just reloaded.

import React, { useMemo, useState } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Chip } from './MaintenanceParts';
import { dueOptions, formatWhen, defaultCustomDue, minimumDueDate } from './maintenanceUi';

export default function DueDatePicker({ value, onChange }) {
  const { t } = useTranslation();
  const options = useMemo(() => dueOptions(t), [t]);
  const [iosOpen, setIosOpen] = useState(false);

  const custom = value != null && !options.some(o => o.value === value);
  const initial = new Date(value ?? defaultCustomDue());
  const minimumDate = minimumDueDate(value);

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'date',
      minimumDate,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        // Keep the date even if they back out of the time step.
        const day = new Date(date);
        day.setHours(initial.getHours(), initial.getMinutes(), 0, 0);
        onChange(day.getTime());
        // Opening the second dialog straight from the first one's callback
        // is unreliable on some Android versions; let the first close first.
        setTimeout(() => {
          DateTimePickerAndroid.open({
            value: day,
            mode: 'time',
            onChange: (e2, time) => {
              if (e2.type !== 'set' || !time) return;
              const at = new Date(day);
              at.setHours(time.getHours(), time.getMinutes(), 0, 0);
              onChange(at.getTime());
            },
          });
        }, 50);
      },
    });
  };

  const openPicker = () => {
    if (Platform.OS === 'android') { openAndroid(); return; }
    if (value == null || !custom) onChange(initial.getTime());
    setIosOpen(true);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.wrap}>
        {options.map(o => (
          <Chip
            key={o.key}
            label={o.label}
            selected={!custom && value === o.value}
            onPress={() => { setIosOpen(false); onChange(o.value); }}
          />
        ))}
        <Chip
          icon="event"
          label={custom ? formatWhen(value) : t('maint.duePick', 'Pick date & time')}
          selected={custom}
          onPress={openPicker}
        />
      </View>

      {Platform.OS === 'ios' && iosOpen && (
        <View style={styles.iosBox}>
          <DateTimePicker
            value={initial}
            mode="datetime"
            display="inline"
            minimumDate={minimumDate}
            onChange={(_, date) => { if (date) onChange(date.getTime()); }}
          />
          <View style={styles.wrap}>
            <Chip label={t('maint.duePickDone', 'Done')} icon="check" selected onPress={() => setIosOpen(false)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iosBox: { gap: 8 },
});