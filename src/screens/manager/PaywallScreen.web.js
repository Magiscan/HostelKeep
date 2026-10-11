// src/screens/manager/PaywallScreen.web.js
//
// The subscription gate for the web manager interface.
//
//   <SubscriptionGate>   wraps ManagerLayout's content: spinner while the
//                        billing document loads, the paywall when it isn't
//                        active, the dashboard otherwise.
//   <SubscriptionBanner> slim notice above the page header during a trial or
//                        the grace period.
//   <ContactDialog>      what every "Subscribe" / "Request a trial" button
//                        opens: how to reach you, and what to include.
//
// New hostels start UNSUBSCRIBED. Trials and subscriptions are both switched on
// by you in the Firebase console once the owner has been in touch.
//
// This is the part people SEE. The part that holds is isPaid() in
// firestore.rules — hiding the dashboard alone would secure nothing.
//
// Visual language follows the existing tokens (navy / gold, Fredoka display,
// 22px panels); there's no prototype for these screens yet.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, ScrollView,
  Modal, Pressable,
} from 'react-native';
import Icon from '../../components/Icon';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL, STATUS } from '../../theme/tokens';
import { isOwner as ownerOf } from '../../utils/permissions';
import { CONTACT_EMAIL, contactMailto } from '../../utils/subscription';
import AccountScreen from './AccountScreen.web';
import { useTranslation } from 'react-i18next';

const formatDate = (ms) => (ms
  ? new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
  : '');

/* ── Gate ──────────────────────────────────────────────────────────── */
export function SubscriptionGate({ children }) {
  const { t } = useTranslation();
  const { subscription } = useApp();

  if (!subscription.loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.navy} />
      </View>
    );
  }
  if (!subscription.active) return <PaywallScreen />;
  return children;
}

