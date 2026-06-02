import NetInfo from '@react-native-community/netinfo';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { syncService, SyncResult } from '../services/syncService';

import { useAuth } from './AuthContext';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  syncStatus: SyncResult | null;
  manualSync: () => Promise<SyncResult>;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncResult | null>(null);
  const [hasInitialSync, setHasInitialSync] = useState(false);
  const [initialPullAttempted, setInitialPullAttempted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userRef = useRef(user);
  const isSyncingRef = useRef(false);

  // Mantener referencias actualizadas para evitar closures obsoletos
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  // Pull cloud data cuando el usuario inicia sesión
  useEffect(() => {
    if (user && !hasInitialSync) {
      pullCloudData();
    }
  }, [user, hasInitialSync]);

  // Resetear flags al cambiar de usuario
  useEffect(() => {
    setHasInitialSync(false);
    setInitialPullAttempted(false);
  }, [user?.id]);

  // Auto-sync periódico cada 60 segundos mientras haya sesión y conexión
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (user && isOnline) {
      intervalRef.current = setInterval(() => {
        if (userRef.current && !isSyncingRef.current) {
          autoSync();
        }
      }, 60000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, isOnline]);

  // Monitorizar cambios de conexión de red
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? false;
      setIsOnline(connected);

      if (connected && user) {
        // Si el pull inicial falló por falta de conexión, reintentarlo ahora
        if (initialPullAttempted && !hasInitialSync) {
          console.log('🔁 Reintentando pull inicial tras recuperar conexión...');
          pullCloudData();
        } else {
          autoSync();
        }
      }
    });

    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, [user, initialPullAttempted, hasInitialSync]);

  async function pullCloudData(): Promise<void> {
    if (!user) return;

    const online = await syncService.isOnline();
    if (!online) {
      console.log('📥 Pull inicial pendiente (sin conexión) — se reintentará al conectar');
      setInitialPullAttempted(true);
      return;
    }

    setIsSyncing(true);
    try {
      // 🔄 DESCARGAR datos de la nube fusionándolos con los locales.
      // NO limpiamos la BD local antes de descargar: si la descarga falla
      // o la nube está vacía (primer login), perderíamos los datos
      // creados localmente que aún no se sincronizaron.
      // Los métodos pull*Only ya hacen upsert por ID, así que los
      // registros existentes se actualizan y los nuevos se insertan.
      console.log('📥 Descargando datos desde la nube...');
      let totalSynced = 0;
      let downloadError = false;

      try {
        const [facturasResult, clientesResult, productosResult, albaranesResult] = await Promise.all([
          syncService.pullInvoicesOnly(user.id),
          syncService.pullClientsOnly(user.id),
          syncService.pullProductsOnly(user.id),
          syncService.pullAlbaranesOnly(user.id),
        ]);
        totalSynced =
          (facturasResult.synced || 0) +
          (clientesResult.synced || 0) +
          (productosResult.synced || 0) +
          (albaranesResult.synced || 0);
        console.log(`✅ ${totalSynced} registros descargados de la nube`);
      } catch (e) {
        console.error('Error descargando datos de la nube:', e);
        downloadError = true;
      }

      setSyncStatus({
        success: !downloadError,
        synced: totalSynced,
        errors: downloadError ? 1 : 0,
        message: downloadError ? 'Error al descargar datos de la nube' : undefined,
      });
      setLastSync(new Date());
      console.log('✅ Pull inicial completado');
    } catch (error) {
      console.error('Error en pull inicial:', error);
    } finally {
      setIsSyncing(false);
      setHasInitialSync(true);
    }
  }

  async function autoSync(): Promise<void> {
    if (!user || isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const result = await syncService.syncAll(user.id);
      setSyncStatus(result);
      setLastSync(new Date());

      await syncService.processQueue(user.id);
    } catch (error) {
      console.error('Auto-sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncNow(): Promise<void> {
    await autoSync();
  }

  async function manualSync(): Promise<SyncResult> {
    if (!user) {
      return { success: false, synced: 0, errors: 0, message: 'No hay usuario autenticado' };
    }
    if (!isOnline) {
      return { success: false, synced: 0, errors: 0, message: 'Sin conexión a internet' };
    }

    setIsSyncing(true);
    try {
      const result = await syncService.syncAll(user.id);
      setSyncStatus(result);
      setLastSync(new Date());
      await syncService.processQueue(user.id);
      return result;
    } catch (error) {
      const errorResult: SyncResult = {
        success: false,
        synced: 0,
        errors: 0,
        message: 'Error al sincronizar',
      };
      setSyncStatus(errorResult);
      return errorResult;
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <SyncContext.Provider value={{ isOnline, isSyncing, lastSync, syncStatus, manualSync, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within SyncProvider');
  }
  return context;
}
