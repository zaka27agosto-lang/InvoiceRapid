import db from './database';

export function getFacturas() {
  return db.getAllSync(`
    SELECT * FROM facturas ORDER BY fecha DESC
  `);
}

export function getFactura(id: number) {
  return db.getFirstSync(`SELECT * FROM facturas WHERE id = ?`, [id]);
}

export function getFacturaItems(factura_id: number) {
  return db.getAllSync(`SELECT * FROM factura_items WHERE factura_id = ?`, [factura_id]);
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
}) {
  const result = db.runSync(
    `INSERT INTO facturas 
      (numero, cliente_id, cliente_nombre, subtotal, descuento, iva_porcentaje, iva_importe, irpf_porcentaje, irpf_importe, total, notas, metodo_pago, fecha_vencimiento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.numero, data.cliente_id, data.cliente_nombre,
      data.subtotal, data.descuento, data.iva_porcentaje, data.iva_importe,
      data.irpf_porcentaje, data.irpf_importe, data.total,
      data.notas, data.metodo_pago, data.fecha_vencimiento
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
  return db.runSync(`DELETE FROM factura_items WHERE factura_id = ?`, [factura_id]);
}

export function deleteFactura(id: number) {
  db.runSync(`DELETE FROM factura_items WHERE factura_id = ?`, [id]);
  return db.runSync(`DELETE FROM facturas WHERE id = ?`, [id]);
}

export function updateEstadoFactura(id: number, estado: string) {
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
}) {
  return db.runSync(
    `UPDATE facturas 
     SET numero = ?, cliente_id = ?, cliente_nombre = ?, subtotal = ?, descuento = ?, 
         iva_porcentaje = ?, iva_importe = ?, irpf_porcentaje = ?, irpf_importe = ?, 
         total = ?, notas = ?, metodo_pago = ?, fecha_vencimiento = ?
     WHERE id = ?`,
    [
      data.numero, data.cliente_id, data.cliente_nombre,
      data.subtotal, data.descuento, data.iva_porcentaje, data.iva_importe,
      data.irpf_porcentaje, data.irpf_importe, data.total,
      data.notas, data.metodo_pago, data.fecha_vencimiento, id
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

export function getNextNumeroFactura(): string {
  // Obtener la última factura para detectar su número
  const lastFactura = db.getFirstSync(`SELECT numero FROM facturas ORDER BY id DESC LIMIT 1`) as any;
  
  if (!lastFactura || !lastFactura.numero) {
    return `F-0001`;
  }
  
  // Extraer el número del formato (ej: F-0005 -> 5)
  const match = lastFactura.numero.match(/(\d+)/);
  if (!match) {
    return `F-0001`;
  }
  
  const lastNum = parseInt(match[1], 10);
  const nextNum = lastNum + 1;
  
  // Mantener el mismo formato que el último
  const prefix = lastFactura.numero.replace(/\d+$/, '');
  const numStr = String(nextNum).padStart(match[1].length, '0');
  
  return `${prefix}${numStr}`;
}