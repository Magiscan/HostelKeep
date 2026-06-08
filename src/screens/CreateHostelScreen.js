import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING } from '../theme';
import { Button, Card, Label, Input } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function CreateHostelScreen() {
  const { registerManager, logout } = useAuth();
  const navigation = useNavigation();
  const [hostelName, setHostelName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successCode, setSuccessCode] = useState('');

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
    setSuccessCode('');

    try {
      const code = generateCode();

      // 1. Create manager account (signs in)
      await registerManager(username.trim(), password, code);

      // 2. Create hostel document
      await setDoc(doc(db, 'hostels', code), {
        name: hostelName.trim(),
        code,
      });

      // 3. Show the success message (set state BEFORE logging out)
      setSuccessCode(code);

      // 4. Sign out – this keeps us on the auth stack, because user becomes null
      await logout();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    // We are already signed out, just navigate to Login
    navigation.replace('Login');
  };

  // ── SUCCESS VIEW ──
  if (successCode) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <Card style={styles.card}>
            <Text style={styles.successTitle}>Hostel created!</Text>
            <Text style={styles.successMessage}>
              Your hostel code has been sent to your email.
            </Text>
            <Text style={styles.codeText}>{successCode}</Text>
            <Text style={styles.hint}>
              Please log in with this code to start managing your hostel.
            </Text>
            <Button
              title="Go to Login"
              onPress={goToLogin}
              glow
              style={{ marginTop: SPACING[6] }}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  // ── CREATION FORM ──
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
            <Text style={styles.title}>Create Your Hostel</Text>
            <Label>Hostel Name</Label>
            <Input
              value={hostelName}
              onChangeText={setHostelName}
              placeholder="e.g. Sunset Hostel"
              autoCapitalize="words"
              style={{ marginBottom: SPACING[3] }}
            />
            <Label>Manager Username</Label>
            <Input
              value={username}
              onChangeText={setUsername}
              placeholder="Your username"
              autoCapitalize="words"
              style={{ marginBottom: SPACING[3] }}
            />
            <Label>Password</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              style={{ marginBottom: SPACING[4] }}
            />
            {error ? <Text style={styles.errText}>{error}</Text> : null}
            <Button
              title={loading ? 'Creating…' : 'Create Hostel'}
              onPress={handleCreate}
              disabled={!hostelName.trim() || !username.trim() || !password || loading}
              glow
            />
            {loading && (
              <View style={{ marginTop: SPACING[4], alignItems: 'center' }}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={{ marginTop: SPACING[2], color: COLORS.textSecondary }}>
                  Setting up your hostel…
                </Text>
              </View>
            )}
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
  successContainer: { flex: 1, justifyContent: 'center', padding: SPACING[4] },
  successTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xxl,
    color: COLORS.success,
    marginBottom: SPACING[4],
    textAlign: 'center',
  },
  successMessage: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING[2],
    textAlign: 'center',
  },
  codeText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xxxl,
    color: COLORS.primary,
    marginBottom: SPACING[2],
    textAlign: 'center',
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING[2],
  },
});