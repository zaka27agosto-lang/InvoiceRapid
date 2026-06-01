import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onGoogle: () => void;
}

export function AuthModal({
  visible,
  onClose,
  onLogin,
  onRegister,
  onGoogle,
}: AuthModalProps) {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: currentTheme.colors.text }]}>{t('mi_perfil')}</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: currentTheme.colors.card }]}>
            <View style={[styles.icon, { backgroundColor: currentTheme.colors.primaryLight }]}>
              <Ionicons name="lock-open-outline" size={40} color={currentTheme.colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: currentTheme.colors.text }]}>
              {t('inicia_sesion')}
            </Text>
            <Text style={[styles.cardDesc, { color: currentTheme.colors.textSecondary }]}>
              {t('requiere_cuenta_para_funciones')}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={onLogin}
          >
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>{t('inicia_sesion')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: currentTheme.colors.primary }]}
            onPress={onRegister}
          >
            <Ionicons name="person-add-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: currentTheme.colors.primary }]}>
              {t('crear_cuenta')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.googleButton, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}
            onPress={onGoogle}
          >
            <Ionicons name="logo-google" size={20} color={currentTheme.colors.text} />
            <Text style={[styles.googleButtonText, { color: currentTheme.colors.text }]}>
              {t('continuar_google')}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 18, fontWeight: '800' },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  card: { alignItems: 'center', padding: 30, borderRadius: 16, marginBottom: 24 },
  icon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  cardDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '700' },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  googleButtonText: { fontSize: 16, fontWeight: '700' },
});
