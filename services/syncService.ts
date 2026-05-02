import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';

export interface SyncResult {
  success: boolean;
  synced: number;
  errors: number;
  message?: string;
}

export class SyncService {
  private static instance: SyncService;
  private syncQueue: any[] = [];
  private isSyncing = false;

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  async syncInvoices(userId: string): Promise<SyncResult> {
    try {
      if (!supabase) {
        return { success: false, synced: 0, errors: 0, message: 'Supabase no está configurado' };
      }
      if (!(await this.isOnline())) {
        return { success: false, synced: 0, errors: 0, message: 'Sin conexión' };
      }

      // Get local invoices from SQLite (this would be imported from db/facturas)
      const localInvoices = await this.getLocalInvoices();
      
      let synced = 0;
      let errors = 0;

      for (const invoice of localInvoices) {
        try {
          const { data, error } = await supabase
            .from('facturas')
            .upsert({
              id: invoice.id,
              user_id: userId,
              numero: invoice.numero,
              cliente_id: invoice.cliente_id,
              cliente_nombre: invoice.cliente_nombre,
              subtotal: invoice.subtotal,
              descuento: invoice.descuento,
              iva_porcentaje: invoice.iva_porcentaje,
              iva_importe: invoice.iva_importe,
              irpf_porcentaje: invoice.irpf_porcentaje,
              irpf_importe: invoice.irpf_importe,
              total: invoice.total,
              estado: invoice.estado,
              fecha: invoice.fecha,
              fecha_vencimiento: invoice.fecha_vencimiento,
              notas: invoice.notas,
              metodo_pago: invoice.metodo_pago,
              sync_status: 'synced',
              updated_at: new Date().toISOString(),
            })
            .select();

          if (error) throw error;
          synced++;
        } catch (e) {
          console.error('Error syncing invoice:', e);
          errors++;
        }
      }

      // Sync from cloud to local
      const { data: cloudInvoices } = await supabase
        .from('facturas')
        .select('*')
        .eq('user_id', userId);

      if (cloudInvoices) {
        await this.saveLocalInvoices(cloudInvoices);
      }

      return { success: true, synced, errors };
    } catch (error) {
      console.error('Sync invoices error:', error);
      return { success: false, synced: 0, errors: 0, message: 'Error al sincronizar facturas' };
    }
  }

  async syncClients(userId: string): Promise<SyncResult> {
    try {
      if (!supabase) {
        return { success: false, synced: 0, errors: 0, message: 'Supabase no está configurado' };
      }
      if (!(await this.isOnline())) {
        return { success: false, synced: 0, errors: 0, message: 'Sin conexión' };
      }

      const localClients = await this.getLocalClients();
      let synced = 0;
      let errors = 0;

      for (const client of localClients) {
        try {
          const { error } = await supabase
            .from('clientes')
            .upsert({
              id: client.id,
              user_id: userId,
              nombre: client.nombre,
              email: client.email,
              telefono: client.telefono,
              movil: client.movil,
              pais: client.pais,
              calle: client.calle,
              piso: client.piso,
              ciudad: client.ciudad,
              cp: client.cp,
              provincia: client.provincia,
              nif: client.nif,
              persona_contacto: client.persona_contacto,
              direccion: client.direccion,
              sync_status: 'synced',
              updated_at: new Date().toISOString(),
            });

          if (error) throw error;
          synced++;
        } catch (e) {
          console.error('Error syncing client:', e);
          errors++;
        }
      }

      // Sync from cloud to local
      const { data: cloudClients } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', userId);

      if (cloudClients) {
        await this.saveLocalClients(cloudClients);
      }

      return { success: true, synced, errors };
    } catch (error) {
      console.error('Sync clients error:', error);
      return { success: false, synced: 0, errors: 0, message: 'Error al sincronizar clientes' };
    }
  }

