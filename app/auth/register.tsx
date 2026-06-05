import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getDeviceId } from '../../utils/deviceId';

export default function Register() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { signUpWithEmail } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function verificarEmailDisponible(userEmail: string): Promise<boolean> {
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
        // Si no podemos verificar, permitir registro
        return true;
      }

      const data = await response.json();

      if (data.status === 'permanently_deleted') {
        Alert.alert(t('email_no_disponible'), t('email_eliminado_permanente'));
        return false;
      }

      if (data.status === 'pending_deletion') {
        Alert.alert(t('email_no_disponible'), t('email_pendiente_eliminacion'));
        return false;
      }

      if (data.status === 'grace_period_expired') {
        Alert.alert(t('email_no_disponible'), t('periodo_restauracion_expirado'));
        return false;
      }

      return true;
    } catch {
      // Error de red — permitir registro
      return true;
    }
  }

  async function handleRegister() {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert(t('error'), t('campos_requeridos'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('error'), t('contraseñas_no_coinciden'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('error'), t('contraseña_minima'));
      return;
    }

    // Verificar que el email no esté bloqueado
    setLoading(true);
    const emailDisponible = await verificarEmailDisponible(email);
    if (!emailDisponible) {
      setLoading(false);
      return;
    }

    const result = await signUpWithEmail(email, password, name);
    setLoading(false);

    if (result.success) {
      // Guardar device_id en el perfil para protección anti-abuso
      try {
        const deviceId = await getDeviceId();
        const supabaseModule = await import('../../services/supabase');
        if (supabaseModule.supabase && result.userId) {
          const { data: { session } } = await supabaseModule.supabase.auth.getSession();
          if (session?.user?.id) {
            await supabaseModule.supabase
              .from('profiles')
              .update({ device_id: deviceId })
              .eq('id', session.user.id);
          }
        }
      } catch {
        // Silencioso: no bloquear el registro si falla el device_id
      }

      // Guardar userId para que la pantalla de referidos pueda leer el código sin sesión confirmada
      if (result.userId) {
        await AsyncStorage.setItem('pending_user_id', result.userId);
      }

      Alert.alert(t('registro_exitoso'), t('verifica_email'));
      router.replace('/onboarding/referral-code' as any);
    } else {
      Alert.alert(t('error'), result.error || t('error_registro'));
    }
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: currentTheme.colors.primary }]}>InvoiceRapid</Text>
          <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>{t('crear_cuenta')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: currentTheme.colors.text }]}>{t('nombre')}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}>
              <Ionicons name="person-outline" size={20} color={currentTheme.colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: currentTheme.colors.text }]}
                placeholder={t('nombre_placeholder')}
                placeholderTextColor={currentTheme.colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>

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
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? t('cargando') : t('registrarse')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.loginLink, { color: currentTheme.colors.primary, textAlign: 'center', marginTop: 16 }]}>{t('iniciar_sesion')}</Text>
          </TouchableOpacity>
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
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink: { fontSize: 14, fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
