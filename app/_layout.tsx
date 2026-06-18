import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, Alert, AppState, View } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { SyncProvider } from "../contexts/SyncContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import '../utils/i18n';
import { cargarIdioma } from '../utils/i18n';
import { initDB } from "./db/database";
import { adsService } from "../services/adsService";
import { AppLockScreen } from "../components/AppLockScreen";
import { useSecurity } from "../hooks/useSecurity";

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
    // auth/profile y auth/callback son accesibles con sesión — no redirigir
    // (callback necesita sesión para el flujo de recovery/verificación)
    const secondSegment = (segments as string[])[1];
    const isAuthOnlyScreen = inAuthGroup && secondSegment !== 'profile' && secondSegment !== 'callback';

    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && isAuthOnlyScreen) {
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F7FF' }}>
        <ActivityIndicator size="large" color="#007AFF" />
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
      <Stack.Screen name="onboarding/referral-code" />
      <Stack.Screen name="settings/referral" />
    </Stack>
  );
}

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const { securityStatus, lockState, authenticate } = useSecurity();
  const [lockScreenDismissed, setLockScreenDismissed] = useState(false);
  const [rootWarningShown, setRootWarningShown] = useState(false);

  // Resetear el dismiss cuando la app se bloquea de nuevo
  useEffect(() => {
    if (lockState.isLocked) {
      setLockScreenDismissed(false);
    }
  }, [lockState.isLocked]);

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

  // Aviso de dispositivo rooteado/emulador (solo una vez)
  useEffect(() => {
    if (rootWarningShown) return;
    if (securityStatus.isEmulator || securityStatus.isRooted) {
      setRootWarningShown(true);
      const mensaje = securityStatus.isEmulator
        ? 'Estás ejecutando la app en un emulador. Tus datos de facturación podrían ser menos seguros.'
        : 'Se ha detectado que tu dispositivo podría estar rooteado. Tus datos de facturación podrían estar en riesgo.';
      Alert.alert('⚠️ Aviso de seguridad', mensaje);
    }
  }, [securityStatus.isEmulator, securityStatus.isRooted, rootWarningShown]);

  // Gestionar AppLock: mostrar pantalla de bloqueo cuando sea necesario
  const showLockScreen = lockState.isLocked && !lockScreenDismissed;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SyncProvider>
          <ThemeProvider>
            <RootNavigator />
            {showLockScreen && (
              <AppLockScreen
                securityStatus={securityStatus}
                lockState={lockState}
                onAuthenticate={authenticate}
              />
            )}
          </ThemeProvider>
        </SyncProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}