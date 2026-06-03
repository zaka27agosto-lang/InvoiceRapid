import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

const LIMITE_FACTURAS_MENSUAL = 5;
const MONTHLY_COUNTER_KEY = 'monthly_invoice_counter';
const REWARDED_ADS_KEY = 'rewarded_ads_monthly';
const MAX_REWARDED_ADS_PER_MONTH = 1;

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
 * Intenta incrementar el contador de facturas en Supabase.
 * Retorna true si se completó con éxito, false si falló.
 */
async function incrementInvoiceInSupabase(_userId: string, month: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.rpc('increment_invoice_counter', {
      p_month: month,
    });
    return !error;
  } catch {
    return false;
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
 * Fuente principal: Supabase. Fallback: AsyncStorage.
 * @returns canCreate: si puede crear más facturas, currentCount: usadas este mes, limit: límite mensual
 */
export async function checkInvoiceLimitAsync(): Promise<{ canCreate: boolean; currentCount: number; limit: number }> {
  const month = getCurrentMonth();

  // 1. Intentar obtener desde Supabase
  const userId = await getCurrentUserId();
  if (userId) {
    const supabaseCounter = await getCounterFromSupabase(userId, month);
    if (supabaseCounter !== null) {
      // Actualizar AsyncStorage como caché
      await setMonthlyCounter({ month, count: supabaseCounter.invoice_count });
      return {
        canCreate: supabaseCounter.invoice_count < LIMITE_FACTURAS_MENSUAL,
        currentCount: supabaseCounter.invoice_count,
        limit: LIMITE_FACTURAS_MENSUAL,
      };
    }
  }

  // 2. Fallback: AsyncStorage
  let counter = await getMonthlyCounter();

  // Si el mes ha cambiado, resetear contador automáticamente
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
 * Fuente principal: Supabase. Fallback: AsyncStorage.
 */
export async function incrementInvoiceCounter(): Promise<void> {
  const month = getCurrentMonth();

  // 1. Intentar incrementar en Supabase
  const userId = await getCurrentUserId();
  if (userId) {
    const ok = await incrementInvoiceInSupabase(userId, month);
    if (ok) {
      // Actualizar AsyncStorage como caché
      let counter = await getMonthlyCounter();
      if (counter.month !== month) {
        counter = { month, count: 1 };
      } else {
        counter.count += 1;
      }
      await setMonthlyCounter(counter);
      return;
    }
  }

  // 2. Fallback: AsyncStorage
  let counter = await getMonthlyCounter();
  if (counter.month !== month) {
    counter = { month, count: 1 };
  } else {
    counter.count += 1;
  }
  await setMonthlyCounter(counter);
}

/* ────────── REWARDED ADS — tracking mensual ────────── */

/**
 * Devuelve cuántos rewarded ads quedan disponibles este mes (máx 1/mes).
 * Fuente principal: Supabase. Fallback: AsyncStorage.
 */
export async function getRemainingRewardedAds(): Promise<number> {
  const month = getCurrentMonth();

  // 1. Intentar obtener desde Supabase
  const userId = await getCurrentUserId();
  if (userId) {
    const supabaseCounter = await getCounterFromSupabase(userId, month);
    if (supabaseCounter !== null) {
      // Actualizar AsyncStorage como caché
      const counter = await resetIfMonthChanged({ month, count: supabaseCounter.rewarded_count });
      await setRewardedAdCounter(counter);
      return Math.max(0, MAX_REWARDED_ADS_PER_MONTH - counter.count);
    }
  }

  // 2. Fallback: AsyncStorage
  let counter = await getRewardedAdCounter();
  counter = await resetIfMonthChanged(counter);
  return Math.max(0, MAX_REWARDED_ADS_PER_MONTH - counter.count);
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
