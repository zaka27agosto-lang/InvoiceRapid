import AsyncStorage from '@react-native-async-storage/async-storage';
import db from '../app/db/database';

const LIMITE_FACTURAS_GRATIS = 15;
const COUNTER_KEY = 'facturas_creadas_total';

async function getContadorAcumulado(): Promise<number> {
  try {
    const valor = await AsyncStorage.getItem(COUNTER_KEY);
    return valor ? parseInt(valor, 10) : 0;
  } catch {
    return 0;
  }
}

async function incrementarContador(): Promise<void> {
  try {
    const actual = await getContadorAcumulado();
    await AsyncStorage.setItem(COUNTER_KEY, (actual + 1).toString());
  } catch (error) {
    console.error('Error incrementando contador:', error);
  }
}

export function checkInvoiceLimit(): { canCreate: boolean; currentCount: number; limit: number } {
  // Usar contador acumulativo en lugar de contar facturas existentes
  // Por ahora, para mantener compatibilidad con el código síncrono, 
  // usamos el conteo de facturas existentes como fallback
  const facturas = db.getAllSync('SELECT COUNT(*) as count FROM facturas') as any[];
  const currentCount = facturas[0]?.count || 0;
  const limit = LIMITE_FACTURAS_GRATIS;
  
  return {
    canCreate: currentCount < limit,
    currentCount,
    limit
  };
}

// Nueva función que usa el contador acumulativo (asíncrona)
export async function checkInvoiceLimitAsync(): Promise<{ canCreate: boolean; currentCount: number; limit: number }> {
  const currentCount = await getContadorAcumulado();
  let limit = LIMITE_FACTURAS_GRATIS;
  try {
    const customLimit = await AsyncStorage.getItem('limite_facturas');
    if (customLimit) {
      limit = parseInt(customLimit, 10);
    }
  } catch (e) {
    // Fallback a límite por defecto
  }
  
  return {
    canCreate: currentCount < limit,
    currentCount,
    limit
  };
}

// Función para incrementar el contador cuando se crea una factura
export async function incrementInvoiceCounter(): Promise<void> {
  await incrementarContador();
}

export function isProPlan(): boolean {
  // Por ahora, asumimos que siempre es plan gratuito
  // En el futuro, esto podría verificar un estado de suscripción real
  return false;
}
