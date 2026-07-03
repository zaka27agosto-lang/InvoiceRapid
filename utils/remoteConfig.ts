import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Import lazy de supabase para evitar crash en startup.
 *
 * El import module-level de `supabase` se ejecuta al cargar el módulo.
 * Si `expo-secure-store` (usado por el storage adapter de supabase)
 * falla durante la inicialización en Android con New Architecture,
 * lanza una excepción no capturada → crash inmediato.
 *
 * Con getSupabase() diferimos la carga hasta el primer uso real
 * (refreshRemoteConfig), que ya tiene try/catch y maneja el fallback.
 */
let _supabase: SupabaseClient | null | undefined = undefined;
function getSupabase(): SupabaseClient | null {
  if (_supabase === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../services/supabase');
      _supabase = (mod.supabase as SupabaseClient | null) ?? null;
    } catch {
      _supabase = null;
    }
  }
  return _supabase;
}

/**
 * remoteConfig — singleton cache de configuración remota en Supabase (app_config).
 *
 * ¿Por qué existe este módulo?
 * ───────────────────────────
 * Sustituye umbrales hardcoded en el código (referidos: 2 amigos → 1 mes Pro;
 * interstitial: cada 3 acciones) por valores en la tabla `app_config` que se
 * pueden ajustar desde el dashboard de Supabase sin recompilar la app.
 *
 * Patrón de lectura (tri-nivel):
 *   1. Memoria (cachedConfig)             → sync, instantáneo (0 ms)
 *   2. AsyncStorage (cache local)          → 1-5 ms, sin red
 *   3. Supabase app_config                → requiere red
 *   4. Defaults codificados               → fallback si todo falla
 *
 * Por qué un módulo singleton y no un Contexto React:
 *   - `services/adsService.ts` lo necesita en su hot path (incrementAction
 *     se llama en CADA acción del usuario: crea factura, albarán, cliente).
 *     Una Context Provider agregaría re-renders innecesarios.
 *   - El hook `useRemoteConfig()` se suscribe vía pub/sub para que los
 *     componentes SÍ vean cambios en tiempo real sin sacrificar el hot path.
 *
 * Estrategia de refresco:
 *   - Al startup de la app (enRootLayout) → refreshRemoteConfig()
 *   - Cuando queramos re-leer remotamente → refreshRemoteConfig({ force: true })
 *   - Por defecto, si hay un fetch en vuelo concurrente, espera al resultado.
 *
 * Notas:
 *   - Las validaciones de clave→tipo son TOLERANTES: si la DB tiene basura,
 *     caen al default. Esto es crítico porque un admin podría borrar el valor
 *     accidentalmente.
 *   - Defaults en código coinciden con la migración SQL para que la app
 *     funcione incluso si la migración SQL no se ha aplicado todavía.
 */

const CACHE_STORAGE_KEY = 'app_config_cache_v2';

/** Claves reconocidas por este cliente. Añadir nuevas Keys aquí. */
const KNOWN_KEYS = [
  'referral_required_count',
  'interstitial_every_n_actions',
  'monthly_free_invoice_limit',
  'max_rewarded_ads_per_month',
] as const;
type KnownKey = (typeof KNOWN_KEYS)[number];

export interface AppConfig {
  referral_required_count: number;
  interstitial_every_n_actions: number;
  monthly_free_invoice_limit: number;
  max_rewarded_ads_per_month: number;
}

/** Defaults — deben coincidir con las migrations SQL 20260621xxx_add_*. */
const DEFAULTS: AppConfig = {
  referral_required_count: 2,
  interstitial_every_n_actions: 3,
  monthly_free_invoice_limit: 5,
  max_rewarded_ads_per_month: 1,
};

/**
 * Intervalos del polling de "live updates". Foreground más rápido (admin-tweaks
 * se propagan ~60 s sin reiniciar la app); background más espaciado para
 * ahorrar batería y datos cuando no se usa.
 */
const LIVE_UPDATE_INTERVAL_FOREGROUND_MS = 60 * 1000; // 1 min cuando la app está activa
const LIVE_UPDATE_INTERVAL_BACKGROUND_MS = 5 * 60 * 1000; // 5 min cuando está en background

// ─── Estado módulo (singleton) ───

