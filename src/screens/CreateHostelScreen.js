// src/screens/CreateHostelScreen.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useAuth, looksLikeEmail } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import { FONTS, DISPLAY } from '../theme/typography';
import { SHADOW } from '../theme/shadows';

/**
 * Native counterpart to CreateHostelScreen.web.js — same flow, same rules.
 *
 * THREE THINGS CHANGED, all of them alignment with web:
 *
 *  1. The email is REQUIRED and validated before the call. It stopped being a
 *     "recovery" address when managers moved off synthetic emails: it is now
 *     how they sign in. AuthContext.createHostel already throws without a real
 *     one, so the old optional field meant the form could only fail — and it
 *     failed with a raw error message after the user had filled everything in.
 *
 *  2. The hostel code is shown in a PERSISTENT panel, not an Alert. The code is
 *     the only way housekeepers can ever sign in, and an Alert is dismissed by
 *     reflex. The screen stays put because createHostel provisions on a
 *     secondary Firebase app — primary auth state never changes, so nothing
 *     unmounts this screen out from under the panel.
 *
 *  3. A show/hide toggle on the password, matching web and LoginScreen.
 *
 * Visual language is LoginScreen's, since that is the only way in here.
 */

/* ── Field — same shape as LoginScreen's ──────────────────────────── */
function Field({
  label, value, onChangeText, placeholder, secure, showSecure, onToggleSecure,
  autoCapitalize = 'none', keyboardType, hint, error,
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
          keyboardType={keyboardType}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            focused && styles.inputFocused,
            !!error && styles.inputError,
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

export default function CreateHostelScreen() {
  const { t } = useTranslation();
  const { createHostel } = useAuth();
  const navigation = useNavigation();

  const [hostelName, setHostelName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Set once the hostel exists — swaps the form out for the code panel.
  const [createdCode, setCreatedCode] = useState(null);

  const emailValid = looksLikeEmail(email);
  const canSubmit = !!(hostelName.trim() && username.trim() && password) && !loading;

  const handleCreate = async () => {
    if (!canSubmit) return;

    // Validated here rather than left to the server, so the user is told which
    // field is wrong instead of getting a generic failure after the round trip.
    if (!emailValid) {
      setError(
        t('emailRequired')
        || 'Enter a valid email. It is how you sign in and reset your password.',
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
        recoveryEmail: email.trim(),
      });
      setCreatedCode(code);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Success: the code, and nothing competing with it ── */
  if (createdCode) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.successIcon}>
              <Icon name="check_circle" size={34} color={COLORS.accent} />
            </View>

            <Text style={styles.title}>
              {t('hostelCreated') || 'Hostel created'}
            </Text>
            <Text style={styles.subtitle}>
              {t('hostelCreatedSub')
                || 'Write this code down. Your housekeepers need it to sign in, and it cannot be recovered from the sign-in screen.'}
            </Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>{t('hostelCode')}</Text>
              {/* Selectable so it can be long-pressed and copied without
                  pulling in a clipboard dependency. */}
              <Text style={styles.codeValue} selectable>{createdCode}</Text>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.primaryBtn}
              activeOpacity={0.85}
            >
              <Icon name="login" size={22} color={COLORS.accent} />
              <Text style={styles.primaryBtnText}>{t('signIn')}</Text>
            </TouchableOpacity>

            <Text style={styles.footNote}>
              {t('signInWithEmailHint')
                || `Sign in with ${email.trim()} and the password you just chose.`}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── Form ── */
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // 'height' rather than undefined on Android: with edgeToEdgeEnabled the
        // window no longer resizes for the keyboard, so there is nothing for a
        // plain ScrollView to scroll into.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.iconBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('back') || 'Back'}
            >
              <Icon name="arrow_back" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.title}>{t('createHostelTitle')}</Text>
            <Text style={styles.subtitle}>
              {t('createHostelSub')
                || 'Set up your property and your manager account. It takes a minute.'}
            </Text>
          </View>

          <View style={styles.card}>
            <Field
              label={t('hostelName')}
              value={hostelName}
              onChangeText={setHostelName}
              placeholder="e.g. Sunset Hostel"
              autoCapitalize="words"
            />

            <Field
              label={t('managerUsername')}
              value={username}
              onChangeText={setUsername}
              placeholder={t('managerUsername')}
              autoCapitalize="words"
            />

            <Field
              label={t('email') || 'Email'}
              value={email}
              onChangeText={setEmail}
              placeholder="manager@example.com"
              keyboardType="email-address"
              hint={t('emailHint')
                || 'You sign in with this address, and it is the only way to reset your password.'}
              error={!!email && !emailValid}
            />

            <Field
              label={t('password')}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secure
              showSecure={showPass}
              onToggleSecure={() => setShowPass(v => !v)}
              hint={t('passwordHint') || 'At least 8 characters.'}
            />

            {!!error && (
              <View style={styles.errorBanner}>
                <Icon name="error" size={18} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleCreate}
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
                    name="add_home"
                    size={22}
                    color={canSubmit ? COLORS.accent : COLORS.textMuted}
                  />
                  <Text
                    style={[styles.primaryBtnText, !canSubmit && { color: COLORS.textMuted }]}
                  >
                    {t('createBtn')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 34,
  },

  topBar: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 44, height: 44, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  headingBlock: { marginTop: 24, gap: 4 },
  title: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 32,
    lineHeight: 36,
    color: COLORS.primary,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },

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
  fieldLabel: { fontFamily: FONTS.medium, fontSize: 15, color: '#334155' },
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
  inputError: { borderColor: COLORS.dangerBorder },
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
  hint: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textMuted },

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
  primaryBtnText: { fontFamily: FONTS.semiBold, fontSize: 18, color: COLORS.onPrimary },

  /* Success panel */
  successIcon: {
    width: 62, height: 62, borderRadius: 22,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  codeBox: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surfaceAlt,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 4,
    alignItems: 'center',
  },
  codeLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.textTertiary,
  },
  codeValue: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 36,
    letterSpacing: 3,
    color: COLORS.primary,
  },
  footNote: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
});