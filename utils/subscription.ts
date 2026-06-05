import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

const LIMITE_FACTURAS_MENSUAL = 5;

/** URL de la Edge Function para check + incremento atómico de facturas */
const EDGE_FUNCTION_URL = `${
  process.env.EXPO_PUBLIC_SUPABASE_URL || ''
}/functions/v1/check-and-increment-invoice`;
const MONTHLY_COUNTER_KEY = 'monthly_invoice_counter';
const REWARDED_ADS_KEY = 'rewarded_ads_monthly';
const APP_CONFIG_CACHE_KEY = 'app_config_cache';
const MAX_REWARDED_ADS_PER_MONTH_HARDCODED = 1;

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

// ────── AsyncStorage helpers (fallback) ──────

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

// ────── Remote config helpers ──────

const APP_CONFIG_KEY_MAX_REWARDED = 'max_rewarded_ads_per_month';

/**
 * Obtiene max_rewarded_ads_per_month desde Supabase (app_config).
 * Hace caché en AsyncStorage. Fallback al valor hardcodeado si no hay conexión.
 */
async function getMaxRewardedAdsPerMonth(): Promise<number> {
  // 1. Intentar desde Supabase
  if (supabase) {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', APP_CONFIG_KEY_MAX_REWARDED)
        .maybeSingle();

      if (data?.value) {
        const parsed = parseInt(data.value, 10);
        if (!isNaN(parsed) && parsed > 0) {
          // Guardar en caché local
          await AsyncStorage.setItem(APP_CONFIG_CACHE_KEY, JSON.stringify({
            [APP_CONFIG_KEY_MAX_REWARDED]: parsed,
          }));
          return parsed;
        }
      }
    } catch {
      // Silencioso — usar caché o fallback
    }
  }

  // 2. Intentar desde AsyncStorage (caché)
  try {
    const cached = await AsyncStorage.getItem(APP_CONFIG_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (typeof parsed[APP_CONFIG_KEY_MAX_REWARDED] === 'number') {
        return parsed[APP_CONFIG_KEY_MAX_REWARDED];
      }
    }
  } catch {
    // Silencioso
  }

  // 3. Fallback al valor hardcodeado
  return MAX_REWARDED_ADS_PER_MONTH_HARDCODED;
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

  return {
    canCreate: counter.count < LIMITE_FACTURAS_MENSUAL,
    currentCount: counter.count,
    limit: LIMITE_FACTURAS_MENSUAL,
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
 * Devuelve cuántos rewarded ads quedan disponibles este mes (máx 1/mes).
 * Fuente principal: Supabase. Fallback: AsyncStorage.
 */
export async function getRemainingRewardedAds(): Promise<number> {
  const month = getCurrentMonth();

  // 1. Obtener el límite remoto (con caché y fallback)
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
