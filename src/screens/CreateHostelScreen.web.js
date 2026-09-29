import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { Card, Label, Input, Button } from '../components/UI';
import Icon from '../components/Icon';
import { useAuth, looksLikeEmail } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import { FONTS, FONT_SIZE } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { RADIUS } from '../theme/radius';
import { SHADOW } from '../theme/shadows';

/**
 * Web counterpart to CreateHostelScreen.js.
 *
 * Same logic as native — the difference is layout and how the hostel code is
 * delivered. Native uses Alert.alert, which on React Native Web becomes a
 * browser window.alert: easy to dismiss by reflex, and the code can't be
 * copied out of it. Since the code is the ONLY way cleaners can ever sign in,
 * this shows a persistent success panel with a copy button instead.
 */
export default function CreateHostelScreen() {
  const { t } = useTranslation();
  const { createHostel } = useAuth();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [hostelName, setHostelName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Set once the hostel exists — swaps the form out for the code panel.
  const [createdCode, setCreatedCode] = useState(null);
  const [copied, setCopied] = useState(false);

  const emailValid = looksLikeEmail(recoveryEmail);

  const handleCreate = async () => {
    if (!hostelName.trim() || !username.trim() || !password.trim()) return;
    if (!emailValid) {
      setError(
        t('emailRequired')
        || 'Enter a valid email. It is how you sign in and reset your password.'
      );
      return;
    }
    if (password.length < 8) {
      setError(t('passwordTooShort') || 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const code = await createHostel({
        hostelName: hostelName.trim(),
        username: username.trim(),
        password,
        recoveryEmail: recoveryEmail.trim(),
      });
      setCreatedCode(code);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API needs a secure context (https or localhost). The code is
      // shown in full on screen either way, so this failing isn't a problem.
    }
  };

  const canSubmit =
    hostelName.trim() && username.trim() && password && emailValid && !loading;

  /* ── Success panel ──────────────────────────────────────────── */
  if (createdCode) {
    return (
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.centerScroll}>
          <Card style={styles.card}>
            <View style={styles.successIconWrap}>
              <Icon name="checkmark-circle" size={40} color={COLORS.success} />
            </View>

            <Text style={styles.successTitle}>
              {t('hostelCreated') || 'Hostel created'}
            </Text>
            <Text style={styles.successSub}>
              {t('yourHostelCodeIs') || 'Your hostel code is'}
            </Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeText} selectable>{createdCode}</Text>
              <TouchableOpacity onPress={copyCode} style={styles.copyBtn} activeOpacity={0.7}>
                <Icon
                  name={copied ? 'checkmark' : 'download-outline'}
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.copyBtnText}>
                  {copied ? (t('copied') || 'Copied') : (t('copy') || 'Copy')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.emailedNote}>
              {t('codeEmailedTo') || 'Sent to'} {recoveryEmail.trim()}
            </Text>

            <View style={styles.warnBox}>
              <Icon name="alert-circle" size={16} color={COLORS.warning} />
              <Text style={styles.warnText}>
                {t('saveCodeWarning')
                  || 'Write this down. Your cleaners need this code to sign in, and it cannot be recovered from the login screen.'}
              </Text>
            </View>

            <Button
              title={t('continue') || 'Continue'}
              onPress={() => navigation.navigate('Login')}
              glow
            />
          </Card>
        </ScrollView>
      </View>
    );
  }

  /* ── Form ───────────────────────────────────────────────────── */
  const form = (
    <Card style={styles.card}>
      <Text style={styles.formTitle}>{t('createHostelTitle')}</Text>
      <Text style={styles.formSub}>
        {t('createHostelSubtitle') || 'Set up your property and manager account.'}
      </Text>

      <View style={styles.fieldGroup}>
        <Label>{t('hostelName')}</Label>
        <Input
          value={hostelName}
          onChangeText={setHostelName}
          placeholder="e.g. Sunset Hostel"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Label>{t('managerUsername')}</Label>
        <Input
          value={username}
          onChangeText={setUsername}
          placeholder={t('managerUsername')}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Label>{t('yourEmail')}</Label>
        <Input
          value={recoveryEmail}
          onChangeText={setRecoveryEmail}
          placeholder="you@hostel.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Text style={styles.hint}>
          {t('emailHint')
            || 'You sign in with this address, and password resets go here. We send your hostel code to it too.'}
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Label>{t('password')}</Label>
        <View style={styles.passwordRow}>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            style={styles.passwordInput}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(v => !v)}
            style={styles.eyeButton}
            activeOpacity={0.7}
          >
            <Icon
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          {t('passwordHint') || 'At least 8 characters.'}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle" size={16} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button
        title={loading ? t('creating') : t('createBtn')}
        onPress={handleCreate}
        disabled={!canSubmit}
        size="lg"
        glow
      />

      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        style={styles.backBtn}
        activeOpacity={0.7}
      >
        <Icon name="arrow-back" size={16} color={COLORS.primary} />
        <Text style={styles.backText}>{t('backToLogin') || 'Back to sign in'}</Text>
      </TouchableOpacity>
    </Card>
  );

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={isWide ? styles.splitScroll : styles.centerScroll}>
        {isWide && (
          <View style={styles.brandPanel}>
            <Text style={styles.brandTitle}>{t('appName')}</Text>
            <Text style={styles.brandTagline}>{t('hostelsubtitle')}</Text>

            <View style={styles.bulletList}>
              {[
                t('featureFloors') || 'Build your floors, rooms and beds once',
                t('featureAssign') || 'Assign rooms to cleaners in seconds',
                t('featureTrack') || 'Track progress live and export daily reports',
              ].map((line, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Icon name="checkmark-circle" size={18} color={COLORS.primary} />
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.formPanel}>{form}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },

  centerScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  splitScroll: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xxl,
    padding: SPACING.xxl,
  },

  /* Left-hand marketing panel (wide screens only) */
  brandPanel: { maxWidth: 380, flexShrink: 1 },
  brandTitle: {
    fontFamily: FONTS.bold,
    fontSize: 40,
    color: COLORS.text,
    letterSpacing: -0.8,
  },
  brandTagline: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.lg,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  bulletList: { marginTop: SPACING.xl, gap: SPACING.md },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  bulletText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },

  formPanel: { width: '100%', maxWidth: 440, alignItems: 'center' },

  card: {
    width: '100%',
    maxWidth: 440,
    padding: SPACING.lg,
    ...SHADOW.md,
  },
  formTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xxl,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  formSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  fieldGroup: { marginBottom: SPACING.md },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  passwordRow: { flexDirection: 'row', alignItems: 'stretch' },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  eyeButton: {
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderLeftWidth: 0,
    borderTopRightRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    justifyContent: 'center',
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.danger,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  backText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },

  /* Success panel */
  successIconWrap: { alignSelf: 'center', marginBottom: SPACING.md },
  successTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xxl,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  successSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  codeBox: {
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  codeText: {
    fontFamily: FONTS.bold,
    fontSize: 40,
    letterSpacing: 6,
    color: COLORS.primary,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  copyBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },
  emailedNote: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  warnText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
});