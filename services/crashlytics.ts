import { Platform } from 'react-native';

// Solo importar Firebase Crashlytics en plataformas nativas
let crashlytics: any = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    crashlytics = require('@react-native-firebase/crashlytics').default;
  } catch {
    // Crashlytics no disponible (web o error de importación)
  }
}

const isAvailable = !!crashlytics;

/**
 * Inicializa Crashlytics y configura los manejadores globales de errores no capturados.
 * Debe llamarse una vez al arrancar la app.
 */
export function initCrashlytics(): void {
  if (!isAvailable) return;

  try {
    // Habilitar el reporte automático de crashes
    crashlytics().setCrashlyticsCollectionEnabled(true);

    // Configurar manejador de errores JS no capturados (ErrorUtils)
    const defaultErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      if (isFatal) {
        crashlytics().recordError(error);
      }
      // Llamar al manejador por defecto para que el error se propague
      defaultErrorHandler(error, isFatal);
    });

    // Nota: Las promesas rechazadas no capturadas en React Native no tienen
    // un evento global estándar como window.onunhandledrejection.
    // El ErrorUtils handler de arriba captura errores síncronos.
    // Para promesas, cada llamada async/await con try/catch es la práctica recomendada.
  } catch {
    // Error silencioso al inicializar Crashlytics
  }
}

/**
 * Establece el identificador del usuario en Crashlytics para seguimiento de crashes.
 * @param userId ID del usuario (ej. UUID de Supabase)
 */
export function setCrashlyticsUserId(userId: string): void {
  if (!isAvailable) return;
  try {
    crashlytics().setUserId(userId);
  } catch { /* silencioso */ }
}

/**
 * Registra un error no fatal en Crashlytics.
 * @param error El error a registrar
 * @param context Contexto adicional (ej. nombre de la operación)
 */
export function logError(error: Error, context?: string): void {
  if (!isAvailable) return;
  try {
    if (context) {
      crashlytics().log(`[${context}] ${error.message}`);
    }
    crashlytics().recordError(error);
  } catch { /* silencioso */ }
}

/**
 * Registra un mensaje de log personalizado en Crashlytics.
 * @param message Mensaje descriptivo
 */
export function logCrashlytics(message: string): void {
  if (!isAvailable) return;
  try {
    crashlytics().log(message);
  } catch { /* silencioso */ }
}

/**
 * Establece atributos personalizados para filtrar crashes en Firebase Console.
 * @param key Nombre del atributo
 * @param value Valor del atributo
 */
export function setCrashlyticsAttribute(key: string, value: string): void {
  if (!isAvailable) return;
  try {
    crashlytics().setAttribute(key, value);
  } catch { /* silencioso */ }
}

/**
 * Envía un crash simulado para verificar que Crashlytics funciona.
 * SOLO PARA PRUEBAS.
 */
export function testCrashlytics(): void {
  if (!isAvailable) return;
  try {
    crashlytics().crash();
  } catch { /* silencioso */ }
}

export default {
  initCrashlytics,
  setCrashlyticsUserId,
  logError,
  logCrashlytics,
  setCrashlyticsAttribute,
  testCrashlytics,
  isAvailable,
};
