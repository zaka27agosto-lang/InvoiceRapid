import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { syncService, SyncResult } from '../services/syncService';
import { clearAllData } from '../app/db/database';

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
  // 🔒 Si el usuario cambió (logout + login con otra cuenta), limpiar BD local primero
  useEffect(() => {
    if (user && !hasInitialSync) {
      handleUserLogin();
    }
  }, [user, hasInitialSync]);

  // Resetear flags al cambiar de usuario
  useEffect(() => {
    setHasInitialSync(false);
    setInitialPullAttempted(false);
  }, [user?.id]);

  /**
   * Maneja el login de un usuario:
   * - Si es el mismo usuario que la última sesión, solo hace pull
   * - Si es un usuario DIFERENTE, limpia la BD local antes del pull
   *   para evitar fugas de datos entre cuentas
   * - Si es primer login (sin last_user_id), guarda el ID y hace pull
   */
  async function handleUserLogin() {
    if (!user) return;
    try {
      const lastUserId = await AsyncStorage.getItem('last_user_id');
      if (lastUserId && lastUserId !== user.id) {
        // ⚠️ Usuario diferente — limpiar BD local para evitar fuga de datos
        // Solo guardamos last_user_id DESPUÉS de limpiar con éxito,
        // así si falla la limpieza, se reintentará en el próximo login
        clearAllData();
        await AsyncStorage.multiRemove([
          'sync_queue',
          'is_premium',
          'monthly_invoice_counter',
        ]).catch(() => {});
      }
      // Guardar last_user_id (primer login o mismo usuario)
      await AsyncStorage.setItem('last_user_id', user.id);
    } catch {
      // Si getItem o setItem fallan, continuamos sin bloquear el login
    }
    await pullCloudData();
  }

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
      } catch {
        downloadError = true;
      }

      setSyncStatus({
        success: !downloadError,
        synced: totalSynced,
        errors: downloadError ? 1 : 0,
        message: downloadError ? 'Error al descargar datos de la nube' : undefined,
      });
      setLastSync(new Date());
    } catch {
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
    } catch {
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
