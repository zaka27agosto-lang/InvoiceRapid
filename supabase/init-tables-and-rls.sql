-- ============================================================
-- CREACIÓN DE TABLAS + POLÍTICAS RLS — InvoiceRapidPro
-- Ejecutar en el SQL Editor del dashboard de Supabase
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- TABLAS (con user_id para RLS)
-- ============================================================

-- 1. CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id BIGINT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  movil TEXT,
  pais TEXT,
  calle TEXT,
  piso TEXT,
  ciudad TEXT,
  cp TEXT,
  provincia TEXT,
  nif TEXT,
  persona_contacto TEXT,
  direccion TEXT,
  sync_status TEXT DEFAULT 'synced',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FACTURAS
CREATE TABLE IF NOT EXISTS facturas (
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
  estado TEXT DEFAULT 'no_enviada',
  fecha TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
  fecha_vencimiento TEXT,
  fecha_entrega TEXT,
  notas TEXT,
  metodo_pago TEXT DEFAULT 'efectivo',
  sync_status TEXT DEFAULT 'synced',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FACTURA ITEMS (líneas de factura)
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

-- 4. PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id BIGINT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  precio REAL NOT NULL DEFAULT 0,
  unidad TEXT DEFAULT 'ud',
  sync_status TEXT DEFAULT 'synced',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ALBARANES
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
  direccion_entrega TEXT DEFAULT '',
  sync_status TEXT DEFAULT 'synced',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ALBARAN ITEMS (líneas de albarán)
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

-- 7. SUSCRIPCIONES (Stripe/RevenueCat)
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'inactive',
  price_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================

-- 1. facturas
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias facturas"
  ON facturas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios crean sus propias facturas"
  ON facturas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus propias facturas"
  ON facturas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus propias facturas"
  ON facturas FOR DELETE
  USING (auth.uid() = user_id);


-- 2. clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propios clientes"
  ON clientes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios crean sus propios clientes"
  ON clientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus propios clientes"
  ON clientes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus propios clientes"
  ON clientes FOR DELETE
  USING (auth.uid() = user_id);


-- 3. factura_items
ALTER TABLE factura_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propios items"
  ON factura_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios crean sus propios items"
  ON factura_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus propios items"
  ON factura_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus propios items"
  ON factura_items FOR DELETE
  USING (auth.uid() = user_id);


-- 4. productos
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propios productos"
  ON productos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios crean sus propios productos"
  ON productos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus propios productos"
  ON productos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus propios productos"
  ON productos FOR DELETE
  USING (auth.uid() = user_id);


-- 5. albaranes
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


-- 6. albaran_items
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


-- 7. subscriptions
-- La app consulta con anon key (SELECT), el webhook escribe con service_role (bypass RLS)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven su propia suscripcion"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);


-- ============================================================
-- 8. ACCOUNT DELETIONS (soft delete with 30-day grace period)
-- ============================================================
CREATE TABLE IF NOT EXISTS account_deletions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'restored', 'finalized')),
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  restored_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ
);

ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede acceder a esta tabla
CREATE POLICY "Service role manages account deletions"
  ON account_deletions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 9. DELETED EMAILS (permanently blocked after 30-day grace period)
-- ============================================================
CREATE TABLE IF NOT EXISTS deleted_emails (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deleted_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages deleted emails"
  ON deleted_emails FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
