import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useModernAlert } from '../../components/ModernAlert';
import { supabase } from '../../services/supabase';

/**
 * ForgotPassword — Recuperación de contraseña por OTP vía email.
 *
 * Paso 1 ('email'):  El usuario introduce su email y pulsa "Enviar código".
 *                    Llamamos a `supabase.auth.signInWithOtp({ email,
 *                    options: { shouldCreateUser: false } })`. Supabase envía
 *                    un código de 6 dígitos al email (si existe).
 * Paso 2 ('otp'):    El usuario introduce el código de 6 dígitos recibido y
 *                    pulsa "Verificar código". Llamamos a
 *                    `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
 *                    Esto establece una sesión temporal del usuario.
 * Paso 3 ('reset'):  Mostramos el email verificado y los campos de nueva
 *                    contraseña + confirmación. Validamos (≥ 6 caracteres y
 *                    coincidencia). Llamamos a
 *                    `supabase.auth.updateUser({ password })`, que actualiza
 *                    la contraseña del usuario actualmente firmado.
 *                    Luego `signOut()` y redirect a /auth/login para que el
 *                    usuario entre con email + NUEVA contraseña manualmente.
 *
 * Por qué OTP por email (no Google OAuth):
 *   - El flujo Google OAuth necesitaba deep links `invoicerapid://` que
 *     Android no procesa correctamente cuando el email de recovery llega
 *     con fragmento `#…`.
 *   - `signInWithOtp` + `verifyOtp` (tipo 'email') es 100 % viable en RN
 *     bare sin necesidad de deep links: el usuario introduce el código a
 *     mano en un campo de texto.
 *
 * Importante:
 *   - RootNavigator excluye `auth/forgot-password` del redirect a /(tabs)
 *     tras `verifyOtp`, porque `verifyOtp` deja una sesión temporal activa
 *     que de otra forma enviaría al usuario a los tabs antes de poder
 *     cambiar la contraseña.
 *   - `signOut` se llama SINCRÓNICAMENTE tras `updateUser` para garantizar
 *     que la próxima vez que el usuario entre lo haga por email+password
 *     y no por la sesión OTP temporal.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const modernAlert = useModernAlert();

  type Step = 'email' | 'otp' | 'reset';
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Paso 1 → 2: enviar código de 6 dígitos al email.
   * Con `shouldCreateUser: false`, Supabase no crea un usuario nuevo si
   * el email no existe. Si por algún motivo aún así devuelve error de
   * "user not found", mostramos un mensaje genérico sin revelar si el
   * email existe (no enumeración de cuentas).
   */
  async function handleSendCode() {
    if (!supabase) {
      modernAlert.showError(t('error'), 'Supabase no está configurado')
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      modernAlert.showError(t('error'), t('email_requerido'))
      return;
    }
    // Validar formato de email antes de enviar a Supabase
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      modernAlert.showError(t('error'), t('email_invalido'))
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        // Rate-limit específico (Supabase cap de emails)
        if (
          error.message?.toLowerCase().includes('rate limit') ||
          error.status === 429
        ) {
          modernAlert.showError(
            t('error'),
            t('excede_intentos_codigo')
          );
          return;
        }
        // Mensaje genérico con icono azul neutro: no revelar si el email existe o no.
        // Usamos showAlert con icono info porque el error puede deberse
        // a un fallo de SMTP, no necesariamente a que el email no exista.
        modernAlert.showAlert({
          title: '',
          message: t('email_no_registrado'),
          icon: 'information-circle-outline',
          iconColor: '#3498db',
        });
        return;
      }

      setStep('otp');
    } catch (error: any) {
      const msg = error?.message?.toLowerCase().includes('rate limit')
        ? t('excede_intentos_codigo')
        : (error?.message || t('email_no_registrado'));
      // Si es rate limit → error rojo. Si no, mensaje neutro con icono azul.
      if (error?.message?.toLowerCase().includes('rate limit')) {
        modernAlert.showError(t('error'), msg);
      } else {
        modernAlert.showAlert({
          title: '',
          message: t('email_no_registrado'),
          icon: 'information-circle-outline',
          iconColor: '#3498db',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  /**
   * Paso 2 → 3: verificar el código de 6 dígitos. Esto establece una sesión
   * temporal (signInWithOtp + verifyOtp). El usuario ya está "logueado"
   * para Supabase, aunque no hayamos navegado a /(tabs) gracias al guard
   * de RootNavigator que excluye esta pantalla.
   */
  async function handleVerifyCode() {
    if (!supabase) {
      modernAlert.showError(t('error'), 'Supabase no está configurado')
      return;
    }
    const trimmedEmail = email.trim();
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length < 6) {
      modernAlert.showError(t('error'), t('codigo_incompleto'))
      return;
    }
    if (!/^\d{6}$/.test(trimmedOtp)) {
      modernAlert.showError(t('error'), t('codigo_incompleto'))
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedOtp,
        type: 'email',
      });

      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('expired')) {
          modernAlert.showError(t('error'), t('codigo_expirado'))
        } else if (msg.includes('invalid') || msg.includes('token')) {
          modernAlert.showError(t('error'), t('codigo_invalido'))
        } else {
          modernAlert.showError(t('error'), t('codigo_invalido'))
        }
        return;
      }

      setStep('reset');
    } catch (error: any) {
      modernAlert.showError(t('error'), error?.message || t('codigo_invalido'))
    } finally {
      setLoading(false);
    }
  }

  /**
   * Paso 3 final: actualizar la contraseña del usuario firmado
   * (la sesión que dejó `verifyOtp`). Luego cerrar sesión y volver a
   * login para que el usuario entre con email + NUEVA contraseña.
   */
  async function handleSavePassword() {
    if (!supabase) {
      modernAlert.showError(t('error'), 'Supabase no está configurado')
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      modernAlert.showError(t('error'), t('contraseña_min_6'))
      return;
    }
    if (newPassword !== confirmPassword) {
      modernAlert.showError(t('error'), t('contraseñas_no_coinciden'))
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      // Cerrar la sesión temporal OTP: el objetivo es que el usuario entre
      // por email+password normal con su nueva contraseña, no que quede
      // logueado por la sesión OTP.
      await supabase.auth.signOut();

      modernAlert.showAlert({
        title: '',
        message: t('contraseña_actualizada'),
        icon: 'checkmark-circle',
        iconColor: '#26de81',
        buttons: [
          {
            text: t('aceptar'),
            onPress: () => router.replace('/auth/login'),
          },
        ]
      });
    } catch (error: any) {
      modernAlert.showError(t('error'), error?.message || t('error_actualizar_perfil'))
    } finally {
      setLoading(false);
    }
  }

  /** Volver al paso anterior reiniciando solo los campos de ese paso. */
  function handleBack() {
    if (step === 'otp') {
      setOtp('');
      setStep('email');
    } else if (step === 'reset') {
      // En reset el usuario está firmado vía OTP. Si quiere cambiar de email
      // o cancelar, hacemos signOut para no dejar la sesión colgada y
      // volvemos al paso 'email' para que pueda empezar de cero.
      if (supabase) {
        supabase.auth.signOut().catch(() => {});
      }
      setNewPassword('');
      setConfirmPassword('');
      setStep('email');
    } else {
      router.back();
    }
  }

  /** Reenviar código: vuelve al flujo de envío OTP (mismo email). */
  async function handleResendCode() {
    setOtp('');
    await handleSendCode();
  }

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: currentTheme.colors.primaryLight }]}>
            <Ionicons
              name={step === 'reset' ? 'lock-open-outline' : 'mail-unread-outline'}
              size={32}
              color={currentTheme.colors.primary}
            />
          </View>
          <Text style={[styles.title, { color: currentTheme.colors.text }]}>
            {t('olvidaste_contraseña')}
          </Text>
          <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>
            {step === 'email' && t('instrucciones_email_paso')}
            {step === 'otp' && t('instrucciones_codigo_paso')}
            {step === 'reset' && t('instrucciones_password_paso')}
          </Text>

          {/* Indicador de paso discreto (3 puntitos) */}
          <View style={styles.stepDots}>
            <View style={[styles.dot, step === 'email' && { backgroundColor: currentTheme.colors.primary }]} />
            <View style={[styles.dot, step === 'otp' && { backgroundColor: currentTheme.colors.primary }]} />
            <View style={[styles.dot, step === 'reset' && { backgroundColor: currentTheme.colors.primary }]} />
          </View>
        </View>

        {step === 'email' && (
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
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: currentTheme.colors.primary, opacity: loading ? 0.6 : 1 }]}
              onPress={handleSendCode}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? t('cargando') : t('enviar_codigo_btn')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'otp' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>{t('codigo_6_digitos_label')}</Text>
              <View style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}>
                <Ionicons name="key-outline" size={20} color={currentTheme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: currentTheme.colors.text, letterSpacing: 4 }]}
                  placeholder="123456"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: currentTheme.colors.primary, opacity: loading ? 0.6 : 1 }]}
              onPress={handleVerifyCode}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? t('cargando') : t('verificar_codigo_btn')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleResendCode}
              disabled={loading}
            >
              <Ionicons name="refresh-outline" size={16} color={currentTheme.colors.primary} />
              <Text style={[styles.linkButtonText, { color: currentTheme.colors.primary }]}>
                {t('reenviar_codigo')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'reset' && (
          <View style={styles.form}>
            {/* Carta informativa: el email que se va a actualizar */}
            <View
              style={[
                styles.emailBanner,
                {
                  backgroundColor: currentTheme.colors.primaryLight,
                  borderColor: currentTheme.colors.primary,
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={20} color={currentTheme.colors.primary} />
              <Text style={[styles.emailBannerText, { color: currentTheme.colors.text }]}>
                {email.trim()}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>{t('nueva_contraseña')}</Text>
              <View style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={currentTheme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: currentTheme.colors.text }]}
                  placeholder="••••••"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>{t('confirmar_contraseña')}</Text>
              <View style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={currentTheme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: currentTheme.colors.text }]}
                  placeholder="••••••"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: currentTheme.colors.primary, opacity: loading ? 0.6 : 1 }]}
              onPress={handleSavePassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? t('cargando') : t('guardar_contraseña_btn')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Botón "Atrás" en cada paso intermedio, y "Volver al login" en el primero */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={loading}>
            <Ionicons name="arrow-back" size={16} color={currentTheme.colors.primary} />
            <Text style={[styles.backButtonText, { color: currentTheme.colors.primary }]}>
              {step === 'email' ? t('volver_login') : t('volver')}
            </Text>
          </TouchableOpacity>

          {/* Aviso de carpeta spam — solo en pasos email y otp (no en reset) */}
          {(step === 'email' || step === 'otp') && (
          <View style={styles.spamHint}>
            <Ionicons name="warning-outline" size={14} color={currentTheme.colors.textSecondary} />
            <Text style={[styles.spamHintText, { color: currentTheme.colors.textSecondary }]}>
              {t('revisar_spam')}
            </Text>
          </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  iconContainer: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 340, marginBottom: 16 },
  // 3 puntitos que indican en qué paso del flujo estamos
  stepDots: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e0e0e0' },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, gap: 12 },
  input: { flex: 1, fontSize: 15 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkButton: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  linkButtonText: { fontSize: 14, fontWeight: '600' },
  // Banner que muestra el email verificado antes de pedir nueva contraseña
  emailBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  emailBannerText: { flex: 1, fontSize: 14, fontWeight: '600' },
  footer: { marginTop: 16, alignItems: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  backButtonText: { fontSize: 14, fontWeight: '600' },
  spamHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 8 },
  spamHintText: { fontSize: 12, textAlign: 'center', flexShrink: 1, lineHeight: 16 },
});
