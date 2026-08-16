import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Modal, Pressable, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { login, requestPasswordReset } = useAuth();
  const navigation = useNavigation();
  const [hostelCode, setHostelCode] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);

  const currentLang = LANGS.find(l => l.code === i18n.language) || LANGS[0];

  const handle = async () => {
    setLoading(true);
    try {
      setErr('');
      await login(name, pass, hostelCode.trim().toUpperCase());
    } catch (e) {
      setErr(e.message || t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!name.trim() || !hostelCode.trim()) {
      Alert.alert('Error', 'Please enter your username and hostel code first.');
      return;
    }
    // FIXED: used to query the `users` collection unauthenticated — the reason
    // that collection had to be world-readable. It also returned different
    // messages for "user not found" vs "synthetic email", which let anyone
    // test whether a username existed. Now the answer is always the same.
    const message = await requestPasswordReset(name, hostelCode);
    Alert.alert('Password reset', message);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient
            colors={[COLORS.primary, '#3B82F6', COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientHeader}
          >
            <View style={styles.logoCircle}>
              <Text style={styles.logoSpark}>✦</Text>
            </View>
            <Text style={styles.logoName}>{t('appName')}</Text>
            <Text style={styles.logoSub}>{t('hostelsubtitle')}</Text>
          </LinearGradient>

          <Card style={styles.card}>
            {/* Language selector card */}
            <Text style={styles.langLabel}>{t('selectlang')}</Text>
            <TouchableOpacity
              style={styles.langCard}
              onPress={() => setShowLangModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.langCardText}>{currentLang.label}</Text>
              <Icon name="chevron-down" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <Label>{t('hostelCode')}</Label>
            <Input
              value={hostelCode}
              onChangeText={setHostelCode}
              placeholder="e.g. SUNSET"
              autoCapitalize="characters"
              style={{ marginBottom: SPACING[3] }}
            />
            <Label>{t('username')}</Label>
            <Input value={name} onChangeText={setName} placeholder={t('username')} autoCapitalize="words" style={{ marginBottom: SPACING[3] }} />
            <Label>{t('password')}</Label>
            <Input value={pass} onChangeText={setPass} placeholder="••••••••" secureTextEntry style={{ marginBottom: err ? SPACING[3] : SPACING[4] }} />
            {!!err && <Text style={styles.errText}>{err}</Text>}
            {/* Forgot password */}
            <TouchableOpacity
              style={styles.forgotBtn}
              activeOpacity={0.6}
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
            <Button
              title={loading ? t('signingIn') : t('signIn')}
              onPress={handle}
              size="lg"
              glow
              disabled={!hostelCode.trim() || !name.trim() || !pass || loading}
            />
            <TouchableOpacity onPress={() => navigation.navigate('CreateHostel')} style={{ marginTop: SPACING[4], alignSelf: 'center' }}>
              <Text style={styles.linkText}>{t('createHostel')}</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Language selection modal */}
      <Modal visible={showLangModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLangModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('selectlanguage')}</Text>
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
            <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: SPACING[2] }} />
            <TouchableOpacity
              onPress={() => setShowLangModal(false)}
              style={[styles.langOption, { justifyContent: 'center' }]}
              activeOpacity={0.7}
            >
              <Icon name="close-circle-outline" size={18} color={COLORS.danger} style={{ marginRight: SPACING[1] }} />
              <Text style={[styles.langOptionText, { color: COLORS.danger }]}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING[5], paddingBottom: SPACING[10] },
  gradientHeader: {
    alignItems: 'center',
    paddingVertical: SPACING[10],
    paddingHorizontal: SPACING[5],
    borderRadius: RADIUS.xl,
    marginBottom: SPACING[8],
    ...SHADOW.md,
  },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING[4],
  },
  logoSpark: { fontSize: 40, color: COLORS.white },
  logoName: { fontFamily: FONTS.bold, fontSize: 32, color: COLORS.white, letterSpacing: -0.5, marginBottom: 6 },
  logoSub: { fontFamily: FONTS.regular, fontSize: 16, color: 'rgba(255,255,255,0.9)' },
  card: { padding: SPACING[4] },
  langLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING[2],
  },
  langCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[3],
    marginBottom: SPACING[4],
  },
  langCardText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  errText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.danger, marginBottom: SPACING[3] },
  linkText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.primary },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[6],
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[5],
    width: '100%',
    maxWidth: 320,
    ...SHADOW.md,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xl,
    color: COLORS.text,
    marginBottom: SPACING[4],
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.md,
  },
  langOptionActive: {
    backgroundColor: COLORS.primaryLight,
  },
  langOptionText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  langOptionTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: SPACING[3],
  },
  forgotText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    opacity: 0.8,
  },
});