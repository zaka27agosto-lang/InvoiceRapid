import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { syncService, SyncResult } from '../services/syncService';
import NetInfo from '@react-native-community/netinfo';

export function useSync() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncResult | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
      
      // Auto-sync when coming back online
      if (state.isConnected && user) {
        autoSync();
      }
    });

    // Check initial connection
    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, [user]);

  async function autoSync(): Promise<void> {
    if (!user || isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const result = await syncService.syncAll(user.id);
      setSyncStatus(result);
      setLastSync(new Date());
      
      // Process any queued operations
      await syncService.processQueue(user.id);
    } catch (error) {
      console.error('Auto-sync error:', error);
    } finally {
      setIsSyncing(false);
    }
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
      
      // Process queue
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

  async function syncInvoices(): Promise<SyncResult> {
    if (!user) return { success: false, synced: 0, errors: 0 };
    
    setIsSyncing(true);
    try {
      const result = await syncService.syncInvoices(user.id);
      setSyncStatus(result);
      return result;
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncClients(): Promise<SyncResult> {
    if (!user) return { success: false, synced: 0, errors: 0 };
    
    setIsSyncing(true);
    try {
      const result = await syncService.syncClients(user.id);
      setSyncStatus(result);
      return result;
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncProducts(): Promise<SyncResult> {
    if (!user) return { success: false, synced: 0, errors: 0 };
    
    setIsSyncing(true);
    try {
      const result = await syncService.syncProducts(user.id);
      setSyncStatus(result);
      return result;
    } finally {
      setIsSyncing(false);
    }
  }

  return {
    isOnline,
    isSyncing,
    lastSync,
    syncStatus,
    manualSync,
    autoSync,
    syncInvoices,
    syncClients,
    syncProducts,
  };
}