  async syncProducts(userId: string): Promise<SyncResult> {
    try {
      if (!supabase) {
        return { success: false, synced: 0, errors: 0, message: 'Supabase no está configurado' };
      }
      if (!(await this.isOnline())) {
        return { success: false, synced: 0, errors: 0, message: 'Sin conexión' };
      }

      const localProducts = await this.getLocalProducts();
      let synced = 0;
      let errors = 0;

      for (const product of localProducts) {
        try {
          const { error } = await supabase
            .from('productos')
            .upsert({
              id: product.id,
              user_id: userId,
              descripcion: product.descripcion,
              precio: product.precio,
              unidad: product.unidad,
              sync_status: 'synced',
              updated_at: new Date().toISOString(),
            });

          if (error) throw error;
          synced++;
        } catch (e) {
          console.error('Error syncing product:', e);
          errors++;
        }
      }

      // Sync from cloud to local
      const { data: cloudProducts } = await supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId);

      if (cloudProducts) {
        await this.saveLocalProducts(cloudProducts);
      }

      return { success: true, synced, errors };
    } catch (error) {
      console.error('Sync products error:', error);
      return { success: false, synced: 0, errors: 0, message: 'Error al sincronizar productos' };
    }
  }

  async syncAll(userId: string): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, synced: 0, errors: 0, message: 'Sincronización en progreso' };
    }

    this.isSyncing = true;
    let totalSynced = 0;
    let totalErrors = 0;

    try {
      const [invoices, clients, products] = await Promise.all([
        this.syncInvoices(userId),
        this.syncClients(userId),
        this.syncProducts(userId),
      ]);

      totalSynced = invoices.synced + clients.synced + products.synced;
      totalErrors = invoices.errors + clients.errors + products.errors;

      return {
        success: true,
        synced: totalSynced,
        errors: totalErrors,
      };
    } catch (error) {
      return { success: false, synced: totalSynced, errors: totalErrors };
    } finally {
      this.isSyncing = false;
    }
  }

  // Local storage helpers (these would integrate with the existing SQLite DB)
  private async getLocalInvoices(): Promise<any[]> {
    // Import and use getFacturas() from db/facturas
    try {
      const { getFacturas } = await import('../app/db/facturas');
      return getFacturas() as any[];
    } catch {
      return [];
    }
  }

  private async saveLocalInvoices(invoices: any[]): Promise<void> {
    // This would update the local SQLite DB
    console.log('Saving invoices to local DB:', invoices.length);
  }

  private async getLocalClients(): Promise<any[]> {
    try {
      const { getClientes } = await import('../app/db/clientes');
      return getClientes() as any[];
    } catch {
      return [];
    }
  }

  private async saveLocalClients(clients: any[]): Promise<void> {
    console.log('Saving clients to local DB:', clients.length);
  }

  private async getLocalProducts(): Promise<any[]> {
    try {
      const { getProductos } = await import('../app/db/productos');
      return getProductos() as any[];
    } catch {
      return [];
    }
  }

  private async saveLocalProducts(products: any[]): Promise<void> {
    console.log('Saving products to local DB:', products.length);
  }

  async addToQueue(operation: any): Promise<void> {
    this.syncQueue.push(operation);
    await AsyncStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
  }

  async processQueue(userId: string): Promise<void> {
    if (!(await this.isOnline()) || this.syncQueue.length === 0) return;

    const queue = [...this.syncQueue];
    this.syncQueue = [];
    await AsyncStorage.setItem('sync_queue', JSON.stringify([]));

    for (const operation of queue) {
      try {
        await this.executeOperation(operation, userId);
      } catch (error) {
        console.error('Error processing queue operation:', error);
        this.syncQueue.push(operation);
      }
    }
  }

  private async executeOperation(operation: any, userId: string): Promise<void> {
    switch (operation.type) {
      case 'invoice':
        await this.syncInvoices(userId);
        break;
      case 'client':
        await this.syncClients(userId);
        break;
      case 'product':
        await this.syncProducts(userId);
        break;
    }
  }
}

export const syncService = SyncService.getInstance();
