import db from './database';

export type Producto = {
  id: number;
  descripcion: string;
  precio: number;
  unidad: string;
  created_at?: string;
};

export function insertProducto(producto: Omit<Producto, 'id' | 'created_at'>) {
  if (!db) return -1;
  const result = db.runSync(
    'INSERT INTO productos (descripcion, precio, unidad) VALUES (?, ?, ?)',
    [producto.descripcion, producto.precio, producto.unidad]
  );
  return result.lastInsertRowId;
}

export function getProductos(): Producto[] {
  if (!db) return [];
  const result = db.getAllSync('SELECT * FROM productos ORDER BY descripcion ASC');
  return result as Producto[];
}

export function updateProducto(id: number, producto: Omit<Producto, 'id' | 'created_at'>) {
  if (!db) return;
  db.runSync(
    'UPDATE productos SET descripcion = ?, precio = ?, unidad = ? WHERE id = ?',
    [producto.descripcion, producto.precio, producto.unidad, id]
  );
}

export function deleteProducto(id: number) {
  if (!db) return;
  db.runSync('DELETE FROM productos WHERE id = ?', [id]);
}

export function getProductoById(id: number): Producto | undefined {
  if (!db) return undefined;
  const result = db.getFirstSync('SELECT * FROM productos WHERE id = ?', [id]);
  return result as Producto | undefined;
}
