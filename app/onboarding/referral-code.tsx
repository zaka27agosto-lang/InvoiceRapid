import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useRemoteConfig } from '../../hooks/useRemoteConfig';
import { supabase } from '../../services/supabase';

export default function ReferralCode() {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { referral_required_count } = useRemoteConfig();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<'idle' | 'valid' | 'invalid' | 'self'>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<Date | null>(null);
  const [blockCountdown, setBlockCountdown] = useState('');
  const [permanentlyLocked, setPermanentlyLocked] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [expirado, setExpirado] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState('');

  // Al cargar, establecer deadline si no existe + cleanup debounce
  useEffect(() => {
    iniciarDeadline();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Countdown del bloqueo por fuerza bruta
  useEffect(() => {
    if (!blockedUntil) return;
    const interval = setInterval(() => {
      const ms = blockedUntil.getTime() - Date.now();
      if (ms <= 0) {
        setBlockedUntil(null);
        setBlockCountdown('');
        clearInterval(interval);
      } else {
        setBlockCountdown(`${Math.ceil(ms / 1000)}s`);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [blockedUntil]);

  async function iniciarDeadline() {
    try {
      // Verificar bloqueo permanente por fuerza bruta
      const locked = await AsyncStorage.getItem('brute_force_locked');
      if (locked === 'true') {
        setPermanentlyLocked(true);
      }

      const deadline = await AsyncStorage.getItem('referral_code_deadline');
      if (!deadline) {
        // Primera vez: establecer deadline = ahora + 12h
        const doceHoras = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
        await AsyncStorage.setItem('referral_code_deadline', doceHoras);
      } else {
        // Verificar si ya expiró
        if (Date.now() > new Date(deadline).getTime()) {
          setExpirado(true);
        } else {
          // Calcular tiempo restante para mostrar
          const msRest = new Date(deadline).getTime() - Date.now();
          const horas = Math.floor(msRest / (1000 * 60 * 60));
          const min = Math.floor((msRest % (1000 * 60 * 60)) / (1000 * 60));
          setTiempoRestante(`${horas}h ${min}min`);
        }
      }
    } catch {
      // Silencioso
    }
  }

  // Auto uppercase and max 6 chars
  const handleCodeChange = (text: string) => {
    const upper = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(upper);

    // Clear previous validation
    setValidationResult('idle');
    setValidationMessage('');

    // Debounce validation
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (upper.length === 6) {
      debounceRef.current = setTimeout(() => validateCode(upper), 400);
    }
  };

  const applyBruteForce = async (newCount: number) => {
    setFailedAttempts(newCount);
    if (newCount >= 3) {
      const segundos = newCount === 3 ? 3 : newCount === 4 ? 6 : 12;
      setBlockedUntil(new Date(Date.now() + segundos * 1000));
      setBlockCountdown(`${segundos}s`);
    }
    // Bloqueo permanente al llegar a 5 intentos fallidos
    if (newCount >= 5) {
      await AsyncStorage.setItem('brute_force_locked', 'true');
      setPermanentlyLocked(true);
      setBlockedUntil(null);
      setBlockCountdown('');
    }
  };

  const validateCode = async (codeToValidate: string) => {
    if (!supabase) {
      setValidationResult('invalid');
      setValidationMessage(t('codigo_invalido'));
      await applyBruteForce(failedAttempts + 1);
      return;
    }

    setValidating(true);
    try {
      // Usar RPC segura verify_referral_code (no expone datos de la tabla)
      // Funciona tanto para usuarios autenticados como anónimos (SECURITY DEFINER)
      const { data, error } = await supabase
        .rpc('verify_referral_code', { code_to_check: codeToValidate });

      if (error || !data) {
        setValidationResult('invalid');
        setValidationMessage(t('codigo_invalido'));
        await applyBruteForce(failedAttempts + 1);
        return;
      }

      const result = data as { valid: boolean; is_self: boolean };

      if (!result.valid) {
        setValidationResult('invalid');
        setValidationMessage(t('codigo_invalido'));
        await applyBruteForce(failedAttempts + 1);
        return;
      }

      // Check if it's the user's own code
      if (result.is_self) {
        setValidationResult('self');
        setValidationMessage(t('codigo_propio'));
        return;
      }

      setValidationResult('valid');
      setValidationMessage(t('codigo_valido'));
      setFailedAttempts(0);
    } catch {
      setValidationResult('invalid');
      setValidationMessage(t('codigo_invalido'));
      await applyBruteForce(failedAttempts + 1);
    } finally {
      setValidating(false);
    }
  };

  const handleApplyCode = async () => {
    if (validationResult !== 'valid') return;

    setSaving(true);
    try {
      await AsyncStorage.setItem('pending_referral_code', code);
      router.replace('/(tabs)');
    } catch {
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  if (expirado) {
    return (
      <KeyboardAvoidingView
        style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <View style={[styles.iconContainer, { backgroundColor: currentTheme.colors.primary + '15' }]}>
            <Ionicons name="time-outline" size={48} color={currentTheme.colors.textSecondary} />
          </View>
          <Text style={[styles.title, { color: currentTheme.colors.text }]}>
            Tiempo agotado
          </Text>
          <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>
            El plazo de 12 horas para introducir un código de invitado ha expirado.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.primaryButtonText}>Ir al inicio</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const getBorderColor = () => {
    if (validationResult === 'valid') return '#26de81';
    if (validationResult === 'invalid' || validationResult === 'self') return '#FF4757';
    return currentTheme.colors.border || '#e0e0e0';
  };

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: currentTheme.colors.primary + '15' }]}>
          <Ionicons name="gift-outline" size={48} color={currentTheme.colors.primary} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>
          {t('introducir_codigo')}
        </Text>
        <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>
          {t('invitar_amigos_sub', { n: referral_required_count })}
        </Text>

        {/* Tiempo restante */}
        {tiempoRestante ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Ionicons name="time-outline" size={14} color={currentTheme.colors.textSecondary} />
            <Text style={{ fontSize: 12, color: currentTheme.colors.textSecondary }}>
              Te quedan {tiempoRestante}
            </Text>
          </View>
        ) : null}

        {/* Code input */}
        <View style={[styles.inputWrapper, { borderColor: getBorderColor(), backgroundColor: currentTheme.colors.card }]}>
          <TextInput
            style={[styles.input, { color: currentTheme.colors.text }]}
            placeholder={t('introducir_codigo_placeholder')}
            placeholderTextColor={currentTheme.colors.textSecondary}
            value={code}
            onChangeText={handleCodeChange}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            textAlign="center"
            editable={!blockedUntil && !permanentlyLocked}
          />
          {validating && (
            <ActivityIndicator
              size="small"
              color={currentTheme.colors.primary}
              style={styles.loader}
            />
          )}
          {validationResult === 'valid' && !validating && (
            <Ionicons name="checkmark-circle" size={20} color="#26de81" style={styles.icon} />
          )}
          {(validationResult === 'invalid' || validationResult === 'self') && !validating && (
            <Ionicons name="close-circle" size={20} color="#FF4757" style={styles.icon} />
          )}
        </View>

        {/* Bloqueo permanente por fuerza bruta */}
        {permanentlyLocked && (
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="lock-closed" size={20} color="#FF4757" />
              <Text style={[styles.validationText, { color: '#FF4757', marginBottom: 0 }]}>
                {t('limite_intentos_superado')}
              </Text>
            </View>
          </View>
        )}

        {/* Bloqueo por fuerza bruta */}
        {!permanentlyLocked && blockedUntil && (
          <Text style={[styles.validationText, { color: '#FF4757' }]}>
            {t('demasiados_intentos', { seconds: blockCountdown })}
          </Text>
        )}

        {/* Validation message */}
        {!blockedUntil && !permanentlyLocked && validationMessage ? (
          <Text
            style={[
              styles.validationText,
              {
                color:
                  validationResult === 'valid'
                    ? '#26de81'
                    : '#FF4757',
              },
            ]}
          >
            {validationMessage}
          </Text>
        ) : null}

        {/* Apply button */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor:
                validationResult === 'valid'
                  ? currentTheme.colors.primary
                  : currentTheme.colors.border || '#e0e0e0',
              opacity: validationResult === 'valid' ? 1 : 0.6,
            },
          ]}
          onPress={handleApplyCode}
          disabled={validationResult !== 'valid' || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>{t('aplicar_codigo')}</Text>
          )}
        </TouchableOpacity>

        {/* Skip button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={[styles.skipButtonText, { color: currentTheme.colors.textSecondary }]}>
            {t('continuar_sin_codigo')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 280,
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    paddingVertical: 16,
  },
  loader: { marginLeft: 8 },
  icon: { marginLeft: 8 },
  validationText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
