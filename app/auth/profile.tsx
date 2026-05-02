import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function Profile() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { user, signOut } = useAuth();
  
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

        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: '#FF4757' }]}
          onPress={handleSignOut}
          disabled={loading}
        >
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>{loading ? t('cargando') : t('cerrar_sesion')}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  section: { borderRadius: 16, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12 },
  logoutButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
