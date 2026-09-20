// src/screens/LoginScreen.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity, Modal, Pressable, TextInput, Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
// Concrete module path, not the barrel — a directory import needs a file named
// exactly `index.js`, which breaks on EAS if the local file is `Index.js`.
import { Wordmark } from '../components/brand/Glass';
import { useAuth, looksLikeEmail } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import { FONTS, DISPLAY } from '../theme/typography';
import { SHADOW } from '../theme/shadows';
import { ProSheet, ContactSheet } from '../components/brand/Sheets';
import { CONTACT_EMAIL } from '../utils/subscription';

/**
 * Transcribed from the prototype ("HostelKeep App.dc.html", isLogin branch),
 * not from the README — the two disagree and the prototype is the source of
 * truth named in the handoff.
 *
 * Structure: scroll column, padding 8/24/34 on #F4F6FA
 *   ├─ top row:   [info 44²]                        [language pill]
 *   ├─ brand:     logo 58² + "HostelKeep" Fredoka 27      (margin-top 46)
 *   ├─ heading:   title Fredoka 34 + sub 16              (margin-top 24)
 *   └─ card:      white, radius 24, padding 20, gap 14   (margin-top 22)
 *        identifier · code (cleaners only) · password(+eye) · forgot ·
 *        Sign in 56 · create
 *
 * ALIGNED WITH THE WEB VERSION. The form used to demand a hostel code, a
 * username and a password from everyone, which stopped working the moment
 * managers moved onto real email addresses:
 *
 *   • `canSubmit` required a hostel code, so a manager — who has none to give
 *     — could never enable the button.
 *   • Even past that, AuthContext.login only reads loginLookup for a NON-email
 *     identifier, and managers have no lookup row. The username path could
 *     only ever fail for them.
 *
 * So there is now one identifier field, exactly as on web: an email means a
 * manager and signs in directly; anything else means a housekeeper, and only
 * then is the hostel code asked for. `looksLikeEmail` makes the call, the same
 * helper AuthContext branches on — one rule, not two that can drift.
 *
 * Forgot-password follows suit. It used to pass (username, hostelCode) to
 * requestPasswordReset, which takes an email address and nothing else; the
 * call was silently useless. Managers now get Firebase's reset mail, and
 * housekeepers — who have synthetic addresses and no inbox — are told to ask
 * their manager, which is the only thing that actually works for them.
 *
 * Note there is NO "Housekeeping Intelligence" tagline under the wordmark —
 * that span is empty in the final prototype.
 */

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

let LOGO_SOURCE = null;
try {
  // eslint-disable-next-line global-require
  LOGO_SOURCE = require('../../assets/logo.png');
} catch (_) {
  LOGO_SOURCE = null;
}

/* ── Field ─────────────────────────────────────────────────────────
   Label 15/500 #334155 over a 52px input: 1.5px border, radius 14,
   fill #FBFCFE, text 17/500. Column gap 7.                              */
