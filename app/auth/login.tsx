import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../services/supabase';
import { adsService } from '../../services/adsService';
import { useScale } from '../../hooks/useScale';

export default function Login() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { currentTheme } = useTheme();    const { signInWithEmail, signInWithGoogle, signOut } = useAuth();
  const { s, fs } = useScale();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function verificarEstadoAntesDeLogin(userEmail: string): Promise<'ok' | 'pending_deletion' | 'permanently_deleted' | 'error'> {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(
        `${supabaseUrl}/functions/v1/check-account-status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        return 'error'; // Si falla, permitir acceso
      }

      const data = await response.json();
      return data.status === 'pending_deletion' ? 'pending_deletion'
        : (data.status === 'permanently_deleted' || data.status === 'grace_period_expired')
          ? 'permanently_deleted'
          : 'ok';
    } catch {
      return 'error'; // Error de red, permitir acceso
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(t('error'), t('campos_requeridos'));
      return;
    }

    setLoading(true);

    // 1. Verificar estado de la cuenta ANTES de iniciar sesión
    // (check-account-status es un endpoint público, no requiere auth)
    const status = await verificarEstadoAntesDeLogin(email);

    if (status === 'permanently_deleted') {
      setLoading(false);
      Alert.alert(
        t('cuenta_eliminada_permanentemente'),
        t('cuenta_eliminada_permanente_desc'),
        [{ text: t('volver') }]
      );
      return;
    }

    if (status === 'pending_deletion') {
      setLoading(false);
      // Mostrar alerta en la pantalla de login, SIN navegar a tabs
      Alert.alert(
        t('cuenta_pendiente_eliminacion'),
        t('restaurar_cuenta_pregunta'),
        [
          {
            text: t('salir_sin_restaurar'),
            style: 'cancel',
          },
          {
            text: t('restaurar_cuenta'),
            onPress: async () => {
              // Iniciar sesión y restaurar
              setLoading(true);
              const loginResult = await signInWithEmail(email, password);
              if (loginResult.success) {
                await restaurarCuenta();
              } else {
                setLoading(false);
                Alert.alert(t('error'), loginResult.error || t('error_login'));
              }
            }
          },
        ]
      );
      return;
    }

    // 2. Estado 'ok' o 'error' — proceder con el login normalmente
    const result = await signInWithEmail(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert(t('error'), result.error || t('error_login'));
      return;
    }

    // 3. Navegar a tabs
    router.replace('/(tabs)');
  }

  async function restaurarCuenta() {
    try {
      if (!supabase) { setLoading(false); return; }

      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) { setLoading(false); return; }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(
        `${supabaseUrl}/functions/v1/restore-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (response.ok) {
        Alert.alert(t('cuenta_restaurada'), t('cuenta_restaurada_desc'));
        router.replace('/(tabs)');
        // Forzar recarga de anuncios después de restaurar
        try {
          adsService.loadInterstitial();
          adsService.loadRewardedAd();
        } catch {}
      } else {
        setLoading(false);
        Alert.alert(t('error'), t('error_eliminar_cuenta'));
      }
    } catch {
      setLoading(false);
      Alert.alert(t('error'), t('error_eliminar_cuenta'));
    }
  }

  // El enlace "Olvidaste contraseña" ahora navega a la pantalla dedicada
  // con flujo OTP (sin deep links). Ver app/auth/forgot-password.tsx

  async function handleGoogleLogin() {
    setLoading(true);

    // Con Google login, primero obtenemos el email (si es posible)
    // pero como no podemos verificar antes, hacemos el login y verificamos después
    const result = await signInWithGoogle();

    if (result.success) {
      // Verificar estado de cuenta después de login con Google
      try {
        if (supabase) {
          const userResult = await supabase.auth.getUser();
          const userEmail = userResult.data.user?.email;
          if (userEmail) {
            const status = await verificarEstadoAntesDeLogin(userEmail);
            
            if (status === 'permanently_deleted') {
              await signOut();
              setLoading(false);
              Alert.alert(
                t('cuenta_eliminada_permanentemente'),
                t('cuenta_eliminada_permanente_desc'),
                [{ text: t('volver') }]
              );
              return;
            }

            if (status === 'pending_deletion') {
              await signOut(); // Cerrar sesión temporalmente
              setLoading(false);
              Alert.alert(
                t('cuenta_pendiente_eliminacion'),
                t('restaurar_cuenta_pregunta'),
                [
                  {
                    text: t('salir_sin_restaurar'),
                    style: 'cancel',
                  },
                  {
                    text: t('restaurar_cuenta'),
                    onPress: async () => {
                      setLoading(true);
                      const loginResult = await signInWithGoogle();
                      setLoading(false);
                      if (loginResult.success) {
                        await restaurarCuenta();
                      }
                    }
                  }
                ]
              );
              return;
            }
          }
        }
      } catch {}
      setLoading(false);
      router.replace('/(tabs)');
    } else {
      setLoading(false);
      Alert.alert(t('error'), result.error || t('error_google_login'));
    }
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: currentTheme.colors.primary }]}>InvoiceRapid</Text>
          <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>{t('bienvenido')}</Text>
        </View>

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

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: currentTheme.colors.text }]}>{t('contraseña')}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color={currentTheme.colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: currentTheme.colors.text }]}
                placeholder="••••••••"
                placeholderTextColor={currentTheme.colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
            <TouchableOpacity onPress={() => router.push('/auth/forgot-password')} style={styles.forgotPassword}>
              <Text style={[styles.forgotPasswordText, { color: currentTheme.colors.primary }]}>{t('olvidaste_contraseña')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? t('cargando') : t('iniciar_sesion')}</Text>
          </TouchableOpacity>

          <>
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: currentTheme.colors.border }]} />
              <Text style={[styles.dividerText, { color: currentTheme.colors.textSecondary }]}>{t('o')}</Text>
              <View style={[styles.dividerLine, { backgroundColor: currentTheme.colors.border }]} />
            </View>

            <TouchableOpacity 
              style={[styles.googleButton, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={[styles.googleButtonText, { color: currentTheme.colors.text }]}>{t('continuar_google')}</Text>
            </TouchableOpacity>
          </>

          <TouchableOpacity 
            style={[styles.registerButton, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.primary }]}
            onPress={() => router.push('/auth/register')}
          >
            <Ionicons name="person-add-outline" size={s(20)} color={currentTheme.colors.primary} />
            <Text style={[styles.registerButtonText, { color: currentTheme.colors.primary }]}>{t('registrarse')}</Text>
          </TouchableOpacity>

          {/* Toggle de idioma ES/EN */}
          <View style={styles.langToggle}>
            <TouchableOpacity
              style={[styles.langBtn, i18n.language === 'es' && { backgroundColor: currentTheme.colors.primary }]}
              onPress={() => i18n.changeLanguage('es')}
            >
              <Text style={[styles.langBtnText, i18n.language === 'es' && { color: '#fff', fontWeight: '700' }]}>ES</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, i18n.language === 'en' && { backgroundColor: currentTheme.colors.primary }]}
              onPress={() => i18n.changeLanguage('en')}
            >
              <Text style={[styles.langBtnText, i18n.language === 'en' && { color: '#fff', fontWeight: '700' }]}>EN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '500' },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, gap: 12 },
  input: { flex: 1, fontSize: 15 },
  forgotPassword: { alignSelf: 'flex-end' },
  forgotPasswordText: { fontSize: 14, fontWeight: '600' },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 14, fontWeight: '500' },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, gap: 12 },
  googleButtonText: { fontSize: 16, fontWeight: '600' },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
  },
  registerButtonText: { fontSize: 16, fontWeight: '700' },
  langToggle: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  langBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#e0e0e0' },
  langBtnText: { fontSize: 13, fontWeight: '600', color: '#888' },
});
