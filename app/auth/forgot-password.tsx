import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../services/supabase';

/**
 * ForgotPassword — Flujo de recuperación basado en OTP (sin deep links).
 *
 * Paso 1: El usuario introduce su email y pulsa "Enviar código".
 *          Supabase envía un código de 6 dígitos por email.
 * Paso 2: El usuario introduce el código, su nueva contraseña y la confirma.
 *          Verificamos el OTP → actualizamos la contraseña → cerramos sesión → login.
 *
 * Este enfoque evita los problemas de deep links en Android (fragmentos # que
 * expo-router no procesa correctamente) y garantiza un flujo 100 % fiable.
 */

/**
 * Cooldown en segundos del botón "Reenviar código".
 * Protege contra spam/abuso del endpoint de email (rate limit de Supabase
 * suele ser ~5 emails/hora por address, pero el cooldown del cliente da
 * feedback inmediato al usuario).
 */
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPassword() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTheme } = useTheme();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado y ref del cooldown de reenvío. Usamos ref para el handle del
  // setInterval para que cleanup no dependa del valor de resendCooldown en el
  // closure (evita warnings de exhaustive-deps y comportamiento indeterminista).
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function handleSendCode() {
    if (!email || !email.includes('@')) {
      Alert.alert(t('error'), t('email_requerido'));
      return;
    }

    if (!supabase) {
      Alert.alert(t('error'), 'Supabase no está configurado');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false, // No crear cuenta si el email no existe
        },
      });

      if (error) throw error;
      setStep('otp');
      // Cooldown explícito de 60s al enviar exitosamente.
      // El useEffect [step] también lo haría, pero dependiendo del estado
      // previo podría no entrar en su condición. Forzar el reset aquí
      // garantiza que cada envío (inicial o re-envío desde email) tenga
      // siempre su ventana de 60s.
      startResendCooldown();
    } catch (error: any) {
      let mensaje = error.message || t('error_reset');
      if (
        error.message?.toLowerCase().includes('rate limit') ||
        error.message?.toLowerCase().includes('email rate limit exceeded') ||
        error.status === 429
      ) {
        mensaje = 'Has solicitado demasiados emails seguidos. Espera unos minutos e inténtalo de nuevo.';
      }
      // Si el email no existe, Supabase devuelve un error. Dar un mensaje genérico
      // para no revelar qué emails existen en el sistema.
      if (error.message?.toLowerCase().includes('user not found')) {
        // No revelar si el email existe o no — avanzar igualmente por seguridad
        setStep('otp');
      } else {
        Alert.alert(t('error'), mensaje);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!otp || otp.length < 6) {
      Alert.alert(t('error'), t('codigo_invalido'));
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(t('error'), t('contraseña_min_6'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), t('contraseñas_no_coinciden'));
      return;
    }

    if (!supabase) {
      Alert.alert(t('error'), 'Supabase no está configurado');
      return;
    }

    setLoading(true);
    try {
      // 1. Verificar el OTP — esto inicia sesión temporalmente
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });

      if (verifyError) throw verifyError;

      // 2. Actualizar la contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // 3. Cerrar la sesión temporal
      await supabase.auth.signOut();

      // 4. Redirigir al login con mensaje de éxito
      Alert.alert('✅', t('contraseña_actualizada'), [
        {
          text: t('aceptar'),
          onPress: () => router.replace('/auth/login'),
        },
      ]);
    } catch (error: any) {
      let mensaje = error.message || t('error_actualizar_perfil');

      // Errores comunes de OTP
      if (error.message?.toLowerCase().includes('token') && error.message?.toLowerCase().includes('expired')) {
        mensaje = 'El código ha expirado. Solicita uno nuevo.';
      } else if (error.message?.toLowerCase().includes('token') && error.message?.toLowerCase().includes('invalid')) {
        mensaje = t('codigo_invalido');
      }

      Alert.alert(t('error'), mensaje);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Inicia el cooldown de reenvío. Limpia cualquier interval previo antes de
   * crear uno nuevo para evitar fugas. Usamos Date.now() como referencia en
   * lugar de decrementar un contador, para que el countdown sea robusto frente
   * a saltos del setInterval (background del dispositivo, throttling del SO).
   */
  function startResendCooldown() {
    if (resendIntervalRef.current) {
      clearInterval(resendIntervalRef.current);
    }
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    const startedAt = Date.now();
    resendIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = RESEND_COOLDOWN_SECONDS - elapsed;
      if (remaining <= 0) {
        if (resendIntervalRef.current) {
          clearInterval(resendIntervalRef.current);
          resendIntervalRef.current = null;
        }
        setResendCooldown(0);
      } else {
        setResendCooldown(remaining);
      }
    }, 1000);
  }

  /**
   * Reenvía el código de 6 dígitos al email del usuario. Solo disponible si
   * NO estamos en loading Y NO estamos en cooldown (guard contra doble tap).
   * signInWithOtp usa el mismo email para que Supabase invalide el código
   * antiguo y emita uno nuevo.
   */
  async function handleResendCode() {
    if (resendCooldown > 0 || loading) return;
    if (!supabase) {
      Alert.alert(t('error'), 'Supabase no está configurado');
      return;
    }
    if (!email) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      Alert.alert('✅', t('codigo_reenviado'));
      startResendCooldown();
    } catch (error: any) {
      let mensaje = error.message || t('error_reset');
      if (
        error.message?.toLowerCase().includes('rate limit') ||
        error.message?.toLowerCase().includes('email rate limit exceeded') ||
        error.status === 429
      ) {
        mensaje = 'Has solicitado demasiados emails seguidos. Espera unos minutos e inténtalo de nuevo.';
      }
      Alert.alert(t('error'), mensaje);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Limpia el interval al desmontar (evita fuga de memoria / warning de
   * "state update on unmounted component").
   */
  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
        resendIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * Cada vez que entramos en el paso OTP arrancamos el cooldown — pero solo
   * si NO está ya corriendo (así el usuario no puede "resetear" el cooldown
   * navegando email + OTP repetidamente).
   */
  useEffect(() => {
    if (step === 'otp' && resendCooldown === 0 && !resendIntervalRef.current) {
      startResendCooldown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: currentTheme.colors.primaryLight }]}>
            <Ionicons name="lock-open-outline" size={32} color={currentTheme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: currentTheme.colors.text }]}>{t('olvidaste_contraseña')}</Text>
          <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>
            {step === 'email' ? t('instrucciones_reset') : t('instrucciones_codigo')}
          </Text>
        </View>

        {step === 'email' ? (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>{t('email')}</Text>
              <View style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}>
                <Ionicons name="mail-outline" size={20} color={currentTheme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: currentTheme.colors.text }]}
                  placeholder="tu@email.com"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
              onPress={handleSendCode}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? t('cargando') : t('enviar_codigo')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>{t('codigo_6_digitos')}</Text>
              <View style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}>
                <Ionicons name="key-outline" size={20} color={currentTheme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: currentTheme.colors.text }]}
                  placeholder="123456"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>{t('nueva_contraseña')}</Text>
              <View style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={currentTheme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: currentTheme.colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>{t('confirmar_contraseña')}</Text>
              <View style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={currentTheme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: currentTheme.colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? t('cargando') : t('restablecer_contraseña')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkButton, { borderColor: currentTheme.colors.primary }]}
              onPress={() => setStep('email')}
              disabled={loading}
            >
              <Text style={[styles.linkButtonText, { color: currentTheme.colors.primary }]}>
                ← {t('enviar_codigo')}
              </Text>
            </TouchableOpacity>

            {/*
              Botón "Reenviar código" con cooldown visible.
              - cooldown > 0 → disabled, muestra "Reenviar en Xs"
              - cooldown == 0 && !loading → habilitado, muestra "Reenviar código"
              - loading → disabled a través de opacity/disabled
            */}
            <TouchableOpacity
              style={[
                styles.resendButton,
                {
                  borderColor: currentTheme.colors.primary,
                  opacity: resendCooldown > 0 || loading ? 0.5 : 1,
                },
              ]}
              onPress={handleResendCode}
              disabled={resendCooldown > 0 || loading}
              accessibilityLabel={
                resendCooldown > 0
                  ? t('reenviar_en', { seconds: resendCooldown })
                  : t('reenviar_codigo')
              }
            >
              {resendCooldown > 0 ? (
                <Text style={[styles.resendButtonText, { color: currentTheme.colors.primary }]}>
                  {t('reenviar_en', { seconds: resendCooldown })}
                </Text>
              ) : (
                <View style={styles.resendContent}>
                  <Ionicons name="refresh-outline" size={16} color={currentTheme.colors.primary} />
                  <Text style={[styles.resendButtonText, { color: currentTheme.colors.primary, marginLeft: 6 }]}>
                    {t('reenviar_codigo')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backButtonText, { color: currentTheme.colors.primary }]}>{t('volver_login')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  iconContainer: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, gap: 12 },
  input: { flex: 1, fontSize: 15 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkButton: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  linkButtonText: { fontSize: 14, fontWeight: '600' },
  backButton: { marginTop: 20, alignItems: 'center' },
  backButtonText: { fontSize: 14, fontWeight: '600' },
  resendButton: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  resendContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  resendButtonText: { fontSize: 14, fontWeight: '600' },
});
