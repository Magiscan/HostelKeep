import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, Modal, Pressable, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING } from '../theme';
import { Button, Card, Label, Input } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

export default function LoginScreenWeb() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigation = useNavigation();

  const [hostelCode, setHostelCode] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Language switcher – subtle top‑right */}
      <TouchableOpacity
        onPress={() => setShowLangModal(true)}
        style={styles.langButton}
        activeOpacity={0.7}
      >
        <Icon name="globe-outline" size={18} color={COLORS.textSecondary} />
        <Text style={styles.langText}>{currentLang.label}</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Minimal branding */}
          <View style={styles.logoRow}>
            <Text style={styles.logo}>✦</Text>
            <Text style={styles.logoName}>{t('appName')}</Text>
          </View>
          <Text style={styles.tagline}>Hostel operations, simplified</Text>

          {/* Compact login card */}
          <Card style={styles.card}>
            <Label>{t('hostelCode')}</Label>
            <Input
              value={hostelCode}
              onChangeText={setHostelCode}
              placeholder="e.g. SUNSET"
              autoCapitalize="characters"
              style={{ marginBottom: SPACING[3] }}
            />

            <Label>{t('username')}</Label>
            <Input
              value={name}
              onChangeText={setName}
              placeholder={t('username')}
              autoCapitalize="words"
              style={{ marginBottom: SPACING[3] }}
            />

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
              style={{ marginTop: SPACING[2] }}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate('CreateHostel')}
              style={styles.createLink}
            >
              <Text style={styles.linkText}>{t('createHostel')}</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Language modal (unchanged) */}
      <Modal visible={showLangModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLangModal(false)}>
          <View style={styles.langCard}>
            <Text style={styles.langTitle}>{t('manager.language')}</Text>
            <View style={{ gap: SPACING[2] }}>
              {LANGS.map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langOption, i18n.language === lang.code && styles.langOptionActive]}
                  onPress={() => { i18n.changeLanguage(lang.code); setShowLangModal(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langOptionText, i18n.language === lang.code && styles.langOptionTextActive]}>
                    {lang.label}
                  </Text>
                  {i18n.language === lang.code && (
                    <Icon name="checkmark-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setShowLangModal(false)}
              style={{ marginTop: SPACING[3], alignSelf: 'center' }}
            >
              <Icon name="close-circle-outline" size={18} color={COLORS.danger} style={{ marginRight: SPACING[1] }} />
              <Text style={{ color: COLORS.danger }}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING[5],
    paddingBottom: SPACING[10],
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginRight: SPACING[4],
    marginTop: SPACING[4],
    padding: 6,
  },
  langText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[2],
    marginBottom: SPACING[1],
  },
  logo: { fontSize: 32, color: COLORS.primary },
  logoName: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING[5],
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: SPACING[4],
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING[3],
  },
  eyeButton: {
    padding: SPACING[2],
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
    paddingVertical: SPACING[2],
    paddingHorizontal: SPACING[3],
    marginBottom: SPACING[3],
  },
  errorText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.danger,
  },
  createLink: {
    marginTop: SPACING[4],
    alignSelf: 'center',
  },
  linkText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.primary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    width: 260,
    ...SHADOW.md,
  },
  langTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: SPACING[3] },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.md,
  },
  langOptionActive: { backgroundColor: COLORS.primaryLight },
  langOptionText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  langOptionTextActive: { color: COLORS.primary, fontFamily: FONTS.bold },
});