import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { isGoogleSigninAvailable } from '../../utils/googleSignIn';

export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { signInWithEmail, signInWithGoogle } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const googleAvailable = isGoogleSigninAvailable();

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(t('error'), t('campos_requeridos'));
      return;
    }

    setLoading(true);
    const result = await signInWithEmail(email, password);
    setLoading(false);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert(t('error'), result.error || t('error_login'));
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
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
          </View>

          <TouchableOpacity 
            style={styles.forgotPassword}
            onPress={() => router.push('/auth/forgot-password')}
          >
            <Text style={[styles.forgotPasswordText, { color: currentTheme.colors.primary }]}>{t('olvidaste_contraseña')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? t('cargando') : t('iniciar_sesion')}</Text>
          </TouchableOpacity>

          {googleAvailable && (
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
          )}

          <View style={styles.register}>
            <Text style={[styles.registerText, { color: currentTheme.colors.textSecondary }]}>{t('no_cuenta')}</Text>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Text style={[styles.registerLink, { color: currentTheme.colors.primary }]}>{t('registrarse')}</Text>
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
  register: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 8 },
  registerText: { fontSize: 14 },
  registerLink: { fontSize: 14, fontWeight: '600' },
});
