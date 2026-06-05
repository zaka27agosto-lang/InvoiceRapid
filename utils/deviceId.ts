import AsyncStorage from '@react-native-async-storage/async-storage';

let cachedDeviceId: string | null = null;

/**
 * Obtiene o genera un ID único de dispositivo persistente.
 * Se usa para protección anti-abuso en el sistema de referidos.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  let deviceId = await AsyncStorage.getItem('device_id');
  if (!deviceId) {
    // Generar un identificador único basado en timestamp + random
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    await AsyncStorage.setItem('device_id', deviceId);
  }

  cachedDeviceId = deviceId;
  return deviceId;
}
