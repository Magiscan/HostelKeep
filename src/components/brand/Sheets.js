// ─────────────────────────────────────────────────────────────────────────────
// ProSheet · ProfileMenu · SetupSheet
//
// Transcribed from the prototype's showPro / showProfile / showSetup branches.
//
// ProfileMenu is shared by BOTH roles — the prototype uses one component for the
// manager and the housekeeper, and it is NOT a bottom sheet: it's a 250px
// popover anchored under the avatar in the top-right.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
  View, Text, Image, Modal, Pressable, TouchableOpacity, ScrollView,
  TextInput, Linking, Alert, StyleSheet,
} from 'react-native';
import Icon from '../Icon';
import { BRAND, NEUTRAL, RADII, SPACE } from '../../theme/tokens';
import { type } from '../../theme/typography';

/* ── ProSheet ──────────────────────────────────────────────────────
   Navy sheet, scrim rgba(11,31,58,0.62). Opened from the wordmark pill,
   the "Live" tab, and the "Buy Pro" row in SetupSheet.                    */
export function ProSheet({
  visible,
  onClose,
  title,
  subtitle,
  features = [],          // [{ icon, title, sub }]
  notifyLabel,
  onNotify,
  learnMoreLabel,
  learnMoreUrl,
  contactLabel,
  onContact,
  note,                    // plain text, no link: where Pro is managed
  closeLabel = 'Close',
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[s.scrim, { backgroundColor: 'rgba(11,31,58,0.62)' }]} onPress={onClose}>
        <Pressable onPress={() => {}} style={s.proSheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
            <View style={{ gap: 6 }}>
              <Text style={s.proOverline}>HostelKeep Pro</Text>
              <Text style={s.proTitle}>{title}</Text>
              {!!subtitle && <Text style={s.proSub}>{subtitle}</Text>}
            </View>

            <View style={{ gap: 10 }}>
              {features.map(f => (
                <View key={f.title} style={s.proFeature}>
                  <Icon name={f.icon} size={22} color={BRAND.yellow} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={s.proFeatureTitle}>{f.title}</Text>
                    <Text style={s.proFeatureSub}>{f.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            {!!onNotify && (
              <TouchableOpacity style={s.proPrimary} onPress={onNotify} activeOpacity={0.9}>
                <Icon name="monitoring" size={22} color={BRAND.navy} />
                <Text style={s.proPrimaryText}>{notifyLabel}</Text>
              </TouchableOpacity>
            )}

            {!!note && <Text style={s.proNote}>{note}</Text>}

            {!!learnMoreUrl && (
              <TouchableOpacity
                style={s.proOutline}
                onPress={() => Linking.openURL(learnMoreUrl)}
                activeOpacity={0.85}
              >
                <Icon name="open_in_new" size={21} color={BRAND.yellow} />
                <Text style={s.proOutlineText}>{learnMoreLabel}</Text>
              </TouchableOpacity>
            )}

            {!!onContact && (
              <TouchableOpacity style={s.proOutline} onPress={onContact} activeOpacity={0.85}>
                <Text style={s.proOutlineText}>{contactLabel}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.proClose} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.proCloseText}>{closeLabel}</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── ProfileMenu ───────────────────────────────────────────────────
   NOT a bottom sheet. 250px popover, top-right, 74px from the top so it
   sits just under the avatar bubble. Same for manager and housekeeper.     */
export function ProfileMenu({
  visible,
  onClose,
  name,
  hostelName,
  photoUri,
  onChangePhoto,
  langLabel,
  onLanguage,
  onChangePassword,
  onAccount,
  onSignOut,
  labels = {},
}) {
  const initials = (name || '')
    .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.menuScrim} onPress={onClose}>
        <Pressable onPress={() => {}} style={s.menuCard}>
          {/* Header — tapping the avatar changes the photo */}
          <TouchableOpacity
            style={s.menuHead}
            onPress={onChangePhoto}
            activeOpacity={0.85}
            disabled={!onChangePhoto}
          >
            <View style={s.menuAvatar}>
              {photoUri
                ? <Image source={{ uri: photoUri }} style={s.menuAvatarImg} />
                : <Text style={s.menuAvatarText}>{initials}</Text>}
              {!!onChangePhoto && (
                <View style={s.menuAvatarOverlay}>
                  <Icon name="photo_camera" size={22} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Text style={s.menuName} numberOfLines={1}>{name}</Text>
              <Text style={s.menuMeta} numberOfLines={1}>{hostelName}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.menuRow} onPress={onLanguage} activeOpacity={0.7}>
            <Icon name="language" size={22} color={NEUTRAL.text3} />
            <Text style={s.menuRowText}>{labels.language || 'Language'}</Text>
            <Text style={s.menuRowValue}>{langLabel}</Text>
          </TouchableOpacity>

          {!!onChangePassword && (
            <TouchableOpacity style={s.menuRow} onPress={onChangePassword} activeOpacity={0.7}>
              <Icon name="key" size={22} color={NEUTRAL.text3} />
              <Text style={s.menuRowText}>{labels.changePassword || 'Change password'}</Text>
              <Icon name="chevron_right" size={20} color={NEUTRAL.text4} />
            </TouchableOpacity>
          )}

          {!!onAccount && (
            <TouchableOpacity style={s.menuRow} onPress={onAccount} activeOpacity={0.7}>
              <Icon name="shield_person" size={22} color={NEUTRAL.text3} />
              <Text style={s.menuRowText}>{labels.account || 'Account & privacy'}</Text>
              <Icon name="chevron_right" size={20} color={NEUTRAL.text4} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.menuSignOut} onPress={onSignOut} activeOpacity={0.8}>
            <Icon name="logout" size={22} color="#B91C1C" />
            <Text style={s.menuSignOutText}>{labels.signOut || 'Sign out'}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── SetupSheet ────────────────────────────────────────────────────
   Opened from the hostel-logo button beside the toolbar. This is where
   Rooms and Team live — they are NOT tabs.                                 */
export function SetupSheet({
  visible,
  onClose,
  title,
  subtitle,
  hostelName,
  hostelLogoUri,
  onPickLogo,
  onRemoveLogo,
  links = [],             // [{ icon, title, sub, onPress }]
  proLabel,
  onPro,
  feedbackLabel,
  onFeedback,
  closeLabel = 'Close',
  labels = {},
}) {
  const initials = (hostelName || 'H')
    .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[s.scrim, { backgroundColor: 'rgba(11,31,58,0.55)' }]} onPress={onClose}>
        <Pressable onPress={() => {}} style={s.setupSheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            <View style={{ gap: 3 }}>
              <Text style={s.setupTitle}>{title}</Text>
              {!!subtitle && <Text style={s.setupSub}>{subtitle}</Text>}
            </View>

            {/* Hostel identity card */}
            <View style={s.hostelCard}>
              <View style={s.hostelAvatar}>
                {hostelLogoUri
                  ? <Image source={{ uri: hostelLogoUri }} style={s.hostelAvatarImg} />
                  : <Text style={s.hostelAvatarText}>{initials}</Text>}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                <Text style={s.hostelName} numberOfLines={1}>{hostelName}</Text>
                <View style={s.logoBtnRow}>
                  <TouchableOpacity style={s.logoBtn} onPress={onPickLogo} activeOpacity={0.8}>
                    <Icon name="photo_camera" size={19} color={BRAND.navy} />
                    <Text style={s.logoBtnText}>{labels.changeLogo || 'Logo'}</Text>
                  </TouchableOpacity>
                  {!!hostelLogoUri && !!onRemoveLogo && (
                    <TouchableOpacity style={s.logoBtnDanger} onPress={onRemoveLogo} activeOpacity={0.8}>
                      <Icon name="delete" size={19} color="#B91C1C" />
                      <Text style={s.logoBtnDangerText}>{labels.remove || 'Remove'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* Rooms · Team */}
            {links.map(l => (
              <TouchableOpacity key={l.title} style={s.linkRow} onPress={l.onPress} activeOpacity={0.8}>
                <View style={s.linkIcon}>
                  <Icon name={l.icon} size={22} color={BRAND.navy} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Text style={s.linkTitle} numberOfLines={1}>{l.title}</Text>
                  <Text style={s.linkSub} numberOfLines={1}>{l.sub}</Text>
                </View>
                <Icon name="chevron_right" size={22} color={NEUTRAL.text4} />
              </TouchableOpacity>
            ))}

            {!!onPro && (
              <TouchableOpacity style={s.proRow} onPress={onPro} activeOpacity={0.9}>
                <Icon name="workspace_premium" size={22} color={BRAND.yellow} />
                <Text style={s.proRowText}>{proLabel}</Text>
                <Icon name="chevron_right" size={20} color={BRAND.yellow} />
              </TouchableOpacity>
            )}

            {!!onFeedback && (
              <TouchableOpacity style={s.outlineRow} onPress={onFeedback} activeOpacity={0.85}>
                <Icon name="mail" size={22} color={BRAND.navy} />
                <Text style={s.outlineRowText}>{feedbackLabel}</Text>
                <Icon name="chevron_right" size={20} color={NEUTRAL.text4} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.closeRow} onPress={onClose} activeOpacity={0.85}>
              <Text style={s.closeRowText}>{closeLabel}</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}


/* ── ContactSheet ──────────────────────────────────────────────────
   Transcribed from the prototype's `showContact` branch: white sheet,
   radius 26, padding 22, gap 12. An address chip, a subject field, a
   5-row message box, then Send and Close.

   "Send" opens the device's mail client with the fields pre-filled — the app
   has no server to post through, and a mailto: means the person keeps a copy
   in their own sent folder, which is better for them than a fire-and-forget
   form anyway.                                                            */
export function ContactSheet({
  visible,
  onClose,
  email = 'support@hostelkeep.com',
  title,
  defaultSubject = '',
  labels = {},
}) {
  const [subject, setSubject] = React.useState(defaultSubject);
  const [body, setBody] = React.useState('');

  React.useEffect(() => {
    if (visible) { setSubject(defaultSubject); setBody(''); }
  }, [visible, defaultSubject]);

  const send = async () => {
    const url =
      `mailto:${email}?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error('no mail client');
      await Linking.openURL(url);
      onClose();
    } catch (_) {
      // A device with no mail app configured is common enough to handle —
      // showing the address at least leaves them a way through.
      Alert.alert(
        labels.noMailTitle || 'No mail app found',
        (labels.noMailBody || 'Write to us at') + ` ${email}`,
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[s.scrim, { backgroundColor: 'rgba(11,31,58,0.58)' }]} onPress={onClose}>
        <Pressable onPress={() => {}} style={s.contactSheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            <Text style={s.contactTitle}>{title || 'Write to KohCiao'}</Text>

            <View style={s.emailChip}>
              <Icon name="alternate_email" size={20} color={NEUTRAL.text3} />
              <Text style={s.emailChipText} selectable>{email}</Text>
            </View>

            <View style={{ gap: 7 }}>
              <Text style={s.contactLabel}>{labels.subject || 'Subject'}</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                style={s.contactInput}
                placeholderTextColor={NEUTRAL.text4}
              />
            </View>

            <View style={{ gap: 7 }}>
              <Text style={s.contactLabel}>{labels.message || 'Message'}</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                style={s.contactTextarea}
                placeholderTextColor={NEUTRAL.text4}
              />
            </View>

            <TouchableOpacity
              onPress={send}
              disabled={!subject.trim() && !body.trim()}
              style={[
                s.contactSend,
                !subject.trim() && !body.trim() && { backgroundColor: NEUTRAL.deskBg },
              ]}
              activeOpacity={0.9}
            >
              <Icon name="send" size={22} color={BRAND.yellow} />
              <Text style={s.contactSendText}>{labels.send || 'Send'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={s.contactClose} activeOpacity={0.85}>
              <Text style={s.contactCloseText}>{labels.close || 'Close'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 24, paddingTop: 16 },

  /* Contact */
  contactSheet: {
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADII.sheet,
    padding: 22,
  },
  contactTitle: { ...type('screenTitle', { fontSize: 24, color: BRAND.navy }) },
  emailChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: NEUTRAL.border,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
  },
  emailChipText: { ...type('label', { fontSize: 15, color: BRAND.navy }) },
  contactLabel: { ...type('label', { fontSize: 15, color: '#334155' }) },
  contactInput: {
    height: 52, borderRadius: 14,
    borderWidth: 1.5, borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.inputFill,
    paddingHorizontal: 14,
    ...type('label', { fontSize: 16, color: NEUTRAL.text }),
  },
  contactTextarea: {
    minHeight: 120, borderRadius: 16,
    borderWidth: 1.5, borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.inputFill,
    paddingHorizontal: 14, paddingVertical: 12,
    ...type('body', { fontSize: 15, lineHeight: 22, color: NEUTRAL.text }),
  },
  contactSend: {
    minHeight: 56, borderRadius: 16, backgroundColor: BRAND.navy,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  contactSendText: { ...type('btnPrimary', { color: '#FFFFFF' }) },
  contactClose: {
    minHeight: 50, borderRadius: 16,
    borderWidth: 1.5, borderColor: NEUTRAL.border,
    alignItems: 'center', justifyContent: 'center',
  },
  contactCloseText: { ...type('label', { fontSize: 16, color: NEUTRAL.text }) },


  /* Pro */
  proSheet: {
    maxHeight: '90%',
    backgroundColor: BRAND.navy,
    borderRadius: RADII.sheet,
    padding: 24,
  },
  proOverline: {
    ...type('overline', { color: BRAND.yellow }),
  },
  proTitle: { ...type('screenTitle', { fontSize: 27, lineHeight: 30, color: '#FFFFFF' }) },
  proSub:   { ...type('body', { fontSize: 15, lineHeight: 22, color: '#C6D3E4' }) },
  proFeature: {
    flexDirection: 'row', gap: 11, alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, paddingVertical: 13, paddingHorizontal: 15,
  },
  proFeatureTitle: { ...type('label', { fontSize: 16, color: '#FFFFFF' }) },
  proFeatureSub:   { ...type('body', { fontSize: 14, lineHeight: 19, color: '#A9BCD5' }) },
  proPrimary: {
    minHeight: 56, borderRadius: 16, backgroundColor: BRAND.yellow,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  proPrimaryText: { ...type('btnPrimary', { color: BRAND.navy }) },
  proOutline: {
    minHeight: 52, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16,
  },
  proOutlineText: { ...type('label', { fontSize: 16, color: '#FFFFFF' }) },
  proNote: { ...type('body', { fontSize: 14, lineHeight: 20, color: '#C6D3E4', textAlign: 'center' }) },
  proClose: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  proCloseText: { ...type('label', { fontSize: 15, color: '#A9BCD5' }) },

  /* Profile popover */
  menuScrim: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.55)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 74, paddingHorizontal: 18,
  },
  menuCard: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    gap: 10,
    shadowColor: '#0B1F3A', shadowOpacity: 0.28,
    shadowRadius: 40, shadowOffset: { width: 0, height: 18 }, elevation: 18,
  },
  menuHead: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F7',
  },
  menuAvatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: BRAND.navy, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  menuAvatarImg: { width: 54, height: 54 },
  menuAvatarText: { ...type('sectionName', { fontSize: 19, color: BRAND.yellow }) },
  menuAvatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,31,58,0.42)',
    alignItems: 'center', justifyContent: 'center',
  },
  menuName: { ...type('sectionName', { fontSize: 17, color: BRAND.navy }) },
  menuMeta: { ...type('meta', { fontSize: 13, color: NEUTRAL.text3 }) },
  menuRow: {
    minHeight: 50, borderRadius: 14, backgroundColor: '#F8FAFC',
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
  },
  menuRowText:  { ...type('label', { fontSize: 16, color: NEUTRAL.text, flex: 1 }) },
  menuRowValue: { ...type('label', { fontSize: 14, color: NEUTRAL.text3 }) },
  menuSignOut: {
    minHeight: 50, borderRadius: 14, backgroundColor: '#FEE2E2',
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
  },
  menuSignOutText: { ...type('label', { fontSize: 16, color: '#B91C1C' }) },

  /* Setup */
  setupSheet: {
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADII.sheet,
    padding: 22,
  },
  setupTitle: { ...type('screenTitle', { fontSize: 25, lineHeight: 28, color: BRAND.navy }) },
  setupSub:   { ...type('body', { fontSize: 15, lineHeight: 20, color: NEUTRAL.text2 }) },

  hostelCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: NEUTRAL.border,
    borderRadius: 20, padding: 15,
  },
  hostelAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: BRAND.navy, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  hostelAvatarImg:  { width: 64, height: 64 },
  hostelAvatarText: { ...type('sectionName', { fontSize: 21, color: BRAND.yellow }) },
  hostelName: { ...type('sectionName', { fontSize: 19, color: BRAND.navy }) },
  logoBtnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  logoBtn: {
    minHeight: 44, borderRadius: 13,
    borderWidth: 1.5, borderColor: NEUTRAL.border, backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12,
  },
  logoBtnText: { ...type('label', { fontSize: 14, color: NEUTRAL.text }) },
  logoBtnDanger: {
    minHeight: 44, borderRadius: 13,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12,
  },
  logoBtnDangerText: { ...type('label', { fontSize: 14, color: '#B91C1C' }) },

  linkRow: {
    minHeight: 66, borderRadius: 18,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16,
  },
  linkIcon: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: NEUTRAL.slateChip,
    alignItems: 'center', justifyContent: 'center',
  },
  linkTitle: { ...type('sectionName', { fontSize: 20, color: BRAND.navy }) },
  linkSub:   { ...type('body', { fontSize: 14, color: NEUTRAL.text3 }) },

  proRow: {
    minHeight: 56, borderRadius: 16, backgroundColor: BRAND.navy,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
  },
  proRowText: { ...type('btnPrimary', { color: '#FFFFFF', flex: 1 }) },
  outlineRow: {
    minHeight: 56, borderRadius: 16,
    borderWidth: 1.5, borderColor: NEUTRAL.border, backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
  },
  outlineRowText: { ...type('btnPrimary', { color: NEUTRAL.text, flex: 1 }) },
  closeRow: {
    minHeight: 50, borderRadius: 16,
    borderWidth: 1.5, borderColor: NEUTRAL.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeRowText: { ...type('label', { fontSize: 16, color: NEUTRAL.text }) },
});