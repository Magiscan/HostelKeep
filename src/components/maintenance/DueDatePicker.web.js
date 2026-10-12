// src/components/maintenance/DueDatePicker.web.js
//
// Web version of DueDatePicker.js (phone-sized web layout): the same quick
// chips plus the browser's own date-and-time field.

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chip } from './MaintenanceParts';
import { dueOptions, toLocalInput } from './maintenanceUi';
import { NEUTRAL } from '../../theme/tokens';
import { FONTS } from '../../theme/typography';

export default function DueDatePicker({ value, onChange }) {
  const { t } = useTranslation();
  const options = useMemo(() => dueOptions(t), [t]);
  const custom = value != null && !options.some(o => o.value === value);

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.wrap}>
        {options.map(o => (
          <Chip key={o.key} label={o.label} selected={!custom && value === o.value} onPress={() => onChange(o.value)} />
        ))}
      </View>
      {React.createElement('input', {
        type: 'datetime-local',
        value: toLocalInput(value),
        'aria-label': t('maint.duePick', 'Pick date & time'),
        onChange: (e) => {
          const ms = e.target.value ? new Date(e.target.value).getTime() : null;
          onChange(Number.isFinite(ms) ? ms : null);
        },
        style: {
          fontFamily: FONTS.regular, fontSize: 15, padding: '10px 12px', borderRadius: 12,
          border: `1px solid ${custom ? NEUTRAL.text3 : NEUTRAL.border}`, color: NEUTRAL.text,
          background: NEUTRAL.surface, maxWidth: 260,
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});