let cachedConfig: AppConfig | null = null;
const listeners = new Set<(cfg: AppConfig) => void>();
let inflightRefresh: Promise<AppConfig> | null = null;
let liveUpdateTimer: ReturnType<typeof setInterval> | null = null;
let liveUpdateIntervalMs = LIVE_UPDATE_INTERVAL_BACKGROUND_MS;

/** Helper interno: combina defaults + partial override (filtra valores inválidos). */
function sanitize(partial: Partial<AppConfig>): AppConfig {
  const result: AppConfig = { ...DEFAULTS };
  if (typeof partial.referral_required_count === 'number' && partial.referral_required_count > 0) {
    result.referral_required_count = Math.floor(partial.referral_required_count);
  }
  if (typeof partial.interstitial_every_n_actions === 'number' && partial.interstitial_every_n_actions > 0) {
    result.interstitial_every_n_actions = Math.floor(partial.interstitial_every_n_actions);
  }
  if (typeof partial.monthly_free_invoice_limit === 'number' && partial.monthly_free_invoice_limit > 0) {
    result.monthly_free_invoice_limit = Math.floor(partial.monthly_free_invoice_limit);
  }
  if (typeof partial.max_rewarded_ads_per_month === 'number' && partial.max_rewarded_ads_per_month >= 0) {
    result.max_rewarded_ads_per_month = Math.floor(partial.max_rewarded_ads_per_month);
  }
  return result;
}

/** Parsea una fila de app_config → partial AppConfig (o null si inválida). */
function parseRow(key: string, rawValue: string): Partial<AppConfig> | null {
  const n = parseInt(rawValue, 10);
  if (isNaN(n) || n < 0) return null;
  const out: Partial<AppConfig> = {};
  if (key === 'referral_required_count') {
    if (n <= 0) return null;
    out.referral_required_count = n;
  } else if (key === 'interstitial_every_n_actions') {
    if (n <= 0) return null;
    out.interstitial_every_n_actions = n;
  } else if (key === 'monthly_free_invoice_limit') {
    // Permitimos 0+ (cualquier entero positivo)
    if (n < 0) return null;
    out.monthly_free_invoice_limit = n;
  } else if (key === 'max_rewarded_ads_per_month') {
    // Permitimos 0+ (útil para deshabilitar rewarded ads)
    if (n < 0) return null;
    out.max_rewarded_ads_per_month = n;
  } else {
    return null;
  }
  return out;
}

/**
 * Lee el cache desde AsyncStorage (no usa red).
 * Llamar al startup para tener config disponible offline inmediatamente.
 */
export async function loadRemoteConfigFromCache(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const stored = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      cachedConfig = sanitize(parsed);
      return cachedConfig;
    }
  } catch {
    // Silencioso — fallback a defaults
  }
  cachedConfig = { ...DEFAULTS };
  return cachedConfig;
}

/**
 * Fetch desde Supabase app_config → actualiza cache + notifica listeners.
 *
 * - Si ya hay un fetch en vuelo, retorna esa misma Promise (sin doble-fetch).
 * - Si falla red, intenta mantener el valor anterior en memoria (no lo borra).
 * - `force=true` salta el cache module-level y vuelve a leer de red + storage.
 *   Útil para botones "Refrescar" en UI de ajustes (futuro).
 */
export async function refreshRemoteConfig(opts?: { force?: boolean }): Promise<AppConfig> {
  const force = opts?.force ?? false;

  // Coalescir fetches concurrentes (sin await en el caller, evitamos doble-red).
  // Excepción: si force=true y ya hay uno en vuelo, queremos uno nuevo igual.
  if (!force && inflightRefresh) {
    return inflightRefresh;
  }

  const promise = (async (): Promise<AppConfig> => {
    const fallback = cachedConfig ?? (await loadRemoteConfigFromCache());

    const supabase = getSupabase();
    if (!supabase) {
      return fallback;
    }

    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [...KNOWN_KEYS]);

      if (error) {
        return fallback;
      }

      const partial: Partial<AppConfig> = {};
      for (const row of data || []) {
        const entry = parseRow(row.key, row.value);
        if (entry) {
          Object.assign(partial, entry);
        }
      }

      const next = sanitize(partial);
      const changed =
        !cachedConfig ||
        cachedConfig.referral_required_count !== next.referral_required_count ||
        cachedConfig.interstitial_every_n_actions !== next.interstitial_every_n_actions ||
        cachedConfig.monthly_free_invoice_limit !== next.monthly_free_invoice_limit ||
        cachedConfig.max_rewarded_ads_per_month !== next.max_rewarded_ads_per_month;

      cachedConfig = next;

      // Persistir a AsyncStorage (best-effort; ignorar errores de cuota)
      AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(next)).catch(() => {});

      if (changed) {
        listeners.forEach((cb) => {
          try { cb(next); } catch { /* listener errors no rompen el ciclo */ }
        });
      }

      return next;
    } catch {
      return fallback;
    }
  })();

  inflightRefresh = promise;
  try {
    return await promise;
  } finally {
    inflightRefresh = null;
  }
}

