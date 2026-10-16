// src/components/maintenance/TeamSwitch.js
//
// Moving a team member between Housekeeping and Maintenance, with a
// confirmation first. Works on web and native (plain RN Modal).
//
//   const teamSwitch = useTeamSwitch();
//   …
//   <TeamSwitchChip member={c} onPress={() => teamSwitch.request(c)} />
//   …
//   {teamSwitch.dialog}
//
// What the switch does:
//   → Maintenance   their rooms for today are unassigned first (a maintenance
//                   worker never sees the room list, so rooms left on them
//                   would silently go uncleaned). The dialog says how many.
//   → Housekeeping  open maintenance tasks stay assigned to them; the dialog
//                   says so, so the manager can reassign.
//
// The write is users/{uid}.team, allowed by the ROUND 5 users-update clause in
// firestore.rules for anyone with 'manageTeam'. If that clause isn't deployed
// the database answers permission-denied — the dialog says that plainly.

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import Icon from '../Icon';
import { useApp } from '../../contexts/AppContext';
import { FONTS, DISPLAY } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { COLORS } from '../../theme/colors';

const teamOf = (m) => (m?.team === 'maintenance' ? 'maintenance' : 'housekeeping');

export function useTeamSwitch() {
  const { t } = useTranslation();
  const { rooms, unassignRoom, can } = useApp();
  const [member, setMember] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => { if (!busy) { setMember(null); setError(''); } };

  const from = teamOf(member);
  const to = from === 'maintenance' ? 'housekeeping' : 'maintenance';
  const theirRooms = member ? (rooms || []).filter(r => r.assignedTo === member.id) : [];
  const teamName = (k) => (k === 'maintenance'
    ? t('maint.teamMaintenance', 'Maintenance')
    : t('maint.teamHousekeeping', 'Housekeeping'));

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      // 1. The team itself. If this is refused, nothing else is touched.
      await updateDoc(doc(db, 'users', member.id), { team: to });

      // 2. Free their rooms (best effort: needs the 'assign' permission).
      if (to === 'maintenance' && theirRooms.length && can('assign')) {
        for (const r of theirRooms) {
          // eslint-disable-next-line no-await-in-loop
          await unassignRoom(r.id).catch(e => console.warn('unassign failed:', e.code || e.message));
        }
      }
      setMember(null);
    } catch (e) {
      console.error('Team switch failed:', e.code, e.message);
      setError(e?.code === 'permission-denied'
        ? t('teamSwitchDenied', "The database refused this change. Make sure the latest firestore.rules are deployed (they include the team switch), and that your role can manage housekeepers.")
        : (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <Modal visible={!!member} transparent animationType="fade" onRequestClose={close}>
      <View style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={s.card}>
          <View style={s.iconChip}>
            <Icon name={to === 'maintenance' ? 'build' : 'cleaning_services'} size={24} color={BRAND.navy} />
          </View>
          <Text style={s.title}>
            {t('teamSwitchTitle', 'Move {{name}} to {{team}}?', { name: member?.username || '', team: teamName(to) })}
          </Text>
          <Text style={s.body}>
            {to === 'maintenance'
              ? t('teamSwitchToMaint', "They'll stop seeing rooms and see maintenance tasks instead.")
              : t('teamSwitchToHk', "They'll see the room list again and can be assigned rooms.")}
          </Text>
          {to === 'maintenance' && theirRooms.length > 0 && (
            <View style={s.note}>
              <Icon name="info" size={18} color={COLORS.accentDark} />
              <Text style={s.noteText}>
                {t('teamSwitchRooms', '{{count}} room(s) assigned to them today will be unassigned.', { count: theirRooms.length })}
              </Text>
            </View>
          )}
          {to === 'housekeeping' && (
            <View style={s.note}>
              <Icon name="info" size={18} color={COLORS.accentDark} />
              <Text style={s.noteText}>
                {t('teamSwitchTasks', 'Any open maintenance tasks stay assigned to them until you reassign them.')}
              </Text>
            </View>
          )}
          <Text style={s.small}>{t('teamSwitchReopen', 'The change applies next time they open the app.')}</Text>
          {!!error && <Text style={s.error}>{error}</Text>}

          <View style={s.actions}>
            <TouchableOpacity onPress={close} disabled={busy} style={[s.btn, s.ghost]} activeOpacity={0.8}>
              <Text style={s.ghostText}>{t('cancel', 'Cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirm} disabled={busy} style={[s.btn, s.primary, busy && { opacity: 0.6 }]} activeOpacity={0.9}>
              {busy
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={s.primaryText}>{t('teamSwitchConfirm', 'Move to {{team}}', { team: teamName(to) })}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return { request: (m) => { setError(''); setMember(m); }, dialog };
}

/** The control on a member row: shows the current team; tapping asks to
    switch.
      variant="small"  a low labelled chip that sits UNDER the member's name
                       (what the Team screens use — next to the buttons it
                       squeezed the name until it was cut off or wrapped one
                       letter per line)
      variant="icon"   a square button the size of a row's icon buttons
      variant="chip"   the full labelled chip
    Without a variant: icon on phones, chip on the web.
    Hidden without Pro+ (Maintenance is a Pro+ feature, so it isn't shown or
    offered in the store builds), except for someone already on Maintenance,
    who can still be moved back. */
export function TeamSwitchChip({ member, onPress, disabled, variant }) {
  const { t } = useTranslation();
  const { subscription } = useApp();
  const maint = teamOf(member) === 'maintenance';
  if (!subscription?.proPlus && !maint) return null;

  const label = maint ? t('maint.teamMaintenance', 'Maintenance') : t('maint.teamHousekeeping', 'Housekeeping');
  const compact = (variant || (Platform.OS === 'web' ? 'chip' : 'icon')) === 'icon';
  const a11y = `${label}. ${t('teamSwitchA11y', 'Change team')}`;

  if (variant === 'small') {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
        style={[s.mini, maint && s.chipMaint, disabled && s.miniStatic]}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        accessibilityRole="button" accessibilityLabel={a11y}>
        <Icon name={maint ? 'build' : 'cleaning_services'} size={13} color={maint ? '#FFFFFF' : BRAND.navy} />
        <Text style={[s.miniText, maint && { color: '#FFFFFF' }]} numberOfLines={1}>{label}</Text>
        {!disabled && <Icon name="swap_horiz" size={13} color={maint ? '#FFFFFF' : NEUTRAL.text3} />}
      </TouchableOpacity>
    );
  }

  if (compact) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
        style={[s.square, maint && s.chipMaint, disabled && { opacity: 0.5 }]}
        accessibilityRole="button" accessibilityLabel={a11y}>
        <Icon name={maint ? 'build' : 'cleaning_services'} size={22} color={maint ? '#FFFFFF' : BRAND.navy} />
        {!disabled && (
          <View style={[s.swapBadge, maint && s.swapBadgeMaint]}>
            <Icon name="swap_horiz" size={11} color={maint ? BRAND.navy : '#FFFFFF'} />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
      style={[s.chip, maint && s.chipMaint, disabled && { opacity: 0.5 }]}
      accessibilityRole="button" accessibilityLabel={a11y}>
      <Icon name={maint ? 'build' : 'cleaning_services'} size={16} color={maint ? '#FFFFFF' : BRAND.navy} />
      <Text style={[s.chipText, maint && { color: '#FFFFFF' }]} numberOfLines={1}>{label}</Text>
      {!disabled && <Icon name="swap_horiz" size={16} color={maint ? '#FFFFFF' : NEUTRAL.text3} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(11,31,58,0.45)' },
  card: {
    width: '100%', maxWidth: 440, gap: 12, padding: 24, borderRadius: 22, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 8,
  },
  iconChip: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.yellowSoft },
  title: { fontFamily: DISPLAY.semiBold, fontSize: 21, lineHeight: 26, color: NEUTRAL.text },
  body: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 21, color: NEUTRAL.text2 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: COLORS.warningLight },
  noteText: { flex: 1, fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14, color: NEUTRAL.text },
  small: { fontFamily: FONTS.regular, fontSize: 13, color: NEUTRAL.text3 },
  error: { fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14, color: COLORS.danger },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  ghost: { borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  ghostText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 15, color: BRAND.navy },
  primary: { backgroundColor: BRAND.navy },
  primaryText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 15, color: '#FFFFFF' },
  chip: {
    flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  chipMaint: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  square: {
    width: 48, height: 48, flexShrink: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  swapBadge: {
    position: 'absolute', right: -4, bottom: -4, width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.navy,
    borderWidth: 2, borderColor: NEUTRAL.surface,
  },
  swapBadgeMaint: { backgroundColor: BRAND.yellow },
  mini: {
    alignSelf: 'flex-start', flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 24, paddingHorizontal: 8, borderRadius: 999,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  // Read-only (no permission to switch): a label, not a faded button.
  miniStatic: { opacity: 1 },
  miniText: { flexShrink: 1, fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12, color: BRAND.navy },
  chipText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13, color: BRAND.navy },
});