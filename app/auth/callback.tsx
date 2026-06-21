import { useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../services/supabase';

/**
 * Parser manual portable de query string o fragment — NO depende de
 * URLSearchParams ni de polyfills de Expo. Funciona en cualquier runtime
 * JS (RN bare, Expo, Hermes, JSC, web). Decodifica utf-8.
 *
 * Lo usamos aqui porque el deep link de Supabase pasa los tokens en el
 * fragmento `#`, que expo-router no expone via useLocalSearchParams en
 * Android, y URLSearchParams no es global garantizado en RN 0.81 bare.
 */
function parseQueryOrFragment(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of s.split('&')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    try {
      const k = decodeURIComponent(pair.slice(0, eq));
      const v = decodeURIComponent(pair.slice(eq + 1));
      if (k) out[k] = v;
    } catch {
      // Pair con % malformado: descartar silenciosamente en vez de explotar.
      // La razon: este parser esta en el camino del recovery flow; un token
      // mal-encodado NO debe tirar abajo el callback (la app ya tiene timeout
      // defensivo de 4s + UI de error con boton para introducir codigo manual).
    }
  }
  return out;
}

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

  /**
   * Cold/warm start deep link handling.
   *
   * Por que este useEffect es tan complejo:
   *
   * El email de "restablecer contrasena" de Supabase incluye un magic link
   * con esta forma:
   *   invoicerapid://auth/callback#access_token=xxx&refresh_token=yyy
   *
   * En Android, expo-router NO propaga el fragmento `#...` a
   * `useLocalSearchParams` (solo lee query params `?`). Por eso, al pulsar
   * el magic link del email, el callback se montaba SIN TOKEN y se quedaba
   * en estado 'processing' con un ActivityIndicator para siempre.
   *
   * Solucion: leer la URL completa con
   *   - Linking.getInitialURL()    → cold start (app cerrada)
   *   - Linking.addEventListener   → warm start (app en background)
   * parsear manualmente tanto fragments (`#`) como query (`?`), y procesar
   * tanto access_token+refresh_token (magic link) como token_hash+type
   * (verifyOtp).
   *
   * Tambien: defensa en profundidad con un timeout de 4s para que la app
   * NUNCA se quede colgada en "Cargando...".
   */
  useEffect(() => {
    // 1) Si params ya llegaron por query (caso feliz, expedito), procesarlos
    if (params.token_hash && params.type) {
      if (!processedRef.current) {
        processedRef.current = true;
        handleCallback();
      }
      return;
    }

    // 2) Defensa en profundidad: timeout de 4s para que no se quede en 'processing'
    const fallbackTimer = setTimeout(() => {
      if (!processedRef.current) {
        processedRef.current = true;
        setStatus('error');
        setMessage(
          'No se pudo leer el enlace del email. Pulsa "Introducir codigo manualmente" debajo para restablecer tu contrasena.'
        );
      }
    }, 4000);

    // 3) Cold start: leer URL inicial. Linking SI devuelve el fragment `#`
    Linking.getInitialURL().then((url) => processDeepLinkUrl(url));

    // 4) Warm start: escuchar URLs entrantes mientras la app esta en background
    const sub = Linking.addEventListener('url', (event) =>
      processDeepLinkUrl(event.url)
    );

    return () => {
      clearTimeout(fallbackTimer);
      sub.remove();
    };
  }, [params.token_hash, params.type]);

  /**
   * Extrae tokens del deep link. Acepta tanto query (?) como fragment (#)
   * El fragment es el caso habitual en emails de Supabase.
   */
  function processDeepLinkUrl(url: string | null) {
    if (!url || processedRef.current) return;
    const fragmentOrQuery = url.split('#')[1] || url.split('?')[1];
    if (!fragmentOrQuery) return;

    const parsed = parseQueryOrFragment(fragmentOrQuery);
    // Normalizar a `string | null` para no chocar con la firma de processTokens
    const access_token: string | null = parsed.access_token ?? null;
    const refresh_token: string | null = parsed.refresh_token ?? null;
    const token_hash: string | null = parsed.token_hash ?? null;
    const type: string | null = parsed.type ?? params.type ?? null;

    if (access_token || token_hash) {
      processedRef.current = true;
      processTokens(access_token, refresh_token, token_hash, type);
    }
  }

  /**
   * Procesa tokens en cualquiera de los dos formatos que Supabase puede enviar:
   *  - B1: magic link → access_token + refresh_token (Supabase ya canjeo el
   *    token por una sesion valida). Llamamos setSession().
   *  - B2: token_hash + type → todavia hay que verificar el codigo contra
   *    el servidor. Llamamos verifyOtp().
   */
  async function processTokens(
    access_token: string | null,
    refresh_token: string | null,
    token_hash: string | null,
    type: string | null
  ) {
    if (!supabase) {
      setStatus('error');
      setMessage(t('error'));
      return;
    }
    try {
      // B1: Magic link completo — Supabase ya entrego una sesion valida
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) throw error;
        setStatus('reset_form');
        setMessage(t('elige_nueva_contraseña'));
        return;
      }

      // B2: token_hash + type — verificar contra el servidor
      if (token_hash && type) {
        if (type === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: 'recovery',
          });
          if (error) throw error;
          setStatus('reset_form');
          setMessage(t('elige_nueva_contraseña'));
        } else if (type === 'email') {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: 'email',
          });
          if (error) throw error;
          setStatus('success');
          setMessage(t('email_verificado'));
          setTimeout(() => router.replace('/(tabs)'), 1800);
        } else {
          setStatus('error');
          setMessage(t('enlace_no_soportado'));
        }
        return;
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || t('error'));
    }
  }

  /** Wrapper para mantener compatibilidad: cuando params llegan por query (?)  */
  async function handleCallback() {
    await processTokens(
      null,
      null,
      params.token_hash ?? null,
      params.type ?? null
    );
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
      // Cerrar la sesión temporal de recovery y redirigir al login
      setTimeout(async () => {
        await supabase!.auth.signOut();
        router.replace('/auth/login');
      }, 1800);
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
          <TouchableOpacity onPress={() => router.replace('/auth/forgot-password')}>
            <Text style={[styles.link, { color: currentTheme.colors.primary }]}>
              Introducir codigo de 6 digitos manualmente
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
            <Text style={[styles.link, { color: currentTheme.colors.textSecondary }]}>
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
