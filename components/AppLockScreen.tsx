import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { AppLockState, SecurityStatus } from '../hooks/useSecurity';

type AppLockScreenProps = {
  securityStatus: SecurityStatus;
  lockState: AppLockState;
  onAuthenticate: () => Promise<void>;
};

/**
 * Pantalla de bloqueo biométrico que se muestra cuando la app
 * vuelve de segundo plano y el App Lock está activado.
 * 
 * Usa expo-local-authentication para huella / Face ID / iris,
 * con fallback al PIN del dispositivo.
 * 
 * Recibe securityStatus, lockState y onAuthenticate del hook
 * useSecurity() de su padre para compartir la misma instancia.
 */
export function AppLockScreen({ securityStatus, lockState, onAuthenticate }: AppLockScreenProps) {
  const handleAuthenticate = useCallback(async () => {
    await onAuthenticate();
  }, [onAuthenticate]);

  // Desbloquear automáticamente al montar
  useEffect(() => {
    handleAuthenticate();
  }, []);

  const biometricIcon = securityStatus.biometricType === 'face' ? 'scan-outline' : 'finger-print-outline';
  const biometricLabel = securityStatus.biometricType === 'face' ? 'Face ID / Reconocimiento facial' : 'Huella digital';

  return (
    <View style={styles.container}>
      {/* Logo / icono */}
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={48} color="#007AFF" />
        </View>
      </View>

      {/* Título */}
      <Text style={styles.title}>InvoiceRapid</Text>
      <Text style={styles.subtitle}>Protegido con {biometricLabel}</Text>

      {/* Botón de desbloqueo */}
      <TouchableOpacity
        style={styles.unlockButton}
        onPress={handleAuthenticate}
        disabled={lockState.isAuthenticating}
        activeOpacity={0.8}
      >
        <Ionicons
          name={lockState.isAuthenticating ? 'lock-closed-outline' : biometricIcon}
          size={28}
          color="#fff"
        />
        <Text style={styles.unlockText}>
          {lockState.isAuthenticating ? 'Verificando...' : 'Desbloquear'}
        </Text>
      </TouchableOpacity>

      {/* Error */}
      {lockState.authError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={16} color="#FF4757" />
          <Text style={styles.errorText}>{lockState.authError}</Text>
          <TouchableOpacity onPress={handleAuthenticate}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Footer */}
      <Text style={styles.footer}>
        Tus datos están protegidos con cifrado del dispositivo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 9999,
    elevation: 9999,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EBF3FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF20',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    marginBottom: 40,
    textAlign: 'center',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    minWidth: 200,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  unlockText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  errorText: {
    color: '#FF4757',
    fontSize: 13,
    flex: 1,
  },
  retryText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    fontSize: 11,
    color: '#a0aec0',
    textAlign: 'center',
  },
});
