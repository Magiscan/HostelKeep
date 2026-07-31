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
  Dimensions,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { AppProvider, useApp } from './src/contexts/AppContext';
import LoginScreen from './src/screens/LoginScreen';
import CreateHostelScreen from './src/screens/CreateHostelScreen';
import ManagerApp from './src/screens/manager/ManagerApp';
import CleanerScreen from './src/screens/CleanerScreen';
import { COLORS } from './src/theme';

import { NotificationProvider } from './src/contexts/NotificationContext';
import LoginScreenWeb from './src/screens/LoginScreen.web';  // web

// Platform‑specific font loading
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from './src/fonts';

SplashScreen.preventAutoHideAsync();

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
  },
};

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={Platform.OS === 'web' ? LoginScreenWeb : LoginScreen} />
      <Stack.Screen name="CreateHostel" component={CreateHostelScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const { loaded } = useApp();

  // Track screen width for responsive layout
  const [screenWidth, setScreenWidth] = useState(
    Platform.OS === 'web' ? Dimensions.get('window').width : 0
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener('change', handleChange);
    return () => subscription?.remove();
  }, []);

  if (!loaded || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) return <AuthStack />;
  // if (user.role === 'manager') return <ManagerApp />;
  if (user.role === 'manager') {
    // Use sidebar layout only on wide web screens (≥768px)
    if (Platform.OS === 'web' && screenWidth >= 768) {
      if (typeof document !== 'undefined') document.title = 'KeepClean';
      const ManagerLayout = require('./src/screens/manager/ManagerLayout.web').default;
      return <ManagerLayout />;
    }
    return <ManagerApp />;
  }
  return <CleanerScreen />;
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  const [fontsLoaded, fontError] = Platform.OS === 'web'
    ? [true, null]
    : useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
      });

  useEffect(() => {
    if (fontsLoaded || fontError) setAppIsReady(true);
    else {
      const timer = setTimeout(() => setAppIsReady(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, fontError]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) await SplashScreen.hideAsync();
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
});