import React, { createContext, useContext, useState, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertConfig = {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  buttons?: AlertButton[];
};

type AlertContextType = {
  showAlert: (config: AlertConfig) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string) => void;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
};

const AlertContext = createContext<AlertContextType | null>(null);

export function useModernAlert(): AlertContextType {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useModernAlert must be used within ModernAlertProvider');
  return ctx;
}

export function ModernAlertProvider({ children }: { children: React.ReactNode }) {
  const { currentTheme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({ title: '', message: '' });
  const [resolvePromise, setResolvePromise] = useState<((v: number) => void) | null>(null);

  const showAlert = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string) => {
    setConfig({
      title,
      message,
      icon: 'help-circle-outline',
      iconColor: '#FF9F43',
      buttons: [
        { text: cancelText || 'Cancelar', style: 'cancel', onPress: () => setVisible(false) },
        { text: confirmText || 'Confirmar', onPress: () => { setVisible(false); onConfirm(); } },
      ],
    });
    setVisible(true);
  }, []);

  const showSuccess = useCallback((title: string, message: string) => {
    setConfig({
      title, message,
      icon: 'checkmark-circle',
      iconColor: '#26de81',
      buttons: [{ text: 'OK', onPress: () => setVisible(false) }],
    });
    setVisible(true);
  }, []);

  const showError = useCallback((title: string, message: string) => {
    setConfig({
      title, message,
      icon: 'alert-circle',
      iconColor: '#FF4757',
      buttons: [{ text: 'OK', onPress: () => setVisible(false) }],
    });
    setVisible(true);
  }, []);

  const getButtonStyle = (style?: string) => {
    const base = styles.btn;
    switch (style) {
      case 'cancel': return [base, styles.btnCancel];
      case 'destructive': return [base, { backgroundColor: '#FF4757' }];
      default: return [base, { backgroundColor: currentTheme.colors.primary }];
    }
  };

  const getButtonTextStyle = (style?: string) => {
    switch (style) {
      case 'cancel': return { color: currentTheme.colors.textSecondary || '#888', fontWeight: '600' as const, fontSize: 15 };
      case 'destructive': return { color: '#fff', fontWeight: '700' as const, fontSize: 15 };
      default: return { color: '#fff', fontWeight: '700' as const, fontSize: 15 };
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, showSuccess, showError }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => {
          // Only dismiss on backdrop press if there's a cancel button or single button
          const btns = config.buttons || [];
          if (btns.length <= 1 || btns.some(b => b.style === 'cancel')) {
            setVisible(false);
          }
        }}>
          <Pressable style={[styles.card, { backgroundColor: currentTheme.colors.card }]} onPress={() => {}}>
            {config.icon && (
              <View style={[styles.iconWrap, { backgroundColor: (config.iconColor || currentTheme.colors.primary) + '15' }]}>
                <Ionicons name={config.icon} size={28} color={config.iconColor || currentTheme.colors.primary} />
              </View>
            )}
            <Text style={[styles.title, { color: currentTheme.colors.text }]}>{config.title}</Text>
            <Text style={[styles.message, { color: currentTheme.colors.textSecondary }]}>{config.message}</Text>
            <View style={styles.buttonsRow}>
              {(config.buttons || [{ text: 'OK', onPress: () => setVisible(false) }]).map((btn, i) => (
                <TouchableOpacity
                  key={i}
                  style={getButtonStyle(btn.style)}
                  onPress={() => { btn.onPress?.(); setVisible(false); }}>
                  <Text style={[getButtonTextStyle(btn.style), { textAlign: 'center' }]}>{btn.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#f0f0f0',
  },
});
