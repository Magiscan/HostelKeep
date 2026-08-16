import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING } from '../theme';
import { Button, Card, Label, Input } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

export default function CreateHostelScreen() {
  const { t } = useTranslation();
  const { createHostel } = useAuth();
  const navigation = useNavigation();
  const [hostelName, setHostelName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const handleCreate = async () => {
    if (!hostelName.trim() || !username.trim() || !password.trim()) return;
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // FIXED: the old flow referenced an undefined `userCred` — a
      // ReferenceError for anyone who filled in a recovery email, AFTER the
      // hostel had already been created. createHostel writes the user doc,
      // the login lookup and the hostel document in the order the security
      // rules require. Navigation is driven by AuthContext.
      const code = await createHostel({
        hostelName: hostelName.trim(),
        username: username.trim(),
        password,
        recoveryEmail: recoveryEmail.trim(),
      });

      Alert.alert(
        'Hostel created',
        `Your hostel code is ${code}\n\n` +
        'Write this down — your cleaners need it to sign in.',
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.card}>
            <Text style={styles.title}>{t('createHostelTitle')}</Text>
            <Label>{t('hostelName')}</Label>
            <Input
              value={hostelName}
              onChangeText={setHostelName}
              placeholder="e.g. Sunset Hostel"
              autoCapitalize="words"
              style={{ marginBottom: SPACING[3] }}
            />
            <Label>{t('managerUsername')}</Label>
            <Input
              value={username}
              onChangeText={setUsername}
              placeholder={t('managerUsername')}
              autoCapitalize="words"
              style={{ marginBottom: SPACING[3] }}
            />
            <Label>{t('password')}</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              style={{ marginBottom: SPACING[4] }}
            />
            <Label>{t('recoveryEmail')}</Label>
            <Input
              value={recoveryEmail}
              onChangeText={setRecoveryEmail}
              placeholder="manager@example.com (optional)"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{ marginBottom: SPACING[3] }}
            />
            {error ? <Text style={styles.errText}>{error}</Text> : null}
            <Button
              title={loading ? t('creating') : t('createBtn')}
              onPress={handleCreate}
              disabled={!hostelName.trim() || !username.trim() || !password || loading}
              glow
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: SPACING[4] },
  card: { padding: SPACING[4] },
  title: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xxl,
    color: COLORS.text,
    marginBottom: SPACING[6],
    textAlign: 'center',
  },
  errText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.danger,
    marginBottom: SPACING[3],
  },
});