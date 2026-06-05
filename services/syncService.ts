import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import type { Factura, FacturaItem, Cliente, Albaran, AlbaranItem, Producto } from '../app/db/types';

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
      // Restaurar cola de sincronización pendiente desde AsyncStorage
      // (fire-and-forget: se ejecuta en background, no bloquea la creación de la instancia)
      SyncService.instance.restoreQueue().catch(() => {});
    }
    return SyncService.instance;
  }

  /** Restaura la cola de sincronización desde AsyncStorage al iniciar la app */
  private async restoreQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('sync_queue');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.syncQueue = parsed;
        }
      }
    } catch {
      // Silencioso: si falla, empezar con cola vacía
    }
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

      // Get local invoices from SQLite
      const localInvoices = await this.getLocalInvoices();
      
      let synced = 0;
      let errors = 0;

      for (const invoice of localInvoices) {
        try {
          const { error } = await supabase
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

          // Actualizar sync_status local a 'synced' tras subir con éxito
          try {
            const db = (await import('../app/db/database')).default;
            if (db) {
              db.runSync('UPDATE facturas SET sync_status = ? WHERE id = ?', ['synced', invoice.id]);
            }
          } catch (e) {
          }

          // ── Sincronizar factura_items (líneas de factura) ──
          try {
            const items = await this.getLocalInvoiceItems(invoice.id);
            // Delete-and-reinsert: borramos items previos en la nube y
            // re-insertamos los actuales para evitar tener que hacer diff.
            const { error: delErr } = await supabase
              .from('factura_items')
              .delete()
              .eq('factura_id', invoice.id)
              .eq('user_id', userId);
            if (delErr) {
            } else if (items.length > 0) {
              // Insertar items actuales
              for (const item of items) {
                const { error: insErr } = await supabase
                  .from('factura_items')
                  .upsert({
                    id: item.id,
                    factura_id: item.factura_id,
                    user_id: userId,
                    descripcion: item.descripcion,
                    cantidad: item.cantidad,
                    unidad: item.unidad,
                    precio_unitario: item.precio_unitario,
                    descuento: item.descuento,
                    subtotal: item.subtotal,
                    sync_status: 'synced',
                    updated_at: new Date().toISOString(),
                  });
                if (insErr) {
                  errors++;
                } else {
                  synced++;
                }
              }
            }
          } catch (e) {
            errors++;
          }
        } catch (e) {
          errors++;
        }
      }

      // Eliminar de la nube facturas borradas localmente
      await this.deleteOrphanedCloudRecords('facturas', userId, localInvoices);

      return { success: true, synced, errors };
    } catch (error) {
      return { success: false, synced: 0, errors: 0, message: 'Error al sincronizar facturas' };
    }
  }

  async syncAlbaranes(userId: string): Promise<SyncResult> {
    try {
      if (!supabase) {
        return { success: false, synced: 0, errors: 0, message: 'Supabase no está configurado' };
      }
      if (!(await this.isOnline())) {
        return { success: false, synced: 0, errors: 0, message: 'Sin conexión' };
      }

      const localAlbaranes = await this.getLocalAlbaranes();
      let synced = 0;
      let errors = 0;

      for (const albaran of localAlbaranes) {
        try {
          const { error } = await supabase
            .from('albaranes')
            .upsert({
              id: albaran.id,
              user_id: userId,
              numero: albaran.numero,
              cliente_id: albaran.cliente_id,
              cliente_nombre: albaran.cliente_nombre,
              subtotal: albaran.subtotal,
              descuento: albaran.descuento,
              iva_porcentaje: albaran.iva_porcentaje,
              iva_importe: albaran.iva_importe,
              irpf_porcentaje: albaran.irpf_porcentaje,
              irpf_importe: albaran.irpf_importe,
              total: albaran.total,
              estado: albaran.estado,
              fecha: albaran.fecha,
              fecha_entrega: albaran.fecha_entrega,
              notas: albaran.notas,
              firma_data: albaran.firma_data,
              direccion_entrega: albaran.direccion_entrega ?? '',
              sync_status: 'synced',
              updated_at: new Date().toISOString(),
            })
            .select();

          if (error) throw error;
          synced++;

          // Actualizar sync_status local a 'synced' tras subir con éxito
          try {
            const db = (await import('../app/db/database')).default;
            if (db) {
              db.runSync('UPDATE albaranes SET sync_status = ? WHERE id = ?', ['synced', albaran.id]);
            }
          } catch (e) {
          }

          // ── Sincronizar albaran_items ──
          try {
            const items = await this.getLocalAlbaranItems(albaran.id);
            const { error: delErr } = await supabase
              .from('albaran_items')
              .delete()
              .eq('albaran_id', albaran.id)
              .eq('user_id', userId);
            if (delErr) {
            } else if (items.length > 0) {
              for (const item of items) {
                const { error: insErr } = await supabase
                  .from('albaran_items')
                  .upsert({
                    id: item.id,
                    albaran_id: item.albaran_id,
                    user_id: userId,
                    descripcion: item.descripcion,
                    cantidad: item.cantidad,
                    unidad: item.unidad,
                    precio_unitario: item.precio_unitario,
                    descuento: item.descuento,
                    subtotal: item.subtotal,
                    sync_status: 'synced',
                    updated_at: new Date().toISOString(),
                  });
                if (insErr) {
                  errors++;
                } else {
                  synced++;
                }
              }
            }
          } catch (e) {
            errors++;
          }
        } catch (e) {
          errors++;
        }
      }

      // Eliminar de la nube albaranes borrados localmente
      await this.deleteOrphanedCloudRecords('albaranes', userId, localAlbaranes);

      return { success: true, synced, errors };
    } catch (error) {
      return { success: false, synced: 0, errors: 0, message: 'Error al sincronizar albaranes' };
    }
  }

  /** Pull-only: descarga datos de la nube SIN subir nada local (usado al iniciar sesión) */
  async pullInvoicesOnly(userId: string): Promise<SyncResult> {
    try {
      if (!supabase) {
        return { success: false, synced: 0, errors: 0, message: 'Supabase no está configurado' };
      }
      if (!(await this.isOnline())) {
        return { success: false, synced: 0, errors: 0, message: 'Sin conexión' };
      }

      const { data: cloudInvoices } = await supabase
        .from('facturas')
        .select('*')
        .eq('user_id', userId);

      if (cloudInvoices && cloudInvoices.length > 0) {
        await this.saveLocalInvoices(cloudInvoices);
      }

      // ── Descargar factura_items de la nube ──
      const { data: cloudItems } = await supabase
        .from('factura_items')
        .select('*')
        .eq('user_id', userId);

      if (cloudItems && cloudItems.length > 0) {
        await this.saveLocalInvoiceItems(cloudItems);
      }

      const totalSynced = (cloudInvoices?.length || 0) + (cloudItems?.length || 0);
      return { success: true, synced: totalSynced, errors: 0 };
    } catch (error) {
      return { success: false, synced: 0, errors: 0, message: 'Error al descargar facturas' };
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
          errors++;
        }
      }

      // Eliminar de la nube clientes borrados localmente
      await this.deleteOrphanedCloudRecords('clientes', userId, localClients);

      // 💥 NO descargamos datos de la nube (upload-only)

      return { success: true, synced, errors };
    } catch (error) {
      return { success: false, synced: 0, errors: 0, message: 'Error al sincronizar clientes' };
    }
  }

  /** Pull-only: descarga clientes de la nube SIN subir nada local */
  async pullClientsOnly(userId: string): Promise<SyncResult> {
    try {
      if (!supabase) {
        return { success: false, synced: 0, errors: 0, message: 'Supabase no está configurado' };
      }
      if (!(await this.isOnline())) {
        return { success: false, synced: 0, errors: 0, message: 'Sin conexión' };
      }

      const { data: cloudClients } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', userId);

      if (cloudClients && cloudClients.length > 0) {
        await this.saveLocalClients(cloudClients);
      }

      return { success: true, synced: cloudClients?.length || 0, errors: 0 };
    } catch (error) {
      return { success: false, synced: 0, errors: 0, message: 'Error al descargar clientes' };
    }
  }

  /** Pull-only: descarga albaranes de la nube SIN subir nada local */
  async pullAlbaranesOnly(userId: string): Promise<SyncResult> {
    try {
      if (!supabase) {
        return { success: false, synced: 0, errors: 0, message: 'Supabase no está configurado' };
      }
      if (!(await this.isOnline())) {
        return { success: false, synced: 0, errors: 0, message: 'Sin conexión' };
      }

      const { data: cloudAlbaranes } = await supabase
        .from('albaranes')
        .select('*')
        .eq('user_id', userId);

      if (cloudAlbaranes && cloudAlbaranes.length > 0) {
        await this.saveLocalAlbaranes(cloudAlbaranes);
      }

      const { data: cloudItems } = await supabase
        .from('albaran_items')
        .select('*')
        .eq('user_id', userId);

      if (cloudItems && cloudItems.length > 0) {
        await this.saveLocalAlbaranItems(cloudItems);
      }

      const totalSynced = (cloudAlbaranes?.length || 0) + (cloudItems?.length || 0);
      return { success: true, synced: totalSynced, errors: 0 };
    } catch (error) {
      return { success: false, synced: 0, errors: 0, message: 'Error al descargar albaranes' };
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
          errors++;
        }
      }

      // Eliminar de la nube productos borrados localmente
      await this.deleteOrphanedCloudRecords('productos', userId, localProducts);

      // 💥 NO descargamos datos de la nube (upload-only)

      return { success: true, synced, errors };
    } catch (error) {
      return { success: false, synced: 0, errors: 0, message: 'Error al sincronizar productos' };
    }
  }

  /** Pull-only: descarga productos de la nube SIN subir nada local */
  async pullProductsOnly(userId: string): Promise<SyncResult> {
    try {
      if (!supabase) {
        return { success: false, synced: 0, errors: 0, message: 'Supabase no está configurado' };
      }
      if (!(await this.isOnline())) {
        return { success: false, synced: 0, errors: 0, message: 'Sin conexión' };
      }

      const { data: cloudProducts } = await supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId);

      if (cloudProducts && cloudProducts.length > 0) {
        await this.saveLocalProducts(cloudProducts);
      }

      return { success: true, synced: cloudProducts?.length || 0, errors: 0 };
    } catch (error) {
      return { success: false, synced: 0, errors: 0, message: 'Error al descargar productos' };
    }
  }

  /** Elimina de la nube los registros que ya no existen localmente */
  private async deleteOrphanedCloudRecords(
    table: 'facturas' | 'clientes' | 'productos' | 'albaranes',
    userId: string,
    localRecords: any[]
  ): Promise<void> {
    if (!supabase) return;
    // Si no hay registros locales, podría deberse a un error de lectura.
    // NO borrar nada en ese caso para evitar pérdida de datos.
    if (!localRecords || localRecords.length === 0) return;
    
    try {
      // Obtener todos los IDs de la nube para este usuario
      const { data: cloudRecords } = await supabase
        .from(table)
        .select('id')
        .eq('user_id', userId);

      if (!cloudRecords || cloudRecords.length === 0) return;

      const localIds = new Set(localRecords.map((r: any) => r.id));
      const orphanIds = cloudRecords
        .filter((r: any) => !localIds.has(r.id))
        .map((r: any) => r.id);

      if (orphanIds.length === 0) return;

      
      // Eliminar en lotes para evitar URLs demasiado largas
      const BATCH_SIZE = 50;
      for (let i = 0; i < orphanIds.length; i += BATCH_SIZE) {
        const batch = orphanIds.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from(table)
          .delete()
          .in('id', batch)
          .eq('user_id', userId);
        
        if (error) {
        } else {
        }
      }
    } catch (e) {
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
      const [invoices, albaranes, clients, products] = await Promise.all([
        this.syncInvoices(userId),
        this.syncAlbaranes(userId),
        this.syncClients(userId),
        this.syncProducts(userId),
      ]);

      totalSynced = invoices.synced + albaranes.synced + clients.synced + products.synced;
      totalErrors = invoices.errors + albaranes.errors + clients.errors + products.errors;

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
      return getFacturas() as Factura[];
    } catch {
      return [];
    }
  }

  private async saveLocalInvoices(invoices: any[]): Promise<void> {
    try {
      const db = (await import('../app/db/database')).default;
      if (!db || !invoices.length) return;

      for (const invoice of invoices) {
        const existing = db.getFirstSync('SELECT id FROM facturas WHERE id = ?', [invoice.id]);
        if (existing) {
          db.runSync(
            `UPDATE facturas SET numero=?, cliente_id=?, cliente_nombre=?, subtotal=?, descuento=?,
             iva_porcentaje=?, iva_importe=?, irpf_porcentaje=?, irpf_importe=?, total=?,
             estado=?, fecha=?, fecha_vencimiento=?, notas=?, metodo_pago=?, sync_status=?
             WHERE id=?`,
            [invoice.numero, invoice.cliente_id, invoice.cliente_nombre, invoice.subtotal,
             invoice.descuento, invoice.iva_porcentaje, invoice.iva_importe,
             invoice.irpf_porcentaje, invoice.irpf_importe, invoice.total,
             invoice.estado, invoice.fecha, invoice.fecha_vencimiento,
             invoice.notas, invoice.metodo_pago, invoice.sync_status || 'pending', invoice.id]
          );
        } else {
          db.runSync(
            `INSERT INTO facturas (id, numero, cliente_id, cliente_nombre, subtotal, descuento,
             iva_porcentaje, iva_importe, irpf_porcentaje, irpf_importe, total,
             estado, fecha, fecha_vencimiento, notas, metodo_pago, sync_status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [invoice.id, invoice.numero, invoice.cliente_id, invoice.cliente_nombre, invoice.subtotal,
             invoice.descuento, invoice.iva_porcentaje, invoice.iva_importe,
             invoice.irpf_porcentaje, invoice.irpf_importe, invoice.total,
             invoice.estado, invoice.fecha, invoice.fecha_vencimiento,
             invoice.notas, invoice.metodo_pago, invoice.sync_status || 'pending']
          );
        }
      }
    } catch (e) {
    }
  }

  private async getLocalClients(): Promise<any[]> {
    try {
      const { getClientes } = await import('../app/db/clientes');
      return getClientes() as Cliente[];
    } catch {
      return [];
    }
  }

  private async saveLocalClients(clients: any[]): Promise<void> {
    try {
      const db = (await import('../app/db/database')).default;
      if (!db || !clients.length) return;

      for (const client of clients) {
        const existing = db.getFirstSync('SELECT id FROM clientes WHERE id = ?', [client.id]);
        if (existing) {
          db.runSync(
            `UPDATE clientes SET nombre=?, email=?, telefono=?, movil=?, pais=?,
             calle=?, piso=?, ciudad=?, cp=?, provincia=?, nif=?, persona_contacto=?, direccion=?
             WHERE id=?`,
            [client.nombre, client.email, client.telefono, client.movil, client.pais,
             client.calle, client.piso, client.ciudad, client.cp, client.provincia,
             client.nif, client.persona_contacto, client.direccion, client.id]
          );
        } else {
          db.runSync(
            `INSERT INTO clientes (id, nombre, email, telefono, movil, pais, calle, piso, ciudad, cp, provincia, nif, persona_contacto, direccion)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [client.id, client.nombre, client.email, client.telefono, client.movil, client.pais,
             client.calle, client.piso, client.ciudad, client.cp, client.provincia,
             client.nif, client.persona_contacto, client.direccion]
          );
        }
      }
    } catch (e) {
    }
  }

  private async getLocalProducts(): Promise<any[]> {
    try {
      const { getProductos } = await import('../app/db/productos');
      return getProductos() as Producto[];
    } catch {
      return [];
    }
  }

  private async saveLocalProducts(products: any[]): Promise<void> {
    try {
      const db = (await import('../app/db/database')).default;
      if (!db || !products.length) return;

      for (const product of products) {
        const existing = db.getFirstSync('SELECT id FROM productos WHERE id = ?', [product.id]);
        if (existing) {
          db.runSync(
            `UPDATE productos SET descripcion=?, precio=?, unidad=? WHERE id=?`,
            [product.descripcion, product.precio, product.unidad, product.id]
          );
        } else {
          db.runSync(
            `INSERT INTO productos (id, descripcion, precio, unidad) VALUES (?,?,?,?)`,
            [product.id, product.descripcion, product.precio, product.unidad]
          );
        }
      }
    } catch (e) {
    }
  }

  /** Obtiene los items de una factura desde SQLite local */
  private async getLocalInvoiceItems(facturaId: number): Promise<any[]> {
    try {
      const { getFacturaItems } = await import('../app/db/facturas');
      return getFacturaItems(facturaId) as FacturaItem[];
    } catch {
      return [];
    }
  }

  /** Guarda items descargados de la nube en SQLite local (en transacción) */
  private async saveLocalInvoiceItems(items: any[]): Promise<void> {
    try {
      const db = (await import('../app/db/database')).default;
      if (!db || !items.length) return;

      // Envolver en transacción para evitar pérdida de datos si la app crashea
      db.execSync('BEGIN TRANSACTION;');
      try {
        for (const item of items) {
          // Borrar item existente y re-insertar (simple, evita diff)
          db.runSync('DELETE FROM factura_items WHERE id = ?', [item.id]);
          db.runSync(
            `INSERT INTO factura_items (id, factura_id, descripcion, cantidad, unidad, precio_unitario, descuento, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.factura_id, item.descripcion, item.cantidad,
             item.unidad, item.precio_unitario, item.descuento, item.subtotal]
          );
        }
        db.execSync('COMMIT;');
      } catch (innerError) {
        db.execSync('ROLLBACK;');
        throw innerError;
      }
    } catch (e) {
    }
  }

  // ──────── Albaranes local helpers ────────
  private async getLocalAlbaranes(): Promise<any[]> {
    try {
      const { getAlbaranes } = await import('../app/db/albaranes');
      return getAlbaranes() as Albaran[];
    } catch {
      return [];
    }
  }

  private async saveLocalAlbaranes(albaranes: any[]): Promise<void> {
    try {
      const db = (await import('../app/db/database')).default;
      if (!db || !albaranes.length) return;

      for (const albaran of albaranes) {
        const existing = db.getFirstSync('SELECT id FROM albaranes WHERE id = ?', [albaran.id]);
        if (existing) {
          db.runSync(
            `UPDATE albaranes SET numero=?, cliente_id=?, cliente_nombre=?, subtotal=?, descuento=?,
             iva_porcentaje=?, iva_importe=?, irpf_porcentaje=?, irpf_importe=?, total=?,
             estado=?, fecha=?, fecha_entrega=?, notas=?, firma_data=?, direccion_entrega=?, sync_status=?
             WHERE id=?`,
            [albaran.numero, albaran.cliente_id, albaran.cliente_nombre, albaran.subtotal,
             albaran.descuento, albaran.iva_porcentaje, albaran.iva_importe,
             albaran.irpf_porcentaje, albaran.irpf_importe, albaran.total,
             albaran.estado, albaran.fecha, albaran.fecha_entrega,
             albaran.notas, albaran.firma_data, albaran.direccion_entrega ?? '', albaran.sync_status || 'pending', albaran.id]
          );
        } else {
          db.runSync(
            `INSERT INTO albaranes (id, numero, cliente_id, cliente_nombre, subtotal, descuento,
             iva_porcentaje, iva_importe, irpf_porcentaje, irpf_importe, total,
             estado, fecha, fecha_entrega, notas, firma_data, direccion_entrega, sync_status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [albaran.id, albaran.numero, albaran.cliente_id, albaran.cliente_nombre, albaran.subtotal,
             albaran.descuento, albaran.iva_porcentaje, albaran.iva_importe,
             albaran.irpf_porcentaje, albaran.irpf_importe, albaran.total,
             albaran.estado, albaran.fecha, albaran.fecha_entrega,
             albaran.notas, albaran.firma_data, albaran.direccion_entrega ?? '', albaran.sync_status || 'pending']
          );
        }
      }
    } catch (e) {
    }
  }

  private async getLocalAlbaranItems(albaranId: number): Promise<any[]> {
    try {
      const { getAlbaranItems } = await import('../app/db/albaranes');
      return getAlbaranItems(albaranId) as AlbaranItem[];
    } catch {
      return [];
    }
  }

  private async saveLocalAlbaranItems(items: any[]): Promise<void> {
    try {
      const db = (await import('../app/db/database')).default;
      if (!db || !items.length) return;

      // Envolver en transacción para evitar pérdida de datos si la app crashea
      db.execSync('BEGIN TRANSACTION;');
      try {
        for (const item of items) {
          db.runSync('DELETE FROM albaran_items WHERE id = ?', [item.id]);
          db.runSync(
            `INSERT INTO albaran_items (id, albaran_id, descripcion, cantidad, unidad, precio_unitario, descuento, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.albaran_id, item.descripcion, item.cantidad,
             item.unidad, item.precio_unitario, item.descuento, item.subtotal]
          );
        }
        db.execSync('COMMIT;');
      } catch (innerError) {
        db.execSync('ROLLBACK;');
        throw innerError;
      }
    } catch (e) {
    }
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
      case 'albaran':
        await this.syncAlbaranes(userId);
        break;
    }
  }

  /** Obtiene el userId actual desde la sesión de Supabase */
  private async getCurrentUserId(): Promise<string | null> {
    if (!supabase) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch {
      return null;
    }
  }

  /** Elimina una factura de la nube (llamar cuando se borra localmente) */
  async deleteInvoiceFromCloud(invoiceId: number): Promise<void> {
    if (!supabase) return;
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('facturas')
        .delete()
        .eq('id', invoiceId)
        .eq('user_id', userId);
      if (error) {
      } else {
      }
    } catch (e) {
    }
  }

  /** Elimina un cliente de la nube (llamar cuando se borra localmente) */
  async deleteClientFromCloud(clientId: number): Promise<void> {
    if (!supabase) return;
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', clientId)
        .eq('user_id', userId);
      if (error) {
      } else {
      }
    } catch (e) {
    }
  }

  /** Elimina un producto de la nube (llamar cuando se borra localmente) */
  async deleteProductFromCloud(productId: number): Promise<void> {
    if (!supabase) return;
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', productId)
        .eq('user_id', userId);
      if (error) {
      } else {
      }
    } catch (e) {
    }
  }

  /** Elimina un albaran de la nube (llamar cuando se borra localmente) */
  async deleteAlbaranFromCloud(albaranId: number): Promise<void> {
    if (!supabase) return;
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('albaranes')
        .delete()
        .eq('id', albaranId)
        .eq('user_id', userId);
      if (error) {
      } else {
      }
    } catch (e) {
    }
  }

}

export const syncService = SyncService.getInstance();
