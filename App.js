import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { Buffer } from 'buffer';
import './src/i18n';
import { I18nextProvider } from 'react-i18next';
import i18n from './src/i18n';
global.Buffer = Buffer;

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { AppProvider, useApp } from './src/contexts/AppContext';
import { NotificationProvider } from './src/contexts/NotificationContext';

import LoginScreen from './src/screens/LoginScreen';
import CreateHostelScreen from './src/screens/CreateHostelScreen';
import ManagerApp from './src/screens/manager/ManagerApp';
import CleanerScreen from './src/screens/CleanerScreen';
// FIXED: was an inline require() inside render, which re-resolves on every
// render and defeats bundling. A static import lets Metro pick the .web
// variant on web and tree-shake it out of native builds.
import ManagerLayoutWeb from './src/screens/manager/ManagerLayout.web';

import { COLORS } from './src/theme';
// FIXED: was `import { useFonts, Inter_400Regular, ... } from './src/fonts'`.
// After the Phase 1 rename, src/fonts.js only exports INTER_FONTS + useFonts —
// importing the individual font constants by name silently resolved to
// undefined. This matches what's actually exported now.
import { useFonts, BRAND_FONTS } from './src/fonts';

SplashScreen.preventAutoHideAsync().catch(() => {});

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary:    COLORS.primary,
    background: COLORS.background,
    card:       COLORS.surface,
    text:       COLORS.text,
    border:     COLORS.border,
  },
};

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* FIXED: dropped the explicit LoginScreen.web import and Platform
          ternary. Metro already resolves LoginScreen.web.js on web on its
          own; importing it explicitly pulled the web build into native too. */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="CreateHostel" component={CreateHostelScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const { loaded } = useApp();

  // FIXED: replaces a manual Dimensions.addEventListener effect, which never
  // fired on the very first render and leaked its subscription on fast
  // refresh. useWindowDimensions re-renders correctly on resize.
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'HostelKeep';
    }
  }, []);

  if (loading || !loaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) return <AuthStack />;

  if (user.role === 'manager') {
    // Sidebar layout only on wide web screens.
    if (Platform.OS === 'web' && width >= 768) return <ManagerLayoutWeb />;
    return <ManagerApp />;
  }

  if (user.role === 'cleaner') return <CleanerScreen />;

  // A signed-in account with an unrecognised role is not usable. Previously
  // this fell through to CleanerScreen, which showed another hostel's UI to
  // anyone whose profile failed to load.
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts(BRAND_FONTS);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setAppIsReady(true);
      return undefined;
    }
    // Don't hang forever if the font CDN is unreachable.
    const timer = setTimeout(() => setAppIsReady(true), 2000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) await SplashScreen.hideAsync().catch(() => {});
  }, [appIsReady]);

  if (!appIsReady) return null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider onLayout={onLayoutRootView}>
        <StatusBar style="auto" translucent backgroundColor="transparent" />
        <I18nextProvider i18n={i18n}>
          <AuthProvider>
            <AppProvider>
              <NotificationProvider>
                <NavigationContainer theme={NavTheme}>
                  <RootNavigator />
                </NavigationContainer>
              </NotificationProvider>
            </AppProvider>
          </AuthProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});