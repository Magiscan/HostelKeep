// src/screens/LoginScreen.web.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, Modal, Pressable, Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING } from '../theme';
import { Button, Card, Label, Input } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Wordmark } from '../components/brand/Glass';
import { BottomSheet } from '../components/brand/Overlays';

const logo = require('../../assets/logo.png');

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

const FEATURES = [
  { icon: 'flash-outline', text: 'Assign rooms in seconds' },
  { icon: 'bar-chart-outline', text: 'Track progress across every floor, live' },
  { icon: 'document-text-outline', text: 'Export daily reports with one click' },
];

export default function LoginScreenWeb() {
  const { t, i18n } = useTranslation();
  const { login, requestPasswordReset } = useAuth();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const showPanel = width >= 900;

  const [hostelCode, setHostelCode] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const currentLang = LANGS.find(l => l.code === i18n.language) || LANGS[0];
  const isValid = hostelCode.trim() && name.trim() && pass.trim();

  const handle = async () => {
    if (!isValid) return;
    setLoading(true);
    setErr('');
    try {
      await login(name.trim(), pass, hostelCode.trim().toUpperCase());
    } catch (e) {
      setErr(e.message || t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!name.trim() || !hostelCode.trim()) {
      alert('Please enter your username and hostel code first.');
      return;
    }
    const message = await requestPasswordReset(name, hostelCode);
    alert(message);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Top bar: info + language ── */}
      <View style={styles.langWrapper}>
        <TouchableOpacity
          onPress={() => setShowInfo(true)}
          style={styles.infoButton}
          activeOpacity={0.7}
          accessibilityLabel={t('info') || 'Info'}
        >
          <Icon name="information-circle-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowLangModal(true)}
          style={styles.langButton}
          activeOpacity={0.7}
        >
          <Icon name="globe-outline" size={15} color={COLORS.textSecondary} />
          <Text style={styles.langText} numberOfLines={1}>{currentLang.label}</Text>
          <Icon name="chevron-down" size={14} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* ── Decorative brand panel (desktop only) ── */}
        {showPanel && (
          <View style={styles.panel}>

            <View style={styles.panelContent}>
              <View style={styles.panelBrandBlock}>
                <View style={styles.panelLogoWrap}>
                  <Image source={logo} style={styles.panelLogo} resizeMode="contain" />
                </View>
                <View style={styles.panelBrandTextBlock}>
                  <Wordmark size={24} />
                </View>
              </View>

              <Text style={styles.panelHeadline}>Hostel operations,{'\n'}beautifully simple.</Text>
              <Text style={styles.panelSub}>
                Everything your housekeeping team needs, in one calm dashboard.
              </Text>

              <View style={styles.featureList}>
                {FEATURES.map(f => (
                  <View key={f.text} style={styles.featureRow}>
                    <View style={styles.featureIconWrap}>
                      <Icon name={f.icon} size={15} color={COLORS.primary} />
                    </View>
                    <Text style={styles.featureText}>{f.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Form side ── */}
        <KeyboardAvoidingView
          style={styles.formSide}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formHeader}>
              {!showPanel && (
                <View style={styles.mobileBrandBlock}>
                  <View style={styles.mobileBrandLogoWrap}>
                    <Image source={logo} style={styles.mobileBrandLogo} resizeMode="contain" />
                  </View>
                  <View style={styles.mobileBrandTextBlock}>
                    <Wordmark size={27} />
                  </View>
                </View>
              )}
              <Text style={styles.welcomeTitle}>Hello there!</Text>
              <Text style={styles.welcomeSub}>Sign in to manage today's cleaning.</Text>
            </View>

            <Card style={styles.card}>
              <View style={styles.fieldGroup}>
                <Label>{t('hostelCode')}</Label>
                <Input
                  value={hostelCode}
                  onChangeText={setHostelCode}
                  placeholder="e.g. SUNSET"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Label>{t('username')}</Label>
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder={t('username')}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Label>{t('password')}</Label>
                <View style={styles.passwordRow}>
                  <Input
                    value={pass}
                    onChangeText={setPass}
                    placeholder="••••••••"
                    secureTextEntry={!showPass}
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPass(!showPass)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={showPass ? 'eye-outline' : 'eye-off-outline'}
                      size={18}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotBtn}
                activeOpacity={0.6}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {err ? (
                <View style={styles.errorBanner}>
                  <Icon name="alert-circle" size={16} color={COLORS.danger} style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{err}</Text>
                </View>
              ) : null}

              <Button
                title={loading ? t('signingIn') : t('signIn')}
                onPress={handle}
                size="lg"
                glow
                disabled={!isValid || loading}
                style={{ marginTop: SPACING.lg }}
              />

              <TouchableOpacity
                onPress={() => navigation.navigate('CreateHostel')}
                style={styles.createLink}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>{t('createHostel')}</Text>
              </TouchableOpacity>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* ── Language modal ── */}
      <Modal visible={showLangModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLangModal(false)}>
          <Pressable style={styles.langCard} onPress={() => {}}>
            <Text style={styles.langTitle}>{t('manager.language')}</Text>

            <View style={{ gap: SPACING[2] }}>
              {LANGS.map(lang => {
                const active = i18n.language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langItem, active && styles.langItemActive]}
                    onPress={() => { i18n.changeLanguage(lang.code); setShowLangModal(false); }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.langItemText, active && styles.langItemTextActive]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {lang.label}
                    </Text>
                    {active && (
                      <Icon name="checkmark-circle" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setShowLangModal(false)}
              style={styles.closeRow}
              activeOpacity={0.7}
            >
              <Icon name="close-circle-outline" size={18} color={COLORS.danger} />
              <Text style={styles.closeText}>{t('close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Info sheet ── */}
      <BottomSheet visible={showInfo} onClose={() => setShowInfo(false)}>
        <View style={{ gap: SPACING.xs }}>
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
          <TouchableOpacity
            onPress={() => setShowInfo(false)}
            style={styles.sheetCloseBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.sheetCloseText}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* ── Top bar ─────────────────────────────────────── */
  langWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    zIndex: 20,
  },
  infoButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 140,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    ...SHADOW.sm,
  },
  langText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },

  /* ── Body split ─────────────────────────────────── */
  body: {
    flex: 1,
    flexDirection: 'row',
  },

  /* ── Decorative brand panel ───────────────────────── */
  panel: {
    flex: 1,
    maxWidth: 460,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  panelContent: {
    paddingHorizontal: 48,
    paddingVertical: 40,
  },

  panelBrandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 44,
  },
  panelLogoWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: 14,
  },
  panelLogo: {
    width: 30,
    height: 30,
  },
  panelBrandTextBlock: {
    flex: 1,
    minWidth: 0,
  },

  panelHeadline: {
    fontFamily: FONTS.display,
    fontSize: 34,
    lineHeight: 40,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  panelSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: 40,
    maxWidth: 340,
  },

  featureList: {},
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: SPACING.md,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(11,31,58,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    flex: 1,
    minWidth: 0,
  },

  /* ── Form side ─────────────────────────────────────── */
  formSide: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 56,
  },
  formHeader: {
    width: '100%',
    maxWidth: 400,
    marginBottom: SPACING.lg,
  },

  mobileBrandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  mobileBrandLogoWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: 12,
  },
  mobileBrandLogo: {
    width: 24,
    height: 24,
  },
  mobileBrandTextBlock: {
    flex: 1,
    minWidth: 0,
  },

  welcomeTitle: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  welcomeSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  card: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 24,
    gap: 14,
    ...SHADOW.md,
  },
  fieldGroup: {
    marginBottom: SPACING.md,
  },

  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeButton: {
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderLeftWidth: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    height: '100%',
    justifyContent: 'center',
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.danger,
  },

  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: SPACING[4],
    marginBottom: SPACING[8],
  },
  forgotText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    opacity: 0.85,
  },

  createLink: {
    marginTop: SPACING.md,
    alignSelf: 'center',
  },
  linkText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },

  /* ── Language modal ─────────────────────────────────── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[6],
  },
  langCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[5],
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    overflow: 'hidden',
  },
  langTitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZE.xl,
    color: COLORS.text,
    marginBottom: SPACING[4],
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[4],
    borderRadius: RADIUS.md,
    minHeight: 48,
  },
  langItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  langItemText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginRight: SPACING[2],
  },
  langItemTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  closeRow: {
    marginTop: SPACING[4],
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING[2],
    paddingVertical: SPACING[1],
  },
  closeText: {
    color: COLORS.danger,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
  },

  /* ── Info sheet styles ─────────────────────────────── */
  sheetTitle: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZE.xl,
    color: COLORS.text,
    marginBottom: SPACING[2],
  },
  infoBody: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },
  infoLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  sheetCloseBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  sheetCloseText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.lg,
    color: COLORS.onPrimary,
  },
});