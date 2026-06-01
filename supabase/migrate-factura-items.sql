-- ============================================================
-- MIGRAR factura_items: añadir user_id + RLS
-- La tabla existe pero sin user_id (creada en primera ejecución)
-- ============================================================

-- Añadir columna user_id (nullable primero por si hay datos)
ALTER TABLE factura_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Eliminar tabla si no se pudo migrar (solo si no hay datos)
-- En lugar de eso, asignamos user_id desde facturas para datos existentes
UPDATE factura_items fi
SET user_id = f.user_id
FROM facturas f
WHERE fi.factura_id = f.id AND fi.user_id IS NULL;

-- Ahora forzamos NOT NULL (asume que el UPDATE llenó todo)
ALTER TABLE factura_items ALTER COLUMN user_id SET NOT NULL;

-- RLS
ALTER TABLE factura_items ENABLE ROW LEVEL SECURITY;

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
