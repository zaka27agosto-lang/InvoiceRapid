import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { getRemoteConfigSync } from './remoteConfig';

/** URL de la Edge Function para check + incremento atómico de facturas */
const EDGE_FUNCTION_URL = `${
  process.env.EXPO_PUBLIC_SUPABASE_URL || ''
}/functions/v1/check-and-increment-invoice`;
const MONTHLY_COUNTER_KEY = 'monthly_invoice_counter';
const REWARDED_ADS_KEY = 'rewarded_ads_monthly';

/**
 * NOTA: Los límites antes hardcoded en este archivo (límite de facturas,
 * máximo rewarded ads al mes) ahora viven en la tabla `app_config` de
 * Supabase (`monthly_free_invoice_limit`, `max_rewarded_ads_per_month`).
 * El cliente los lee desde `utils/remoteConfig.ts` con caché tri-nivel
 * (memoria → AsyncStorage → Supabase → defaults). Esto evita caches
 * duplicados y permite que el admin los ajuste sin recompilar.
 *
 * Defaults en código coinciden con la migración SQL — la app funciona
 * incluso si la migración todavía no se ha ejecutado.
 */

interface MonthlyCounter {
  month: string; // "YYYY-MM" format
  count: number;
}

interface RewardedAdCounter {
  month: string;  // "YYYY-MM"
  count: number;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Obtiene el user_id actual desde Supabase, o null si no hay sesión */
async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

// ────── AsyncStorage helpers (fallback contador mensual) ──────

async function getMonthlyCounter(): Promise<MonthlyCounter> {
  try {
    const stored = await AsyncStorage.getItem(MONTHLY_COUNTER_KEY);
    if (!stored) return { month: getCurrentMonth(), count: 0 };
    return JSON.parse(stored);
  } catch {
    return { month: getCurrentMonth(), count: 0 };
  }
}

async function setMonthlyCounter(counter: MonthlyCounter): Promise<void> {
  await AsyncStorage.setItem(MONTHLY_COUNTER_KEY, JSON.stringify(counter));
}

async function getRewardedAdCounter(): Promise<RewardedAdCounter> {
  try {
    const stored = await AsyncStorage.getItem(REWARDED_ADS_KEY);
    if (!stored) return { month: getCurrentMonth(), count: 0 };
    return JSON.parse(stored);
  } catch {
    return { month: getCurrentMonth(), count: 0 };
  }
}

async function setRewardedAdCounter(counter: RewardedAdCounter): Promise<void> {
  await AsyncStorage.setItem(REWARDED_ADS_KEY, JSON.stringify(counter));
}

async function resetIfMonthChanged(counter: RewardedAdCounter): Promise<RewardedAdCounter> {
  const thisMonth = getCurrentMonth();
  if (counter.month !== thisMonth) {
    const newCounter: RewardedAdCounter = { month: thisMonth, count: 0 };
    await setRewardedAdCounter(newCounter);
    return newCounter;
  }
  return counter;
}

// ────── Edge Function helper ──────

interface EdgeFunctionResult {
  canCreate: boolean;
  isPro: boolean;
  currentCount: number;
  limit: number;
}

/**
 * Llama a la Edge Function check-and-increment-invoice.
 * Retorna null si no hay conexión o hay error.
 */
async function callEdgeFunction(month: string, mode: 'check' | 'increment'): Promise<EdgeFunctionResult | null> {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ month, mode }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ────── Supabase helpers ──────

/**
 * Intenta obtener el contador desde Supabase.
 * Retorna null si no hay conexión, no hay sesión, o hay error.
 */
async function getCounterFromSupabase(_userId: string, month: string): Promise<{ invoice_count: number; rewarded_count: number } | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .rpc('get_invoice_counter', { p_month: month });
    if (error) return null;
    if (!data || data.length === 0) return { invoice_count: 0, rewarded_count: 0 };
    return { invoice_count: data[0].invoice_count ?? 0, rewarded_count: data[0].rewarded_count ?? 0 };
  } catch {
    return null;
  }
}

/**
 * Intenta incrementar el contador de rewarded ads en Supabase.
 * Retorna true si se completó con éxito, false si falló.
 */
async function incrementRewardedInSupabase(_userId: string, month: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.rpc('increment_rewarded_counter', {
      p_month: month,
    });
    return !error;
  } catch {
    return false;
  }
}

// ────── Wrappers thin sobre remoteConfig (mantienen API async) ──────

/**
 * Máximo de rewarded ads al mes. Lee del cache centralizado.
 */
async function getMaxRewardedAdsPerMonth(): Promise<number> {
  return getRemoteConfigSync().max_rewarded_ads_per_month;
}

// ────── Funciones exportadas ──────

