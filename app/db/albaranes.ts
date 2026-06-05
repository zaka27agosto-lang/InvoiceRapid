import db from './database';
import type { Albaran, AlbaranItem } from './types';

export function getAlbaranes(): Albaran[] {
  if (!db) return [];
  return db.getAllSync(`
    SELECT * FROM albaranes ORDER BY fecha DESC
  `) as Albaran[];
}

export function getAlbaran(id: number): Albaran | null {
  if (!db) return null;
  return db.getFirstSync(`SELECT * FROM albaranes WHERE id = ?`, [id]) as Albaran | null;
}

export function getAlbaranItems(albaran_id: number): AlbaranItem[] {
  if (!db) return [];
  return db.getAllSync(`SELECT * FROM albaran_items WHERE albaran_id = ?`, [albaran_id]) as AlbaranItem[];
}

export function insertAlbaran(data: {
  numero: string;
  cliente_id: number | null;
  cliente_nombre: string;
  subtotal: number;
  descuento: number;
  iva_porcentaje: number;
  iva_importe: number;
  irpf_porcentaje: number;
  irpf_importe: number;
  total: number;
  notas: string;
  fecha_entrega: string;
  firma_data?: string | null;
  direccion_entrega?: string;
}) {
  const result = db.runSync(
    `INSERT INTO albaranes 
      (numero, cliente_id, cliente_nombre, subtotal, descuento, iva_porcentaje, iva_importe, irpf_porcentaje, irpf_importe, total, notas, fecha_entrega, firma_data, direccion_entrega)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.numero, data.cliente_id, data.cliente_nombre,
      data.subtotal, data.descuento, data.iva_porcentaje, data.iva_importe,
      data.irpf_porcentaje, data.irpf_importe, data.total,
      data.notas, data.fecha_entrega, data.firma_data ?? null,
      data.direccion_entrega ?? ''
    ]
  );
  return result.lastInsertRowId;
}

export function insertAlbaranItem(item: {
  albaran_id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
}) {
  return db.runSync(
    `INSERT INTO albaran_items (albaran_id, descripcion, cantidad, unidad, precio_unitario, descuento, subtotal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [item.albaran_id, item.descripcion, item.cantidad, item.unidad, item.precio_unitario, item.descuento, item.subtotal]
  );
}

export function deleteAlbaranItems(albaran_id: number) {
  if (!db) return;
  return db.runSync(`DELETE FROM albaran_items WHERE albaran_id = ?`, [albaran_id]);
}

export function deleteAlbaran(id: number) {
  if (!db) return;
  db.runSync(`DELETE FROM albaran_items WHERE albaran_id = ?`, [id]);
  return db.runSync(`DELETE FROM albaranes WHERE id = ?`, [id]);
}

export function updateEstadoAlbaran(id: number, estado: string) {
  if (!db) return;
  return db.runSync(`UPDATE albaranes SET estado = ? WHERE id = ?`, [estado, id]);
}

export function updateAlbaran(id: number, data: {
  numero: string;
  cliente_id: number | null;
  cliente_nombre: string;
  subtotal: number;
  descuento: number;
  iva_porcentaje: number;
  iva_importe: number;
  irpf_porcentaje: number;
  irpf_importe: number;
  total: number;
  notas: string;
  fecha_entrega: string;
  firma_data?: string | null;
  direccion_entrega?: string;
}) {
  return db.runSync(
    `UPDATE albaranes 
     SET numero = ?, cliente_id = ?, cliente_nombre = ?, subtotal = ?, descuento = ?, 
         iva_porcentaje = ?, iva_importe = ?, irpf_porcentaje = ?, irpf_importe = ?, 
         total = ?, notas = ?, fecha_entrega = ?, firma_data = ?, direccion_entrega = ?
     WHERE id = ?`,
    [
      data.numero, data.cliente_id, data.cliente_nombre,
      data.subtotal, data.descuento, data.iva_porcentaje, data.iva_importe,
      data.irpf_porcentaje, data.irpf_importe, data.total,
      data.notas, data.fecha_entrega, data.firma_data ?? null, data.direccion_entrega ?? '', id
    ]
  );
}

export function getNextNumeroAlbaran(config?: { prefijo: string; sufijo: string; digitos: number }): string {
  if (!db) return `A-0001`;
  
  const prefijo = config?.prefijo ?? 'A-';
  const sufijo = config?.sufijo ?? '';
  const digitos = config?.digitos ?? 4;
  
  const lastAlbaran = db.getFirstSync(
    `SELECT numero FROM albaranes 
     ORDER BY CAST(REPLACE(REPLACE(numero, ?, ''), ?, '') AS INTEGER) DESC 
     LIMIT 1`,
    [prefijo, sufijo]
  ) as { numero: string } | null;
  
  if (!lastAlbaran || !lastAlbaran.numero) {
    return `${prefijo}${String(1).padStart(digitos, '0')}${sufijo}`;
  }
  
  const match = lastAlbaran.numero.match(/(\d+)/);
  if (!match) {
    return `${prefijo}${String(1).padStart(digitos, '0')}${sufijo}`;
  }
  
  const lastNum = parseInt(match[1], 10);
  const nextNum = lastNum + 1;
  
  return `${prefijo}${String(nextNum).padStart(digitos, '0')}${sufijo}`;
}
