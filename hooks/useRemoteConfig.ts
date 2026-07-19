import { useEffect, useState, useCallback } from 'react';
import {
  AppConfig,
  loadRemoteConfigFromCache,
  refreshRemoteConfig,
  subscribeRemoteConfig,
  getRemoteConfigSync,
} from '../utils/remoteConfig';

/**
 * Hook React para acceder a configuración remota de forma reactiva.
 *
 * Uso:
 *   const { referral_required_count } = useRemoteConfig();
 *   const threshold = referral_required_count ?? 2;
 *
 * Comportamiento:
 *   - En el primer render devuelve los defaults (si el cache aún no se
 *     inicializó) o el valor cacheado si ya hay datos.
 *   - Al montar, dispara `loadRemoteConfigFromCache()` para sincronizar el
 *     estado del hook con el estado del módulo (puede ser diferente si
 *     otra parte de la app refrescó la config).
 *   - Se suscribe a cambios → si `refreshRemoteConfig()` actualiza valores,
 *     el hook re-renderiza con los nuevos.
 *
 * NOTA: Este hook NO dispara un fetch de red al montar. Asume que
 * `app/_layout.tsx` llamó `refreshRemoteConfig()` en startup. Si quieres
 * forzar un refresh desde un componente, llama `refresh()`.
 */
export function useRemoteConfig(): AppConfig & { refresh: () => Promise<void> } {
  const [config, setConfig] = useState<AppConfig>(() => getRemoteConfigSync());

  // Sincronizar estado del hook con el del módulo + suscribirse a cambios
  useEffect(() => {
    let cancelled = false;

    // 1. Asegurar que el cache módulo está cargado (offline-first).
    loadRemoteConfigFromCache().then((loaded) => {
      if (!cancelled) setConfig(loaded);
    });

    // 2. Suscribirse a refrescos remotos.
    const unsubscribe = subscribeRemoteConfig((next) => {
      if (!cancelled) setConfig(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    await refreshRemoteConfig({ force: true });
    setConfig(getRemoteConfigSync());
  }, []);

  return { ...config, refresh };
}