/**
 * Verifica los límites de facturas del mes actual.
 * Fuente principal: Edge Function (segura, inbypasseable).
 * Caché local: AsyncStorage para mostrar la UI aunque no haya conexión.
 * @param isPremium - Si el usuario es premium, se salta la verificación y devuelve límite ilimitado.
 * @returns canCreate: si puede crear más facturas, currentCount: usadas este mes, limit: límite mensual
 */
export async function checkInvoiceLimitAsync(isPremium?: boolean): Promise<{ canCreate: boolean; currentCount: number; limit: number }> {
  // Premium siempre tiene acceso ilimitado
  if (isPremium) {
    return { canCreate: true, currentCount: 0, limit: 999 };
  }

  const month = getCurrentMonth();

  // 1. Fuente principal: Edge Function (service_role, inbypasseable)
  const edgeResult = await callEdgeFunction(month, 'check');
  if (edgeResult !== null) {
    // Actualizar AsyncStorage como caché local
    await setMonthlyCounter({ month, count: edgeResult.currentCount });
    return edgeResult;
  }

  // 2. Si no hay conexión: usar AsyncStorage como caché de UI (solo informativo)
  let counter = await getMonthlyCounter();
  if (counter.month !== month) {
    counter = { month, count: 0 };
    await setMonthlyCounter(counter);
  }

  // Fallback dinámico desde app_config (si está cacheado) o default 5.
  const fallbackLimit = getRemoteConfigSync().monthly_free_invoice_limit;

  return {
    canCreate: counter.count < fallbackLimit,
    currentCount: counter.count,
    limit: fallbackLimit,
  };
}

/**
 * Incrementa el contador mensual de facturas creadas.
 * Llama a la Edge Function que verifica el límite e incrementa atómicamente.
 * NO tiene fallback offline — sin conexión no se puede crear factura.
 * @throws Error si no hay conexión o la Edge Function rechaza la operación.
 */
export async function incrementInvoiceCounter(): Promise<void> {
  const month = getCurrentMonth();

  // 1. Fuente única: Edge Function (service_role, inbypasseable)
  const edgeResult = await callEdgeFunction(month, 'increment');

  if (edgeResult === null) {
    throw new Error('No hay conexión para verificar el límite de facturas');
  }

  if (!edgeResult.canCreate) {
    throw new Error(`Límite mensual alcanzado (${edgeResult.currentCount}/${edgeResult.limit})`);
  }

  // 2. Actualizar AsyncStorage como caché local
  await setMonthlyCounter({ month, count: edgeResult.currentCount });
}

/* ────────── REWARDED ADS — tracking mensual ────────── */

/**
 * Devuelve cuántos rewarded ads quedan disponibles este mes.
 * El límite (máx 1/mes) viene de `app_config.max_rewarded_ads_per_month`.
 * Fuente principal: Supabase. Fallback: AsyncStorage.
 */
export async function getRemainingRewardedAds(): Promise<number> {
  const month = getCurrentMonth();

  // 1. Obtener el límite remoto (ya cacheado por remoteConfig; con hot-reload)
  const maxAds = await getMaxRewardedAdsPerMonth();

  // 2. Intentar obtener contador desde Supabase
  const userId = await getCurrentUserId();
  if (userId) {
    const supabaseCounter = await getCounterFromSupabase(userId, month);
    if (supabaseCounter !== null) {
      // Actualizar AsyncStorage como caché
      const counter = await resetIfMonthChanged({ month, count: supabaseCounter.rewarded_count });
      await setRewardedAdCounter(counter);
      return Math.max(0, maxAds - counter.count);
    }
  }

  // 3. Fallback: AsyncStorage
  let counter = await getRewardedAdCounter();
  counter = await resetIfMonthChanged(counter);
  return Math.max(0, maxAds - counter.count);
}

/**
 * Incrementa el contador mensual de rewarded ads vistos.
 * Fuente principal: Supabase. Fallback: AsyncStorage.
 */
export async function incrementRewardedAdCount(): Promise<void> {
  const month = getCurrentMonth();

  // 1. Intentar incrementar en Supabase
  const userId = await getCurrentUserId();
  if (userId) {
    const ok = await incrementRewardedInSupabase(userId, month);
    if (ok) {
      // Actualizar AsyncStorage como caché
      let counter = await getRewardedAdCounter();
      counter = await resetIfMonthChanged(counter);
      counter.count += 1;
      await setRewardedAdCounter(counter);
      return;
    }
  }

  // 2. Fallback: AsyncStorage
  let counter = await getRewardedAdCounter();
  counter = await resetIfMonthChanged(counter);
  counter.count += 1;
  await setRewardedAdCounter(counter);
}
