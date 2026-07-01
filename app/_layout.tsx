import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
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
import {
  refreshRemoteConfig,
  startLiveUpdates,
  stopLiveUpdates,
  setLiveUpdateInterval,
  LIVE_UPDATE_INTERVALS,
} from "../utils/remoteConfig";

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
 *   - Si hay usuario y estamos en auth/login|register|callback → redirect a /(tabs)
 *   - auth/profile y auth/forgot-password se permiten aunque haya usuario
 *     (profile muestra perfil logueado; forgot-password necesita hacer
 *     sign-in con Google inline para verificar EMAIL antes del reset)
 */
function RootNavigator() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (isLoading) return;
    // Esperar a que el router haya resuelto los segments reales (crítico para deep links)
    if (!rootNavigationState?.key) return;

    const inAuthGroup = segments[0] === 'auth';
    const secondSegment = (segments as string[])[1];
    // auth/callback nunca debe ser interceptada por el guard — gestiona su propio flujo
    const isCallback = inAuthGroup && secondSegment === 'callback';
    // auth/callback gestiona su deep-link flow; auth/profile permite ver perfil
    // estando logueado; auth/forgot-password permite hacer sign-in con Google
    // inline sin que el guard nos expulse a /(tabs) antes de poder escribir
    // la nueva contraseña.
    const isAuthOnlyScreen =
      inAuthGroup &&
      secondSegment !== 'profile' &&
      secondSegment !== 'callback' &&
      secondSegment !== 'forgot-password';

    if (!user && !inAuthGroup && !isCallback) {
      router.replace('/auth/login');
    } else if (user && isAuthOnlyScreen) {
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading, rootNavigationState?.key]);

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

  useEffect(() => {
    initDB();
    cargarIdioma();
    adsService.initialize().catch(() => {});
    // Refrescar configuración remota (referidos + interstitial thresholds)
    // desde Supabase al startup. Esto actualiza el cache compartido de
    // `utils/remoteConfig.ts`, que usan adsService y los componentes.
    // Si falla la red, se mantiene el cache local o defaults — la app sigue funcionando.
    refreshRemoteConfig().catch(() => {});
    // Hot-reload sin reiniciar la app: polling cada 5 min para captar cambios
    // del admin en app_config. El cleanup se hace al desmontar este layout.
    startLiveUpdates();
    WebBrowser.maybeCompleteAuthSession();

    // Reaccionar a transiciones foreground/background:
    //   - foreground → refresh inmediato + cadencia 1 min (admin tweaking)
    //   - background  → cadencia 5 min (ahorrar batería, la app corre poco)
    //   - también recarga rewarded ad como antes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        adsService.reloadRewardedAd();
        refreshRemoteConfig().catch(() => {});
        setLiveUpdateInterval(LIVE_UPDATE_INTERVALS.foregroundMs);
      } else if (nextAppState.match(/inactive|background/)) {
        setLiveUpdateInterval(LIVE_UPDATE_INTERVALS.backgroundMs);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      stopLiveUpdates();
    };
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