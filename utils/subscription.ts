import AsyncStorage from '@react-native-async-storage/async-storage';

const LIMITE_FACTURAS_MENSUAL = 5;
const MONTHLY_COUNTER_KEY = 'monthly_invoice_counter';
const REWARDED_ADS_KEY = 'rewarded_ads_daily';
const MAX_REWARDED_ADS_PER_DAY = 3;

interface MonthlyCounter {
  month: string; // "YYYY-MM" format
  count: number;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getMonthlyCounter(): Promise<MonthlyCounter> {
  try {
    const stored = await AsyncStorage.getItem(MONTHLY_COUNTER_KEY);
    if (!stored) return { month: getCurrentMonth(), count: 0 };
    return JSON.parse(stored);
  } catch {
    return { month: getCurrentMonth(), count: 0 };
  }
}

/**
 * Verifica los límites de facturas del mes actual.
 * @returns canCreate: si puede crear más facturas, currentCount: usadas este mes, limit: límite mensual
 */
export async function checkInvoiceLimitAsync(): Promise<{ canCreate: boolean; currentCount: number; limit: number }> {
  let counter = await getMonthlyCounter();
  const currentMonth = getCurrentMonth();

  // Si el mes ha cambiado, resetear contador automáticamente
  if (counter.month !== currentMonth) {
    counter = { month: currentMonth, count: 0 };
    await AsyncStorage.setItem(MONTHLY_COUNTER_KEY, JSON.stringify(counter));
  }

  return {
    canCreate: counter.count < LIMITE_FACTURAS_MENSUAL,
    currentCount: counter.count,
    limit: LIMITE_FACTURAS_MENSUAL,
  };
}

/**
 * Incrementa el contador mensual de facturas creadas.
 */
export async function incrementInvoiceCounter(): Promise<void> {
  let counter = await getMonthlyCounter();
  const currentMonth = getCurrentMonth();

  // Si el mes ha cambiado, resetear antes de incrementar
  if (counter.month !== currentMonth) {
    counter = { month: currentMonth, count: 1 };
  } else {
    counter.count += 1;
  }

  await AsyncStorage.setItem(MONTHLY_COUNTER_KEY, JSON.stringify(counter));
}

/**
 * Resetea el contador mensual — útil para tests en desarrollo.
 */
export async function resetMonthlyCounter(): Promise<void> {
  await AsyncStorage.setItem(
    MONTHLY_COUNTER_KEY,
    JSON.stringify({ month: getCurrentMonth(), count: 0 })
  );
}

/**
 * Adelanta el mes del contador al siguiente mes (simulando que pasa un mes).
 * Útil para testear el reset mensual del límite de facturas.
 * @returns El mes anterior y el nuevo mes.
 */
export async function advanceMonth(): Promise<{ oldMonth: string; newMonth: string }> {
  const counter = await getMonthlyCounter();
  const oldMonth = counter.month;

  // Calcular el siguiente mes
  const [year, month] = counter.month.split('-').map(Number);
  const date = new Date(year, month, 1); // El día 2 no importa, month 0-indexed = siguiente mes
  const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  counter.month = newMonth;
  counter.count = 0;
  await AsyncStorage.setItem(MONTHLY_COUNTER_KEY, JSON.stringify(counter));

  return { oldMonth, newMonth };
}

/**
 * Pone el contador mensual exactamente en 9 (para probar el límite en desarrollo).
 */
export async function setInvoiceCounterTo9(): Promise<number> {
  await AsyncStorage.setItem(
    MONTHLY_COUNTER_KEY,
    JSON.stringify({ month: getCurrentMonth(), count: 9 })
  );
  return 9;
}

/* ────────── REWARDED ADS — tracking diario ────────── */

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface RewardedAdCounter {
  date: string;  // "YYYY-MM-DD"
  count: number;
}

async function getRewardedAdCounter(): Promise<RewardedAdCounter> {
  try {
    const stored = await AsyncStorage.getItem(REWARDED_ADS_KEY);
    if (!stored) return { date: getTodayKey(), count: 0 };
    return JSON.parse(stored);
  } catch {
    return { date: getTodayKey(), count: 0 };
  }
}

async function resetIfDayChanged(counter: RewardedAdCounter): Promise<RewardedAdCounter> {
  const today = getTodayKey();
  if (counter.date !== today) {
    const newCounter: RewardedAdCounter = { date: today, count: 0 };
    await AsyncStorage.setItem(REWARDED_ADS_KEY, JSON.stringify(newCounter));
    return newCounter;
  }
  return counter;
}

/**
 * Devuelve cuántos rewarded ads quedan disponibles hoy (máx 3/día).
 */
export async function getRemainingRewardedAds(): Promise<number> {
  let counter = await getRewardedAdCounter();
  counter = await resetIfDayChanged(counter);
  return Math.max(0, MAX_REWARDED_ADS_PER_DAY - counter.count);
}

/**
 * Incrementa el contador diario de rewarded ads vistos.
 */
export async function incrementRewardedAdCount(): Promise<void> {
  let counter = await getRewardedAdCounter();
  counter = await resetIfDayChanged(counter);
  counter.count += 1;
  await AsyncStorage.setItem(REWARDED_ADS_KEY, JSON.stringify(counter));
}