/**
 * Lectura síncrona del cache module-level.
 * CRÍTICO: usar en hot paths (adsService.incrementAction) — no bloquea I/O.
 * Si el cache aún no se inicializó (loadRemoteConfigFromCache nunca corrió),
 * retorna defaults.
 */
export function getRemoteConfigSync(): AppConfig {
  return cachedConfig ?? DEFAULTS;
}

/** Suscribe un listener a cambios. Retorna función para desuscribir. */
export function subscribeRemoteConfig(listener: (cfg: AppConfig) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Solo para tests / debugging. */
export function _resetRemoteConfigCache(): void {
  cachedConfig = null;
  listeners.clear();
}

// ─── Live updates (polling para hot-reload sin reiniciar) ───

/**
 * Arranca un `setInterval` que llama `refreshRemoteConfig()` periódicamente.
 * Idempotente: llamarla varias veces no crea timers duplicados.
 * Limpia el timer automáticamente al hacer `stopLiveUpdates()`.
 *
 * Por qué polling y no Realtime de Supabase:
 *   - Polling es simple, predecible y no consume cuota del plan gratuito.
 *   - 5 min de lag en background es totalmente aceptable para ajustes de admin
 *     (referidos: 2 amigos; ads: cada 3 acciones).
 *   - En foreground el intervalo baja a 60 s y se complementa con un refresh
 *     inmediato cada vez que la app vuelve a primer plano (ver _layout.tsx).
 *   - Cuando la app se cierra (componente se desmonta), el cleanup del
 *     useEffect llama a `stopLiveUpdates()`.
 *
 * Nota: el work pesado (fetch a Supabase + notify listeners) ocurre dentro de
 * `refreshRemoteConfig()`, que ya coalesce fetches concurrentes y notifica a
 * los subscribers de React. No hay riesgo de re-render storms.
 */
export function startLiveUpdates(): void {
  if (liveUpdateTimer) return; // ya está corriendo
  liveUpdateTimer = setInterval(() => {
    refreshRemoteConfig().catch(() => { /* refresh ya tiene fallback */ });
  }, liveUpdateIntervalMs);
}

/**
 * Detiene el polling. Llamar en cleanup del `useEffect` raíz.
 */
export function stopLiveUpdates(): void {
  if (liveUpdateTimer) {
    clearInterval(liveUpdateTimer);
    liveUpdateTimer = null;
  }
}

/**
 * Cambia la cadencia del polling y reinicia el timer con el nuevo intervalo.
 * Usado por `_layout.tsx` en función de `AppState` (foreground vs background).
 * Idempotente — llamar con el mismo valor reinicia el timer pero mantiene el
 * comportamiento; llamar con un valor distinto ajusta la cadencia.
 *
 * @param ms Nuevo intervalo en milisegundos. Valores no positivos se ignoran.
 */
export function setLiveUpdateInterval(ms: number): void {
  if (!Number.isFinite(ms) || ms <= 0) return;
  liveUpdateIntervalMs = ms;
  if (liveUpdateTimer) {
    clearInterval(liveUpdateTimer);
    liveUpdateTimer = setInterval(() => {
      refreshRemoteConfig().catch(() => {});
    }, liveUpdateIntervalMs);
  }
}

export const LIVE_UPDATE_INTERVALS = {
  foregroundMs: LIVE_UPDATE_INTERVAL_FOREGROUND_MS,
  backgroundMs: LIVE_UPDATE_INTERVAL_BACKGROUND_MS,
} as const;
