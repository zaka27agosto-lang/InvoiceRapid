import db from './database';
import type { Factura, FacturaItem } from './types';

export function getFacturas(): Factura[] {
  if (!db) return [];
  return db.getAllSync(`
    SELECT * FROM facturas ORDER BY fecha DESC
  `) as Factura[];
}

export function getFactura(id: number): Factura | null {
  if (!db) return null;
  return db.getFirstSync(`SELECT * FROM facturas WHERE id = ?`, [id]) as Factura | null;
}

export function getFacturaItems(factura_id: number): FacturaItem[] {
  if (!db) return [];
  return db.getAllSync(`SELECT * FROM factura_items WHERE factura_id = ?`, [factura_id]) as FacturaItem[];
}

export function insertFactura(data: {
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
  metodo_pago: string;
  fecha_vencimiento: string;
  fecha_entrega?: string;
}) {
  const result = db.runSync(
    `INSERT INTO facturas 
      (numero, cliente_id, cliente_nombre, subtotal, descuento, iva_porcentaje, iva_importe, irpf_porcentaje, irpf_importe, total, notas, metodo_pago, fecha_vencimiento, fecha_entrega)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.numero, data.cliente_id, data.cliente_nombre,
      data.subtotal, data.descuento, data.iva_porcentaje, data.iva_importe,
      data.irpf_porcentaje, data.irpf_importe, data.total,
      data.notas, data.metodo_pago, data.fecha_vencimiento, data.fecha_entrega || null
    ]
  );
  return result.lastInsertRowId;
}

export function insertFacturaItem(item: {
  factura_id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
}) {
  return db.runSync(
    `INSERT INTO factura_items (factura_id, descripcion, cantidad, unidad, precio_unitario, descuento, subtotal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [item.factura_id, item.descripcion, item.cantidad, item.unidad, item.precio_unitario, item.descuento, item.subtotal]
  );
}

export function deleteFacturaItems(factura_id: number) {
  if (!db) return;
  return db.runSync(`DELETE FROM factura_items WHERE factura_id = ?`, [factura_id]);
}

export function deleteFactura(id: number) {
  if (!db) return;
  db.runSync(`DELETE FROM factura_items WHERE factura_id = ?`, [id]);
  return db.runSync(`DELETE FROM facturas WHERE id = ?`, [id]);
}

export function updateEstadoFactura(id: number, estado: string) {
  if (!db) return;
  return db.runSync(`UPDATE facturas SET estado = ? WHERE id = ?`, [estado, id]);
}

export function updateFactura(id: number, data: {
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
  metodo_pago: string;
  fecha_vencimiento: string;
  fecha_entrega?: string;
}) {
  return db.runSync(
    `UPDATE facturas 
     SET numero = ?, cliente_id = ?, cliente_nombre = ?, subtotal = ?, descuento = ?, 
         iva_porcentaje = ?, iva_importe = ?, irpf_porcentaje = ?, irpf_importe = ?, 
         total = ?, notas = ?, metodo_pago = ?, fecha_vencimiento = ?, fecha_entrega = ?
     WHERE id = ?`,
    [
      data.numero, data.cliente_id, data.cliente_nombre,
      data.subtotal, data.descuento, data.iva_porcentaje, data.iva_importe,
      data.irpf_porcentaje, data.irpf_importe, data.total,
      data.notas, data.metodo_pago, data.fecha_vencimiento, data.fecha_entrega || null, id
    ]
  );
}

export function updateFacturaItem(item: {
  id: number;
  factura_id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
}) {
  return db.runSync(
    `UPDATE factura_items 
     SET factura_id = ?, descripcion = ?, cantidad = ?, unidad = ?, precio_unitario = ?, 
         descuento = ?, subtotal = ?
     WHERE id = ?`,
    [
      item.factura_id, item.descripcion, item.cantidad, item.unidad, item.precio_unitario,
      item.descuento, item.subtotal, item.id
    ]
  );
}

export function getNextNumeroFactura(config?: { prefijo: string; sufijo: string; digitos: number }): string {
  if (!db) return `F-0001`;
  
  const prefijo = config?.prefijo ?? 'F-';
  const sufijo = config?.sufijo ?? '';
  const digitos = config?.digitos ?? 4;
  
  // Obtener el número más alto existente (para evitar repeticiones al borrar la última)
  const lastFactura = db.getFirstSync(
    `SELECT numero FROM facturas 
     ORDER BY CAST(REPLACE(REPLACE(numero, ?, ''), ?, '') AS INTEGER) DESC 
     LIMIT 1`,
    [prefijo, sufijo]
  ) as { numero: string } | null;
  
  if (!lastFactura || !lastFactura.numero) {
    return `${prefijo}${String(1).padStart(digitos, '0')}${sufijo}`;
  }
  
  // Extraer el número del formato (ej: F-0005 -> 5)
  const match = lastFactura.numero.match(/(\d+)/);
  if (!match) {
    return `${prefijo}${String(1).padStart(digitos, '0')}${sufijo}`;
  }
  
  const lastNum = parseInt(match[1], 10);
  const nextNum = lastNum + 1;
  
  return `${prefijo}${String(nextNum).padStart(digitos, '0')}${sufijo}`;
}