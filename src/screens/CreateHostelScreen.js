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
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function CreateHostelScreen() {
  const { t } = useTranslation();
  const { registerManager, login } = useAuth();
  const navigation = useNavigation();
  const [hostelName, setHostelName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreate = async () => {
    if (!hostelName.trim() || !username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');

    try {
      const code = generateCode();

      // 1. Create the manager's Firebase Auth account (this signs them in)
      await registerManager(username.trim(), password, code);

      // 2. Now that the user is authenticated, create the hostel document
      await setDoc(doc(db, 'hostels', code), {
        name: hostelName.trim(),
        code,
      });

      if (recoveryEmail.trim()) {
        await setDoc(doc(db, 'users', userCred.user.uid), { recoveryEmail: recoveryEmail.trim() }, { merge: true });
      }

      // 3. Login to load the full user object (hostelCode, role, etc.) into context
      await login(username, password, code);
      // navigation is handled automatically by AuthContext – no need to navigate
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