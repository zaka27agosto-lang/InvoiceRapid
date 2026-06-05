import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage adapter para Supabase Auth que usa expo-secure-store
 * para los tokens JWT (datos sensibles) y AsyncStorage como fallback.
 *
 * expo-secure-store usa el Keychain en iOS y Android Keystore,
 * protegiendo los tokens incluso en dispositivos rooteados.
 *
 * Nota: SecureStore tiene un límite de ~2048 bytes por valor.
 * Los JWTs largos (con refresh_token) pueden excederlo, por lo que
 * usamos AsyncStorage como fallback silencioso.
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null && value !== undefined) return value;
    } catch {
      // Si SecureStore falla (ej. dispositivo sin soporte), usar AsyncStorage
    }
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    // Escribir SIEMPRE en AsyncStorage como respaldo consistente.
    // Si SecureStore falla en getItem (ej. cambio biométrico),
    // AsyncStorage tiene la copia para evitar cierre de sesión forzado.
    await AsyncStorage.setItem(key, value).catch(() => {});
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // SecureStore write failed but AsyncStorage has it — acceptable fallback
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Intentar limpiar también en AsyncStorage
    }
    await AsyncStorage.removeItem(key);
  },
};
