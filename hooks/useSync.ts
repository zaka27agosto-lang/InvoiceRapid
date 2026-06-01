import { useSyncContext } from '../contexts/SyncContext';

/**
 * Hook de sincronización que lee del SyncContext global.
 * El SyncProvider se encarga de la sincronización automática en segundo plano
 * (pullCloudData al iniciar sesión, auto-sync cada 60s, sync al recuperar conexión).
 */
export function useSync() {
  const { isOnline, isSyncing, lastSync, syncStatus, manualSync, syncNow } = useSyncContext();

  return {
    isOnline,
    isSyncing,
    lastSync,
    syncStatus,
    manualSync,
    autoSync: syncNow,
  };
}
