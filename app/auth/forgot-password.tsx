import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function ForgotPassword() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { resetPassword } = useAuth();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email) {
      Alert.alert(t('error'), t('email_requerido'));
      return;
    }

    setLoading(true);
    const result = await resetPassword(email);
    setLoading(false);

    if (result.success) {
      setSent(true);
    } else {
      Alert.alert(t('error'), result.error || t('error_reset'));
    }
  }

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
          <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>{sent ? t('email_enviado') : t('instrucciones_reset')}</Text>
        </View>

        {!sent ? (
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
              onPress={handleReset}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? t('cargando') : t('enviar_email')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
              onPress={() => router.back()}
            >
              <Text style={styles.buttonText}>{t('volver')}</Text>
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
  backButton: { marginTop: 20, alignItems: 'center' },
  backButtonText: { fontSize: 14, fontWeight: '600' },
});
