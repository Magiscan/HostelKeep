// src/components/maintenance/ReportIssueSheet.js
//
// "Report a problem" — used by housekeepers (CleanerMaintenanceSection) and
// maintenance workers (MaintenanceScreen). Creates a 'reported' task that
// lands in the manager's "To review" tab and pings managers by push.

import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Switch, Alert, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import BottomSheet from '../BottomSheet';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { COLORS } from '../../theme/colors';
import { LocationPicker, Overline, PrimaryButton, NewPhotosField, maintStyles } from './MaintenanceParts';

export default function ReportIssueSheet({ visible, onClose, rooms, onSubmit, onSent }) {
  const { t } = useTranslation();
  const [where, setWhere] = useState({ places: [], area: '' });
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setWhere({ places: [], area: '' });
    setTitle('');
    setDetails('');
    setUrgent(false);
    setPhotos([]);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const hasPlace = where.places.length > 0 || !!where.area?.trim();
  const canSend = !!title.trim() && hasPlace && !busy;

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      await onSubmit({
        title,
        description: details,
        places: where.places,
        area: where.area,
        priority: urgent ? 'urgent' : 'medium',
        photos,
      });
      reset();
      onClose();
      onSent?.();
    } catch (e) {
      Alert.alert(t('error', 'Error'), e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={close} maxHeightRatio={0.92}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.title}>{t('maint.reportTitle', 'Report a problem')}</Text>
          <Text style={styles.sub}>
            {t('maint.reportSub', 'Your manager will see it and send someone to fix it.')}
          </Text>
        </View>

        <View>
          <Overline>{t('maint.where', 'Where?')}</Overline>
          <LocationPicker rooms={rooms} value={where} onChange={setWhere} />
        </View>

        <View>
          <Overline>{t('maint.what', "What's wrong?")}</Overline>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('maint.whatPlaceholder', 'e.g. Shower drain blocked')}
            placeholderTextColor={NEUTRAL.text4}
            maxLength={120}
            style={maintStyles.input}
          />
        </View>

        <View>
          <Overline>{t('maint.detailsOptional', 'Details (optional)')}</Overline>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder={t('maint.detailsPlaceholder', 'Anything that helps: since when, how bad…')}
            placeholderTextColor={NEUTRAL.text4}
            maxLength={2000}
            multiline
            style={[maintStyles.input, maintStyles.multiline]}
          />
        </View>

        <View>
          <Overline>{t('maint.photos', 'Photos')}</Overline>
          <NewPhotosField photos={photos} onChange={setPhotos} />
        </View>

        <View style={styles.urgentRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.urgentTitle}>{t('maint.urgent', 'Urgent')}</Text>
            <Text style={styles.urgentSub}>
              {t('maint.urgentHint', 'A guest is affected or something is unsafe.')}
            </Text>
          </View>
          <Switch
            value={urgent}
            onValueChange={setUrgent}
            trackColor={{ true: COLORS.danger, false: NEUTRAL.border }}
            thumbColor="#FFFFFF"
          />
        </View>

        <PrimaryButton
          label={busy ? t('maint.sending', 'Sending…') : t('maint.send', 'Send to manager')}
          icon="send"
          onPress={send}
          disabled={!canSend}
        />
        {!hasPlace && !!title.trim() && (
          <Text style={styles.hint}>{t('maint.pickPlace', 'Pick a room or type where it is.')}</Text>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 18, paddingBottom: 24 },
  title: { fontFamily: FONTS.display, fontSize: 22, color: BRAND.navy },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text2, marginTop: 4 },
  urgentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, backgroundColor: NEUTRAL.slateChip,
  },
  urgentTitle: { fontFamily: FONTS.semiBold, fontSize: 15, color: NEUTRAL.text },
  urgentSub: { fontFamily: FONTS.regular, fontSize: 13, color: NEUTRAL.text3, marginTop: 2 },
  hint: { fontFamily: FONTS.regular, fontSize: 13, color: NEUTRAL.text3, textAlign: 'center' },
});