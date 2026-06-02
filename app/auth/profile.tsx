import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../services/supabase';

export default function Profile() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { user, signOut, signInWithGoogle } = useAuth();

  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    Alert.alert(
      t('cerrar_sesion'),
      t('confirmar_cerrar_sesion'),
      [
        { text: t('cancelar'), style: 'cancel' },
        {
          text: t('cerrar_sesion'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await signOut();
            setLoading(false);
            router.replace('/auth/login');
          }
        }
      ]
    );
  }

  // Si no hay usuario autenticado, mostrar opciones de login/registro
  if (!user) {
    return (
      <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: currentTheme.colors.text }]}>{t('mi_perfil')}</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={[styles.emptyCard, { backgroundColor: currentTheme.colors.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: currentTheme.colors.primaryLight }]}>
              <Ionicons name="person" size={48} color={currentTheme.colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: currentTheme.colors.text }]}>{t('inicia_sesion')}</Text>
            <Text style={[styles.emptyDesc, { color: currentTheme.colors.textSecondary }]}>
              {t('requiere_cuenta_para_funciones')}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={() => router.push('/auth/login')}
          >
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>{t('inicia_sesion')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: currentTheme.colors.primary }]}
            onPress={() => router.push('/auth/register')}
          >
            <Ionicons name="person-add-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: currentTheme.colors.primary }]}>{t('crear_cuenta')}</Text>
          </TouchableOpacity>

          {true && (
            <>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: currentTheme.colors.border }]} />
                <Text style={[styles.dividerText, { color: currentTheme.colors.textSecondary }]}>{t('o')}</Text>
                <View style={[styles.dividerLine, { backgroundColor: currentTheme.colors.border }]} />
              </View>

              <TouchableOpacity
                style={[styles.googleButton, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}
                onPress={async () => {
                  setLoading(true);
                  const result = await signInWithGoogle();
                  setLoading(false);
                  if (result.success) {
                    router.replace('/(tabs)');
                  }
                }}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={[styles.googleButtonText, { color: currentTheme.colors.text }]}>{loading ? t('cargando') : t('continuar_google')}</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // Estado para modales
  const [mostrarCambiarNombre, setMostrarCambiarNombre] = useState(false);
  const [mostrarEstablecerPassword, setMostrarEstablecerPassword] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(user?.user_metadata?.name || '');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [nuevaPasswordConfirm, setNuevaPasswordConfirm] = useState('');

  // Detectar si el usuario se registró con Google (no tiene email/password identity)
  const esCuentaGoogle = user?.app_metadata?.provider === 'google' || 
    !user?.identities?.some((i: any) => i.provider === 'email');

  async function handleCambiarNombre() {
    if (!nuevoNombre.trim()) {
      Alert.alert(t('error'), t('nombre_requerido'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase!.auth.updateUser({
        data: { name: nuevoNombre.trim() }
      });
      if (error) throw error;
      Alert.alert('✅', t('nombre_actualizado'));
      setMostrarCambiarNombre(false);
    } catch (err: any) {
      Alert.alert(t('error'), err.message || t('error_actualizar_perfil'));
    } finally {
      setLoading(false);
    }
  }

  async function handleEstablecerPassword() {
    if (!nuevaPassword || nuevaPassword.length < 6) {
      Alert.alert(t('error'), t('password_minimo'));
      return;
    }
    if (nuevaPassword !== nuevaPasswordConfirm) {
      Alert.alert(t('error'), t('password_no_coinciden'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase!.auth.updateUser({
        password: nuevaPassword
      });
      if (error) throw error;
      Alert.alert('✅', t('password_establecida'));
      setMostrarEstablecerPassword(false);
      setNuevaPassword('');
      setNuevaPasswordConfirm('');
    } catch (err: any) {
      Alert.alert(t('error'), err.message || t('error_establecer_password'));
    } finally {
      setLoading(false);
    }
  }

  // Si hay usuario autenticado, mostrar perfil
  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: currentTheme.colors.text }]}>{t('mi_perfil')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.card, { backgroundColor: currentTheme.colors.card }]}>
          <View style={[styles.avatar, { backgroundColor: currentTheme.colors.primaryLight }]}>
            <Ionicons name="person" size={40} color={currentTheme.colors.primary} />
          </View>
          <Text style={[styles.name, { color: currentTheme.colors.text }]}>
            {user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario'}
          </Text>
          <Text style={[styles.email, { color: currentTheme.colors.textSecondary }]}>{user?.email}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.textSecondary }]}>{t('informacion_cuenta')}</Text>

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={currentTheme.colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>{t('email')}</Text>
              <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>{user?.email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={currentTheme.colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>{t('miembro_desde')}</Text>
              <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={currentTheme.colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>{t('estado')}</Text>
              <Text style={[styles.infoValue, { color: '#26de81' }]}>{t('verificado')}</Text>
            </View>
          </View>
        </View>

        {/* Acciones de perfil */}
        <View style={[styles.section, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.textSecondary }]}>{t('acciones')}</Text>

          {/* Cambiar nombre */}
          <TouchableOpacity style={styles.infoRow} onPress={() => { setNuevoNombre(user?.user_metadata?.name || ''); setMostrarCambiarNombre(true); }}>
            <Ionicons name="create-outline" size={20} color={currentTheme.colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>{t('cambiar_nombre')}</Text>
              <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>
                {user?.user_metadata?.name || t('nombre_no_definido')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Establecer contraseña (solo cuentas Google) */}
          {esCuentaGoogle && (
            <TouchableOpacity style={styles.infoRow} onPress={() => setMostrarEstablecerPassword(true)}>
              <Ionicons name="lock-closed-outline" size={20} color={currentTheme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: currentTheme.colors.textSecondary }]}>{t('establecer_password')}</Text>
                <Text style={[styles.infoValue, { color: currentTheme.colors.text }]}>
                  {t('sin_password')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: '#FF4757' }]}
          onPress={handleSignOut}
          disabled={loading}
        >
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>{loading ? t('cargando') : t('cerrar_sesion')}</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Modal Cambiar Nombre */}
      <Modal visible={mostrarCambiarNombre} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarCambiarNombre(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('cambiar_nombre')}</Text>
            <TouchableOpacity onPress={handleCambiarNombre} disabled={loading}>
              <Text style={styles.modalGuardar}>{t('guardar')}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={styles.campoLabel}>{t('nombre')}</Text>
            <TextInput
              style={styles.campoInput}
              placeholder={t('tu_nombre')}
              placeholderTextColor="#bbb"
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
              autoFocus
            />
          </View>
        </View>
      </Modal>

      {/* Modal Establecer Contraseña */}
      <Modal visible={mostrarEstablecerPassword} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarEstablecerPassword(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('establecer_password')}</Text>
            <TouchableOpacity onPress={handleEstablecerPassword} disabled={loading}>
              <Text style={styles.modalGuardar}>{t('guardar')}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={styles.campoLabel}>{t('nueva_password')}</Text>
            <TextInput
              style={styles.campoInput}
              placeholder="••••••"
              placeholderTextColor="#bbb"
              value={nuevaPassword}
              onChangeText={setNuevaPassword}
              secureTextEntry
              autoFocus
            />
            <Text style={[styles.campoLabel, { marginTop: 16 }]}>{t('confirmar_password')}</Text>
            <TextInput
              style={styles.campoInput}
              placeholder="••••••"
              placeholderTextColor="#bbb"
              value={nuevaPasswordConfirm}
              onChangeText={setNuevaPasswordConfirm}
              secureTextEntry
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  scroll: { flex: 1, paddingTop: 55, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800' },
  card: { alignItems: 'center', padding: 32, borderRadius: 16, marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  email: { fontSize: 14 },
  emptyCard: { alignItems: 'center', padding: 40, borderRadius: 16, marginBottom: 20 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  section: { borderRadius: 16, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12 },
  logoutButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, marginBottom: 12 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, borderWidth: 2, marginBottom: 12 },
  secondaryButtonText: { fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 14, fontWeight: '500' },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, gap: 12 },
  googleButtonText: { fontSize: 16, fontWeight: '600' },
  modalWrapper: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  modalGuardar: { fontSize: 16, fontWeight: '700', color: '#6C47FF' },
  campoLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  campoInput: { borderWidth: 1.5, borderColor: '#e8e8e8', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa' },
});