/* ── Contact dialog ────────────────────────────────────────────────── */
function CopyField({ label, value, big }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the value is selectable on screen anyway.
    }
  };
  return (
    <View style={styles.copyField}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text style={[styles.copyValue, big && styles.copyValueBig]} selectable numberOfLines={1}>
          {value}
        </Text>
      </View>
      <TouchableOpacity
        onPress={copy}
        style={styles.copyBtn}
        activeOpacity={0.7}
        accessibilityLabel={`Copy ${label}`}
      >
        <Icon name={copied ? 'check' : 'content_copy'} size={16} color={copied ? BRAND.navy : NEUTRAL.text3} />
        <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ContactDialog({ visible, intent = 'subscribe', onClose }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hostel, hostelCode } = useApp();

  const trial = intent === 'trial';
  const proplus = intent === 'proplus';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

        <View style={styles.dialog}>
          <View style={styles.dialogHead}>
            <View style={styles.iconChip}>
              <Icon name={trial ? 'rocket_launch' : proplus ? 'build' : 'workspace_premium'} size={24} color={BRAND.navy} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Icon name="close" size={19} color={NEUTRAL.text3} />
            </TouchableOpacity>
          </View>

          <Text style={styles.dialogTitle}>
            {trial ? t('contactRequestTrialTitle')
              : proplus ? t('contactProPlusTitle', 'Upgrade to Pro+')
                : t('contactSubscribeTitle')}
          </Text>
          <Text style={styles.body}>
            {trial ? t('contactTrialBody')
              : proplus ? t('contactProPlusBody', 'Send us an email with your hostel code and we\'ll switch Maintenance on for your property.')
                : t('contactSubscribeBody')}
          </Text>

          <View style={{ gap: 10 }}>
            <CopyField label={t('contactEmailUs')} value={CONTACT_EMAIL} />
            <CopyField label={t('contactIncludeCode')} value={hostelCode} big />
          </View>

          <Text style={styles.small}>{t('contactUnlocksNote')}</Text>

          <View style={styles.dialogFoot}>
            <TouchableOpacity onPress={onClose} style={styles.ghostBtn} activeOpacity={0.8}>
              <Text style={styles.ghostBtnText}>{t('closeActionFull')}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => Linking.openURL(contactMailto({
                intent, hostelCode, hostelName: hostel?.name, email: user?.email,
              }))}
              style={styles.primaryBtnInline}
              activeOpacity={0.9}
            >
              <Icon name="mail" size={19} color={BRAND.yellow} />
              <Text style={styles.primaryBtnText}>{t('writeEmail')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Paywall ───────────────────────────────────────────────────────── */
export default function PaywallScreen() {
  const { t } = useTranslation();
  const { user, logout, switchHostel } = useAuth();
  const { hostel, hostelCode, subscription } = useApp();
  const owner = ownerOf(user);

  const [showAccount, setShowAccount] = useState(false);
  const [contact, setContact] = useState(null);   // null | 'trial' | 'subscribe'

  const otherHostels = (user?.hostelCodes || []).filter(c => c !== hostelCode);
  const firstHostel = (user?.hostelCodes || []).length <= 1;

  if (showAccount) {
    return (
      <View style={styles.accountWrap}>
        <View style={styles.accountBar}>
          <TouchableOpacity onPress={() => setShowAccount(false)} style={styles.ghostBtn} activeOpacity={0.8}>
            <Icon name="arrow_back" size={18} color={BRAND.navy} />
            <Text style={styles.ghostBtnText}>{t('backAction')}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}><AccountScreen /></View>
      </View>
    );
  }

  // What the owner is looking at decides the words and the buttons.
  let icon = 'lock';
  let title;
  let body;
  let primary = { label: t('paywallSubscribePro'), intent: 'subscribe', icon: 'workspace_premium' };
  let secondary = null;

  if (!owner) {
    title = t('paywallNonOwnerTitle', { name: hostel?.name || t('noProperty') });
    body = t('paywallNonOwnerBody');
    primary = null;
  } else if (subscription.exists && subscription.incomplete) {
    icon = 'build';
    title = t('paywallIncompleteTitle');
    body = t('paywallIncompleteBody');
    primary = { label: t('paywallContactUs'), intent: 'subscribe', icon: 'mail' };
  } else if (!subscription.exists && firstHostel) {
    icon = 'waving_hand';
    title = t('paywallWelcomeTitle');
    body = t('paywallWelcomeBody');
    primary = { label: t('paywallRequestTrial'), intent: 'trial', icon: 'rocket_launch' };
    secondary = { label: t('paywallSubscribePro'), intent: 'subscribe' };
  } else if (!subscription.exists) {
    title = t('paywallActivateTitle', { name: hostel?.name || t('noProperty') });
    body = t('paywallActivateBody');
  } else if (subscription.status === 'trialing') {
    title = t('paywallTrialEndedTitle');
    body = t('paywallTrialEndedBody');
  } else {
    title = t('paywallSubEndedTitle');
    body = t('paywallSubEndedBody');
  }

  const showEnded = subscription.exists && !subscription.incomplete && subscription.endsAt;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <Text style={styles.wordmark}>
        Hostel<Text style={{ color: BRAND.yellow }}>Keep</Text>
      </Text>

      <View style={styles.card}>
        <View style={styles.iconChip}>
          <Icon name={icon} size={26} color={BRAND.navy} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {showEnded && (
          <Text style={styles.meta}>
            {subscription.status === 'trialing'
              ? t('paywallTrialEndedOn', { date: formatDate(subscription.endsAt) })
              : t('paywallPeriodEndedOn', { date: formatDate(subscription.endsAt) })}
          </Text>
        )}

        <View style={styles.reassure}>
          <Icon name="verified_user" size={19} color={STATUS.inspected.text} />
          <Text style={styles.reassureText}>{t('paywallReassure')}</Text>
        </View>

        {owner && (
          <View style={styles.codeBox}>
            <Text style={styles.copyLabel}>{t('paywallYourCode')}</Text>
            <Text style={styles.codeValue} selectable>{hostelCode}</Text>
          </View>
        )}

        {!!primary && (
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={() => setContact(primary.intent)}
              style={styles.primaryBtn}
              activeOpacity={0.9}
            >
              <Icon name={primary.icon} size={20} color={BRAND.yellow} />
              <Text style={styles.primaryBtnText}>{primary.label}</Text>
            </TouchableOpacity>
            {!!secondary && (
              <TouchableOpacity
                onPress={() => setContact(secondary.intent)}
                style={styles.secondaryBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnText}>{secondary.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {otherHostels.length > 0 && (
          <View style={styles.switchBlock}>
            <Text style={styles.copyLabel}>{t('paywallOtherHostels')}</Text>
            <View style={styles.chipRow}>
              {otherHostels.map(code => (
                <TouchableOpacity
                  key={code}
                  onPress={() => switchHostel(code).catch(() => {})}
                  style={styles.chip}
                  activeOpacity={0.8}
                >
                  <Icon name="swap_horiz" size={16} color={NEUTRAL.text2} />
                  <Text style={styles.chipText}>{code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footerRow}>
          <TouchableOpacity onPress={() => setShowAccount(true)} style={styles.ghostBtn} activeOpacity={0.8}>
            <Icon name="manage_accounts" size={18} color={BRAND.navy} />
            <Text style={styles.ghostBtnText}>{t('paywallAccount')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.ghostBtn} activeOpacity={0.8}>
            <Icon name="logout" size={18} color={BRAND.navy} />
            <Text style={styles.ghostBtnText}>{t('signOut')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ContactDialog visible={!!contact} intent={contact || 'subscribe'} onClose={() => setContact(null)} />
    </ScrollView>
  );
}

/* ── Banner ────────────────────────────────────────────────────────── */
export function SubscriptionBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { subscription } = useApp();
  const owner = ownerOf(user);
  const [contactOpen, setContactOpen] = useState(false);

  if (!subscription.loaded || !subscription.active) return null;

  let text = null;
  if (subscription.inGrace || subscription.status === 'past_due') {
    text = t('bannerGrace', { date: formatDate(subscription.accessUntil) });
  } else if (subscription.isTrial && subscription.daysLeft <= 7) {
    text = subscription.daysLeft <= 1
      ? t('bannerTrialEndsToday')
      : t('bannerTrialDaysLeft', { days: subscription.daysLeft });
  } else if (subscription.isTrial) {
    text = t('bannerTrialEndsOn', { date: formatDate(subscription.endsAt) });
  }
  if (!text) return null;

  const urgent = subscription.inGrace || subscription.status === 'past_due' || subscription.daysLeft <= 3;

  return (
    <View style={[styles.banner, urgent && styles.bannerUrgent]}>
      <Icon name={urgent ? 'warning' : 'hourglass_top'} size={18} color={urgent ? STATUS.late.text : '#8A5A00'} />
      <Text style={[styles.bannerText, urgent && { color: STATUS.late.text }]}>{text}</Text>
      {owner && (
        <TouchableOpacity onPress={() => setContactOpen(true)} activeOpacity={0.8}>
          <Text style={styles.bannerLink}>{t('bannerSubscribe')}</Text>
        </TouchableOpacity>
      )}
      <ContactDialog visible={contactOpen} intent="subscribe" onClose={() => setContactOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEUTRAL.appBg, height: '100vh',
  },

  page: { flex: 1, backgroundColor: NEUTRAL.appBg, height: '100vh' },
  pageContent: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 48, paddingHorizontal: 20, gap: 24,
  },
  wordmark: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 28, color: BRAND.navy,
  },

  card: {
    width: '100%', maxWidth: 520, gap: 18,
    padding: 32, borderRadius: 22,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.08,
    shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
  },
  iconChip: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND.yellowSoft,
  },
  title: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 26, lineHeight: 32,
    color: NEUTRAL.text,
  },
  body: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: NEUTRAL.text2 },
  meta: { fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13.5, color: NEUTRAL.text3 },
  small: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: NEUTRAL.text3 },

  reassure: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: 14,
    backgroundColor: STATUS.inspected.bg, borderWidth: 1, borderColor: STATUS.inspected.border,
  },
  reassureText: {
    flex: 1, fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13.5, lineHeight: 19,
    color: STATUS.inspected.text,
  },

  codeBox: {
    padding: 16, borderRadius: 16, gap: 4,
    backgroundColor: NEUTRAL.inputFill, borderWidth: 1, borderColor: NEUTRAL.border,
  },
  codeValue: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 28, letterSpacing: 3,
    color: BRAND.navy, fontVariant: ['tabular-nums'],
  },

  primaryBtn: {
    height: 52, borderRadius: 16, backgroundColor: BRAND.navy,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  primaryBtnInline: {
    height: 48, paddingHorizontal: 20, borderRadius: 15, backgroundColor: BRAND.navy,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 15.5, color: '#FFFFFF',
  },
  secondaryBtn: {
    height: 48, borderRadius: 16,
    borderWidth: 1, borderColor: BRAND.navy, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 15, color: BRAND.navy,
  },

  switchBlock: { gap: 10, paddingTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 34, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  chipText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13.5,
    color: NEUTRAL.text, letterSpacing: 1,
  },

  footerRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 10,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: '#EEF2F7',
  },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 40, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  ghostBtnText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 14, color: BRAND.navy },

  accountWrap: { flex: 1, height: '100vh', backgroundColor: NEUTRAL.appBg },
  accountBar: {
    paddingVertical: 12, paddingHorizontal: 28,
    borderBottomWidth: 1, borderBottomColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    flexDirection: 'row',
  },

  /* Contact dialog */
  scrim: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
    backgroundColor: 'rgba(11,31,58,0.45)',
  },
  dialog: {
    width: '100%', maxWidth: 460, gap: 16,
    padding: 26, borderRadius: 22, backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.28,
    shadowRadius: 40, shadowOffset: { width: 0, height: 18 },
  },
  dialogHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 12,
    borderWidth: 1, borderColor: NEUTRAL.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dialogTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 22, lineHeight: 28, color: NEUTRAL.text,
  },
  dialogFoot: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: '#EEF2F7',
  },

  copyField: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: NEUTRAL.inputFill, borderWidth: 1, borderColor: NEUTRAL.border,
  },
  copyLabel: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 11,
    letterSpacing: 0.88, textTransform: 'uppercase', color: NEUTRAL.text3,
  },
  copyValue: {
    marginTop: 3, fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 15.5, color: NEUTRAL.text,
  },
  copyValueBig: {
    fontFamily: FONTS.display, fontSize: 20, letterSpacing: 2, color: BRAND.navy,
  },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0,
    height: 32, paddingHorizontal: 11, borderRadius: 10,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  copyBtnText: { fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13, color: NEUTRAL.text2 },

  /* Banner */
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 28,
    backgroundColor: BRAND.yellowSoft,
    borderBottomWidth: 1, borderBottomColor: '#F4DDA4',
  },
  bannerUrgent: { backgroundColor: STATUS.late.bg, borderBottomColor: STATUS.late.border },
  bannerText: {
    flex: 1, fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13.5, color: '#8A5A00',
  },
  bannerLink: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13.5,
    color: BRAND.navy, textDecorationLine: 'underline',
  },
});