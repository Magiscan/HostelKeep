import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING } from '../theme';
import { Button, Card, Label, Input } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const { login } = useAuth();
  const navigation = useNavigation();
  const [hostelCode, setHostelCode] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      setErr('');
      await login(name, pass, hostelCode.trim().toUpperCase());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[COLORS.primary, '#3B82F6', COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientHeader}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoSpark}>✦</Text>
            </View>
            <Text style={styles.logoName}>KeepClean</Text>
            <Text style={styles.logoSub}>Hostel operations, connected</Text>
          </LinearGradient>

          <Card style={styles.card}>
            <Label>Hostel Code</Label>
            <Input
              value={hostelCode}
              onChangeText={setHostelCode}
              placeholder="e.g. AAAAAA"
              autoCapitalize="characters"
              style={{ marginBottom: SPACING[3] }}
            />
            <Label>Username</Label>
            <Input value={name} onChangeText={setName} placeholder="Your username" autoCapitalize="words" style={{ marginBottom: SPACING[3] }} />
            <Label>Password</Label>
            <Input value={pass} onChangeText={setPass} placeholder="••••••••" secureTextEntry style={{ marginBottom: err ? SPACING[3] : SPACING[4] }} />
            {!!err && <Text style={styles.errText}>{err}</Text>}
            <Button
              title={loading ? 'Signing in…' : 'Sign in'}
              onPress={handle}
              size="lg"
              glow
              disabled={!hostelCode.trim() || !name.trim() || !pass || loading}
            />
            <TouchableOpacity onPress={() => navigation.navigate('CreateHostel')} style={{ marginTop: SPACING[4], alignSelf: 'center' }}>
              <Text style={styles.linkText}>Create a new hostel</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
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
    borderRadius: RADIUS.xl,          // all four corners
    marginBottom: SPACING[8],
    ...SHADOW.md,
  },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING[4] },
  logoSpark: { fontSize: 40, color: COLORS.white },
  logoName: { fontFamily: FONTS.bold, fontSize: 32, color: COLORS.white, letterSpacing: -0.5, marginBottom: 6 },
  logoSub: { fontFamily: FONTS.regular, fontSize: 16, color: 'rgba(255,255,255,0.9)' },
  card: { marginBottom: SPACING[4] },
  errText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.danger, marginBottom: SPACING[3] },
  linkText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.primary },
});