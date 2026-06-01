-- ============================================================
-- AÑADIR factura_items + RLS (incremento sobre init-tables-and-rls.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS factura_items (
  id BIGINT PRIMARY KEY,
  factura_id BIGINT NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descripcion TEXT,
  cantidad REAL DEFAULT 1,
  unidad TEXT DEFAULT 'ud',
  precio_unitario REAL DEFAULT 0,
  descuento REAL DEFAULT 0,
  subtotal REAL DEFAULT 0,
  sync_status TEXT DEFAULT 'synced',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE factura_items ENABLE ROW LEVEL SECURITY;

-- Usamos DROP + CREATE para que sea idempotente
DROP POLICY IF EXISTS "Usuarios ven sus propios items" ON factura_items;
CREATE POLICY "Usuarios ven sus propios items"
  ON factura_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios crean sus propios items" ON factura_items;
CREATE POLICY "Usuarios crean sus propios items"
  ON factura_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus propios items" ON factura_items;
CREATE POLICY "Usuarios actualizan sus propios items"
  ON factura_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios eliminan sus propios items" ON factura_items;
CREATE POLICY "Usuarios eliminan sus propios items"
  ON factura_items FOR DELETE
  USING (auth.uid() = user_id);
