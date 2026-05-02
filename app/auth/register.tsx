import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

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

    setLoading(true);
    const result = await signUpWithEmail(email, password, name);
    setLoading(false);

    if (result.success) {
      Alert.alert(t('registro_exitoso'), t('verifica_email'));
      router.back();
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

          <View style={styles.login}>
            <Text style={[styles.loginText, { color: currentTheme.colors.textSecondary }]}>{t('ya_cuenta')}</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.loginLink, { color: currentTheme.colors.primary }]}>{t('iniciar_sesion')}</Text>
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
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  login: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 8 },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: '600' },
});
