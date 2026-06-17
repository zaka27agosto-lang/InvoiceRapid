import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

export type SecurityStatus = {
  isRooted: boolean;
  isEmulator: boolean;
  hasBiometrics: boolean;
  biometricType: 'fingerprint' | 'face' | 'iris' | 'none';
  lockEnabled: boolean;
};

export type AppLockState = {
  isLocked: boolean;
  isAuthenticating: boolean;
  authError: string | null;
};

/**
 * Detecta si el dispositivo tiene indicios de root/jailbreak.
 * 
 * En Expo managed workflow no podemos leer /system/build.prop ni
 * ejecutar `su`, pero podemos usar heurísticas basadas en:
 *   - expo-device (isDevice vs emulator)
 *   - expo-constants (executionEnvironment)
 */
function detectRootOrJailbreak(): { isRooted: boolean; isEmulator: boolean } {
  const isEmulator = !Device.isDevice;
  
  // Los emuladores no son root per se, pero son menos seguros
  if (isEmulator) {
    return { isRooted: false, isEmulator: true };
  }

  // En un dispositivo real con Expo managed, no podemos hacer
  // root detection profunda. Asumimos que no está rooteado.
  // En el futuro se puede mejorar con expo-device + __DEV__ checks
  // o integrando un módulo nativo tipo jail-monkey.
  return { isRooted: false, isEmulator: false };
}

/**
 * Hook de seguridad que:
 * 1. Detecta root/jailbreak
 * 2. Verifica disponibilidad de biometría
 * 3. Gestiona el App Lock (biométrico + PIN del sistema)
 * 
 * Para integrar: llamar useSecurity() en _layout.tsx y usar
 * <AppLockScreen> cuando isLocked === true.
 */
export function useSecurity() {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    isRooted: false,
    isEmulator: false,
    hasBiometrics: false,
    biometricType: 'none',
    lockEnabled: false,
  });

  const [lockState, setLockState] = useState<AppLockState>({
    isLocked: false,
    isAuthenticating: false,
    authError: null,
  });

  // Inicializar: detectar root, biometría, y preferencia de lock
  useEffect(() => {
    initSecurity();
  }, []);

  // Bloquear cuando la app va a segundo plano (si lock está activado)
  useEffect(() => {
    if (!securityStatus.lockEnabled) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setLockState(prev => ({ ...prev, isLocked: true, authError: null }));
      }
    });

    return () => subscription.remove();
  }, [securityStatus.lockEnabled]);

  async function initSecurity() {
    try {
      // 1. Detectar root/jailbreak
      const { isRooted, isEmulator } = detectRootOrJailbreak();

      // 2. Verificar biometría
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const hasBiometrics = hasHardware && isEnrolled;

      let biometricType: SecurityStatus['biometricType'] = 'none';
      if (hasBiometrics) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          biometricType = 'face';
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          biometricType = 'fingerprint';
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          biometricType = 'iris';
        }
      }

      // 3. Preferencia de App Lock
      const lockPref = await AsyncStorage.getItem('app_lock_enabled');
      const lockEnabled = lockPref === 'true';

      // 4. Si lock está activado, bloquear inmediatamente
      const shouldLock = lockEnabled && hasBiometrics;

      setSecurityStatus({
        isRooted,
        isEmulator,
        hasBiometrics,
        biometricType,
        lockEnabled: shouldLock,
      });

      if (shouldLock) {
        setLockState(prev => ({ ...prev, isLocked: true }));
      }
    } catch {
      // Fallback seguro: asumir no root, sin biometría
      setSecurityStatus(prev => ({ ...prev }));
    }
  }

  const authenticate = useCallback(async () => {
    setLockState(prev => ({ ...prev, isAuthenticating: true, authError: null }));

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquear InvoiceRapid',
        fallbackLabel: 'Usar PIN del dispositivo',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setLockState({ isLocked: false, isAuthenticating: false, authError: null });
      } else if (result.error === 'user_cancel' || result.error === 'user_fallback') {
        // El usuario canceló o usó fallback (PIN) — reintentar
        setLockState(prev => ({ ...prev, isAuthenticating: false, authError: null }));
      } else {
        setLockState(prev => ({
          ...prev,
          isAuthenticating: false,
          authError: result.error || 'Error de autenticación',
        }));
      }
    } catch {
      setLockState(prev => ({
        ...prev,
        isAuthenticating: false,
        authError: 'Error al verificar identidad',
      }));
    }
  }, []);

  const enableAppLock = useCallback(async () => {
    if (!securityStatus.hasBiometrics && !securityStatus.isEmulator) {
      return { success: false, error: 'Biometría no disponible' };
    }
    await AsyncStorage.setItem('app_lock_enabled', 'true');
    setSecurityStatus(prev => ({ ...prev, lockEnabled: prev.hasBiometrics || prev.isEmulator }));
    return { success: true };
  }, [securityStatus.hasBiometrics, securityStatus.isEmulator]);

  const disableAppLock = useCallback(async () => {
    await AsyncStorage.setItem('app_lock_enabled', 'false');
    setSecurityStatus(prev => ({ ...prev, lockEnabled: false }));
    setLockState({ isLocked: false, isAuthenticating: false, authError: null });
  }, []);

  return {
    securityStatus,
    lockState,
    authenticate,
    enableAppLock,
    disableAppLock,
  };
}
