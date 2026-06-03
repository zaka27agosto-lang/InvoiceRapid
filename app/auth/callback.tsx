import { useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../services/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();
  const { currentTheme } = useTheme();

  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'reset_form'>('processing');
  const [message, setMessage] = useState(t('cargando'));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const processedRef = useRef(false);

  useEffect(() => {
    // Evitar doble ejecución si los params llegan en dos oleadas
    if (processedRef.current || !params.token_hash || !params.type) return;
    processedRef.current = true;
    handleCallback();
  }, [params.token_hash, params.type]);

  async function handleCallback() {
    if (!supabase) {
      setStatus('error');
      setMessage(t('error'));
      return;
    }

    const { token_hash, type } = params;

    if (!token_hash || !type) {
      setStatus('error');
      setMessage(t('enlace_invalido'));
      return;
    }

    try {
      if (type === 'email') {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'email' });
        if (error) throw error;
        setStatus('success');
        setMessage(t('email_verificado'));
        setTimeout(() => router.replace('/(tabs)'), 1800);
      } else if (type === 'recovery') {
        // Verificar el token de recuperación primero
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' });
        if (error) throw error;
        // Mostrar formulario para nueva contraseña
        setStatus('reset_form');
        setMessage(t('elige_nueva_contraseña'));
      } else {
        setStatus('error');
        setMessage(t('enlace_no_soportado'));
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || t('error'));
    }
  }

  async function handleSetNewPassword() {
    if (!supabase) return;
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(t('error'), t('contraseña_min_6'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), t('contraseñas_no_coinciden'));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setStatus('success');
      setMessage(t('contraseña_actualizada'));
      setTimeout(() => router.replace('/(tabs)'), 1800);
    } catch (error: any) {
      Alert.alert(t('error'), error.message || t('error_actualizar_perfil'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {status === 'processing' && (
        <>
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text style={[styles.text, { color: currentTheme.colors.text }]}>{message}</Text>
        </>
      )}

      {status === 'success' && (
        <>
          <Text style={styles.icon}>✅</Text>
          <Text style={[styles.text, { color: currentTheme.colors.primary }]}>{message}</Text>
        </>
      )}

      {status === 'error' && (
        <>
          <Text style={styles.icon}>❌</Text>
          <Text style={[styles.text, { color: '#FF4757' }]}>{message}</Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
            <Text style={[styles.link, { color: currentTheme.colors.primary }]}>
              {t('volver_inicio')}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {status === 'reset_form' && (
        <>
          <Text style={styles.icon}>🔐</Text>
          <Text style={[styles.title, { color: currentTheme.colors.text }]}>{message}</Text>
          <View style={styles.form}>
            <TextInput
              style={[styles.input, { backgroundColor: currentTheme.colors.card, color: currentTheme.colors.text, borderColor: currentTheme.colors.border }]}
              placeholder={t('nueva_contraseña')}
              placeholderTextColor={currentTheme.colors.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { backgroundColor: currentTheme.colors.card, color: currentTheme.colors.text, borderColor: currentTheme.colors.border }]}
              placeholder={t('confirmar_contraseña')}
              placeholderTextColor={currentTheme.colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: currentTheme.colors.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSetNewPassword}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? t('cargando') : t('actualizar_contraseña')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: currentTheme.colors.primary }]}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={[styles.cancelButtonText, { color: currentTheme.colors.primary }]}>
                {t('cancelar')}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 20 },
  icon: { fontSize: 48 },
  text: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  link: { fontSize: 15, fontWeight: '600', marginTop: 12 },
  form: { width: '100%', gap: 14, marginTop: 8 },
  input: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, fontSize: 15 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5 },
  cancelButtonText: { fontSize: 15, fontWeight: '600' },
});
