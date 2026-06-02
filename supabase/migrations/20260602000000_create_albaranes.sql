-- ============================================================
-- ALBARANES + ALBARAN_ITEMS — InvoiceRapidPro
-- ============================================================

CREATE TABLE IF NOT EXISTS albaranes (
  id BIGINT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  cliente_id BIGINT,
  cliente_nombre TEXT,
  subtotal REAL DEFAULT 0,
  descuento REAL DEFAULT 0,
  iva_porcentaje REAL DEFAULT 21,
  iva_importe REAL DEFAULT 0,
  irpf_porcentaje REAL DEFAULT 0,
  irpf_importe REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  estado TEXT DEFAULT 'pendiente',
  fecha TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
  fecha_entrega TEXT,
  notas TEXT,
  firma_data TEXT,
  sync_status TEXT DEFAULT 'synced',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS albaran_items (
  id BIGINT PRIMARY KEY,
  albaran_id BIGINT NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
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

-- RLS: albaranes
ALTER TABLE albaranes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propios albaranes"
  ON albaranes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios crean sus propios albaranes"
  ON albaranes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus propios albaranes"
  ON albaranes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus propios albaranes"
  ON albaranes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS: albaran_items
ALTER TABLE albaran_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propios items de albaran"
  ON albaran_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios crean sus propios items de albaran"
  ON albaran_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus propios items de albaran"
  ON albaran_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus propios items de albaran"
  ON albaran_items FOR DELETE
  USING (auth.uid() = user_id);
