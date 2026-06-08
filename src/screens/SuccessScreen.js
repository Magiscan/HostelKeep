import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING } from '../theme';
import { Button, Card } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function SuccessScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { logout, setCreatingHostel } = useAuth();
  const code = route.params?.code || '';

  const goToLogin = async () => {
    // Clear the creation flag so the navigator can switch to the app stack later
    setCreatingHostel(false);
    // Sign out the temporary manager account
    await logout();
    // Navigate to the Login screen
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text style={styles.title}>Hostel created!</Text>
          <Text style={styles.message}>Your hostel code is:</Text>
          <Text style={styles.codeText}>{code}</Text>
          <Text style={styles.hint}>
            You will also receive this code via email. Please log in with it to start managing your hostel.
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, justifyContent: 'center', padding: SPACING[4] },
  card: { padding: SPACING[5], alignItems: 'center' },
  title: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xxl,
    color: COLORS.success,
    marginBottom: SPACING[4],
  },
  message: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING[2],
  },
  codeText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xxxl,
    color: COLORS.primary,
    marginBottom: SPACING[2],
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING[2],
  },
});