import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, AppState, View } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { SyncProvider } from "../contexts/SyncContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import '../utils/i18n';
import { cargarIdioma } from '../utils/i18n';
import { initDB } from "./db/database";
import { adsService } from "../services/adsService";

/**
 * RootNavigator — stack ÚNICO con TODAS las pantallas.
 *
 * Usar dos Stacks condicionales (uno para auth, otro para app) rompe la
 * navegación en expo‑router porque router.replace despacha la acción al
 * Stack que está montado en ese momento, y ese Stack no tiene las rutas
 * del otro. Con un Stack único, /auth/login y /(tabs) coexisten en el
 * mismo navigator y todas las navegaciones funcionan sin condiciones.
 *
 * La protección de rutas se hace con useSegments + useEffect:
 *   - Si no hay usuario y NO estamos en auth/* → redirect a /auth/login
 *   - Si hay usuario y estamos en auth/login|register|forgot-password|callback → redirect a /(tabs)
 *   - auth/profile se permite con usuario logueado (NO se redirige)
 */
function RootNavigator() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    // auth/profile es accesible con sesión — no redirigir
    const isAuthOnlyScreen = inAuthGroup && segments[1] !== 'profile';

    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && isAuthOnlyScreen) {
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F7FF' }}>
        <ActivityIndicator size="large" color="#6C47FF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
      <Stack.Screen name="auth/forgot-password" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="auth/profile" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/terms" />
      <Stack.Screen name="legal/cookies" />
      <Stack.Screen name="(tabs)/checkout" />
    </Stack>
  );
}

export default function RootLayout() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initDB();
    cargarIdioma();
    adsService.initialize().catch(() => {});
    WebBrowser.maybeCompleteAuthSession();

    // Recargar rewarded ad cuando la app vuelve a foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        adsService.reloadRewardedAd();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SyncProvider>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </SyncProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}