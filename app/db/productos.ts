import db from './database';

export type Producto = {
  id: number;
  descripcion: string;
  precio: number;
  unidad: string;
  created_at?: string;
};

export function insertProducto(producto: Omit<Producto, 'id' | 'created_at'>) {
  const result = db.runSync(
    'INSERT INTO productos (descripcion, precio, unidad) VALUES (?, ?, ?)',
    [producto.descripcion, producto.precio, producto.unidad]
  );
  return result.lastInsertRowId;
}

export function getProductos(): Producto[] {
  const result = db.getAllSync<Producto>('SELECT * FROM productos ORDER BY descripcion ASC');
  return result;
}

export function updateProducto(id: number, producto: Omit<Producto, 'id' | 'created_at'>) {
  db.runSync(
    'UPDATE productos SET descripcion = ?, precio = ?, unidad = ? WHERE id = ?',
    [producto.descripcion, producto.precio, producto.unidad, id]
  );
}

export function deleteProducto(id: number) {
  db.runSync('DELETE FROM productos WHERE id = ?', [id]);
}

export function getProductoById(id: number): Producto | undefined {
  const result = db.getFirstSync<Producto>('SELECT * FROM productos WHERE id = ?', [id]);
  return result || undefined;
}