function Field({
  label, value, onChangeText, placeholder, secure, onToggleSecure,
  showSecure, autoCapitalize = 'none', letterSpacing = 0, keyboardType,
  hint, onSubmitEditing, returnKeyType,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secure && !showSecure}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            { letterSpacing },
            focused && styles.inputFocused,
            secure && styles.inputWithButton,
          ]}
        />
        {secure && (
          <TouchableOpacity
            onPress={onToggleSecure}
            style={styles.eyeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={showSecure ? 'Hide password' : 'Show password'}
          >
            <Icon
              name={showSecure ? 'visibility_off' : 'visibility'}
              size={22}
              color={COLORS.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { login, requestPasswordReset } = useAuth();
  const navigation = useNavigation();

  // One field for both roles: managers type their email, cleaners their name.
  const [identifier, setIdentifier] = useState('');
  const [hostelCode, setHostelCode] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showPro, setShowPro] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const currentLang = LANGS.find(l => l.code === i18n.language) || LANGS[0];

  // An email means a manager, who signs in directly and needs no hostel code.
  const isManagerLogin = looksLikeEmail(identifier);
  const canSubmit =
    !!(identifier.trim() && pass && (isManagerLogin || hostelCode.trim())) && !loading;

  const handleSignIn = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setErr('');
    setNotice('');
    try {
      await login(identifier.trim(), pass, hostelCode.trim().toUpperCase());
    } catch (e) {
      setErr(e.message || t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErr('');
    if (!isManagerLogin) {
      // Cleaners have no inbox of their own — their manager resets them.
      setNotice(
        t('cleanerResetHint')
        || 'Ask your manager to reset your password from the Team screen. If you are a manager, enter your email address above.',
      );
      return;
    }
    const message = await requestPasswordReset(identifier.trim());
    setNotice(message);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // 'height' rather than undefined on Android: with edgeToEdgeEnabled the
        // window no longer resizes for the keyboard, so a plain ScrollView has
        // nothing to scroll into and the lower fields stay covered.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Top row: info · language ── */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => setShowInfoModal(true)}
              style={styles.iconBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('info') || 'Info'}
            >
              <Icon name="info" size={24} color={COLORS.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowLangModal(true)}
              style={styles.langBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Icon name="language" size={20} color={COLORS.primary} />
              <Text style={styles.langBtnText}>{currentLang.label}</Text>
              <Icon name="expand_more" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* ── Brand: logo + wordmark ── */}
          <View style={styles.brandRow}>
            {LOGO_SOURCE ? (
              <Image source={LOGO_SOURCE} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.logoFallback]}>
                <Text style={styles.logoFallbackText}>HK</Text>
              </View>
            )}
            <Wordmark size={27} />
          </View>

          {/* ── Heading ── */}
          <View style={styles.headingBlock}>
            <Text style={styles.title}>
              {t('loginTitle') || 'Hello there!'}
            </Text>
            <Text style={styles.subtitle}>
              {t('loginSub') || "Sign in to manage today's cleaning."}
            </Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>
            <Field
              label={t('emailOrUsername') || 'Email or username'}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@hostel.com"
              keyboardType="email-address"
              hint={isManagerLogin
                ? (t('managerSignInHint') || 'Signing in as a manager.')
                : (t('identifierHint')
                  || 'Managers use their email. Housekeepers use the username their manager gave them.')}
            />

            {/* Housekeepers only — a manager's email already identifies the
                hostel, and they have no code of their own to type. */}
            {!isManagerLogin && (
              <Field
                label={t('hostelCode')}
                value={hostelCode}
                onChangeText={v => setHostelCode(v.toUpperCase())}
                placeholder="e.g. SUNSET"
                autoCapitalize="characters"
                letterSpacing={0.7}
              />
            )}

            <Field
              label={t('password')}
              value={pass}
              onChangeText={setPass}
              placeholder="••••••••"
              secure
              showSecure={showPass}
              onToggleSecure={() => setShowPass(v => !v)}
              returnKeyType="go"
              onSubmitEditing={handleSignIn}
            />

            {!!err && (
              <View style={styles.errorBanner}>
                <Icon name="error" size={18} color={COLORS.danger} />
                <Text style={styles.errorText}>{err}</Text>
              </View>
            )}

            {!!notice && (
              <View style={styles.noticeBanner}>
                <Icon name="mail" size={18} color={COLORS.primary} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotBtn}
              activeOpacity={0.7}
            >
              {/* The yellow rule is on the text, not the button, so it hugs
                  the words rather than spanning the 44px tap target. */}
              <Text style={styles.forgotText}>
                {t('forgotPassword') || 'Forgot password?'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSignIn}
              disabled={!canSubmit}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.onPrimary} />
              ) : (
                <>
                  <Icon
                    name="login"
                    size={22}
                    color={canSubmit ? COLORS.accent : COLORS.textMuted}
                  />
                  <Text
                    style={[
                      styles.primaryBtnText,
                      !canSubmit && { color: COLORS.textMuted },
                    ]}
                  >
                    {t('signIn')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('CreateHostel')}
              style={styles.secondaryBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>
                {t('createHostel') || 'Create a new hostel'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Language sheet ── */}
      <Modal
        visible={showLangModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLangModal(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowLangModal(false)}>
          <Pressable onPress={() => {}} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {t('selectlanguage') || t('manager.language') || 'Language'}
            </Text>
            {LANGS.map(lang => {
              const active = i18n.language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langRow, active && styles.langRowActive]}
                  onPress={() => {
                    i18n.changeLanguage(lang.code);
                    setShowLangModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.langBadge, active && styles.langBadgeActive]}>
                    <Text style={[styles.langBadgeText, active && styles.langBadgeTextActive]}>
                      {lang.code.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.langRowText, active && styles.langRowTextActive]}>
                    {lang.label}
                  </Text>
                  {active && <Icon name="check_circle" size={22} color={COLORS.accent} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Info sheet ── */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowInfoModal(false)}>
          <Pressable onPress={() => {}} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.overline}>KOHCIAO</Text>
            <Text style={styles.sheetTitle}>{t('appName')}</Text>
            <Text style={styles.infoBody}>
              {t('infoBody')
                || 'HostelKeep helps hostels manage daily room cleaning. '
                 + 'Managers set up rooms and assign them to cleaners; cleaners '
                 + 'see only their own rooms and mark them as they go.'}
            </Text>
            <Text style={styles.infoLabel}>
              {t('infoNoAccount') || 'Don\u2019t have a hostel code?'}
            </Text>
            <Text style={styles.infoBody}>
              {t('infoAskManager')
                || 'Ask your manager \u2014 they create your account and give you '
                 + 'the code, your username and your password.'}
            </Text>

            <View style={styles.linkDivider} />

            <TouchableOpacity
              onPress={() => setShowPro(true)}
              style={styles.linkRow}
              activeOpacity={0.7}
            >
              <View style={styles.linkIcon}>
                <Icon name="workspace_premium" size={20} color={COLORS.accentDark} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.linkTitle}>
                  Hostel<Text style={{ color: COLORS.accent }}>Keep</Text> Pro
                </Text>
                <Text style={styles.linkSub} numberOfLines={1}>
                  {t('pro.loginSub') || 'Live board, reports, multi-property'}
                </Text>
              </View>
              <Icon name="chevron_right" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowContact(true)}
              style={styles.linkRow}
              activeOpacity={0.7}
            >
              <View style={styles.linkIcon}>
                <Icon name="mail" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.linkTitle}>{t('contactUs') || 'Contact us'}</Text>
                <Text style={styles.linkSub} numberOfLines={1}>{CONTACT_EMAIL}</Text>
              </View>
              <Icon name="chevron_right" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowInfoModal(false)}
              style={styles.sheetCloseBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetCloseText}>{t('close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ProSheet
        visible={showPro}
        onClose={() => setShowPro(false)}
        title={t('pro.title') || 'Get HostelKeep Pro'}
        subtitle={t('pro.subscribeSub')
          || 'Live activities, daily history and the web dashboard. To subscribe, contact us by email.'}
        features={[
          { icon: 'monitoring',    title: t('pro.f1') || 'Live board',        sub: t('pro.f1sub') || 'See every room update the moment it happens.' },
          { icon: 'bar_chart',     title: t('pro.f2') || 'Reports & history', sub: t('pro.f2sub') || 'Export daily and monthly performance.' },
          { icon: 'apartment',     title: t('pro.f3') || 'Multi-property',    sub: t('pro.f3sub') || 'Run several hostels from one account.' },
          { icon: 'support_agent', title: t('pro.f4') || 'Priority support',  sub: t('pro.f4sub') || 'Talk to a human, fast.' },
        ]}
        notifyLabel={t('pro.subscribe') || 'Subscribe to Pro'}
        onNotify={() => { setShowPro(false); setShowContact(true); }}
        learnMoreLabel={t('pro.learnMore') || 'Learn more'}
        learnMoreUrl="https://app.hostelkeep.com"
        contactLabel={t('pro.emailUs', { email: CONTACT_EMAIL, defaultValue: CONTACT_EMAIL })}
        onContact={() => { setShowPro(false); setShowContact(true); }}
        closeLabel={t('close')}
      />

      <ContactSheet
        visible={showContact}
        onClose={() => setShowContact(false)}
        title={t('contact.title') || 'Write to KohCiao'}
        defaultSubject="HostelKeep"
        labels={{
          subject: t('contact.subject') || 'Subject',
          message: t('contact.message') || 'Message',
          send:    t('contact.send')    || 'Send',
          close:   t('close'),
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  // Prototype: padding 8px 24px 34px.
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 34,
  },

  /* ── Top bar ── */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
  },
  langBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.primary,
  },

  /* ── Brand ── */
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 46,
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 16,
    // 0 6px 16px rgba(11,31,58,0.18)
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoFallbackText: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 22,
    color: COLORS.primary,
  },

  /* ── Heading ── */
  headingBlock: { marginTop: 24, gap: 4 },
  title: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 34,
    lineHeight: 36,
    color: COLORS.primary,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },

  /* ── Form card ── */
  card: {
    marginTop: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    ...SHADOW.card,
  },
  field: { gap: 7 },
  fieldLabel: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: '#334155',
  },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: FONTS.medium,
    fontSize: 17,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
  },
  inputFocused: { borderColor: COLORS.accent },
  inputWithButton: { paddingRight: 50 },
  eyeBtn: {
    position: 'absolute',
    right: 6,
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 14,
    padding: 12,
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.danger,
  },

  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    padding: 12,
  },
  noticeText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: 14,
    lineHeight: 19,
    color: COLORS.primary,
  },

  forgotBtn: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
  },
  forgotText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.primary,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.accent,
    paddingBottom: 1,
  },

  primaryBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  primaryBtnDisabled: { backgroundColor: COLORS.disabledBg },
  primaryBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: COLORS.onPrimary,
  },

  secondaryBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textTertiary,
  },

  /* ── Sheets ── */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 22,
    gap: 6,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 6,
  },
  overline: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
    color: COLORS.accentDark,
  },
  sheetTitle: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 25,
    color: COLORS.primary,
    marginBottom: 2,
  },

  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  langRowActive: { backgroundColor: COLORS.accentLight },
  langBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadgeActive: { borderColor: COLORS.accent, backgroundColor: COLORS.surface },
  langBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  langBadgeTextActive: { color: COLORS.accentDark },
  langRowText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: COLORS.text,
  },
  langRowTextActive: { fontFamily: FONTS.semiBold, color: COLORS.primary },

  infoLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
    marginTop: 8,
  },
  infoBody: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },
  sheetCloseBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  sheetCloseText: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: COLORS.onPrimary,
  },
  linkDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 56,
  },
  linkIcon: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  linkTitle: { fontFamily: DISPLAY.semiBold, fontSize: 17, color: COLORS.primary },
  linkSub: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary, marginTop: 1 },
});