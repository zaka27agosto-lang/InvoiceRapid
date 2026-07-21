-- ============================================================
-- POLÍTICAS RLS — InvoiceRapidPro
-- Ejecutar en el SQL Editor del dashboard de Supabase
-- ============================================================

-- 1. TABLA: facturas
-- ============================================================
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

-- SELECT: solo ver tus propias facturas
CREATE POLICY "Usuarios ven sus propias facturas"
  ON facturas FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: crear facturas propias (necesario para UPSERT)
CREATE POLICY "Usuarios crean sus propias facturas"
  ON facturas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: modificar tus propias facturas (necesario para UPSERT)
CREATE POLICY "Usuarios actualizan sus propias facturas"
  ON facturas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: eliminar tus propias facturas
CREATE POLICY "Usuarios eliminan sus propias facturas"
  ON facturas FOR DELETE
  USING (auth.uid() = user_id);


-- 2. TABLA: clientes
-- ============================================================
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


-- 3. TABLA: productos
-- ============================================================
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


-- 4. TABLA: subscriptions
-- ============================================================
-- La app consulta subscriptions con el anon key desde usePremium.ts:
--   supabase.from('subscriptions').select('*').eq('user_id', user.id)
-- Necesita SELECT RLS para que el usuario pueda ver su propia suscripción.
--
-- Las operaciones de escritura (INSERT/UPDATE/DELETE) las hace el webhook
-- de Stripe (supabase/functions/webhook.ts), que ahora usa SUPABASE_SERVICE_ROLE_KEY
-- para BYPASSEAR RLS, ya que Stripe no envía un JWT de Supabase.
--
-- ⚠️ Si el webhook usara la anon key, auth.uid() sería null y las políticas
--    bloquearían todas las escrituras. Este bug ya fue corregido.


-- 5. TABLA: account_deletions
-- ============================================================
-- Solo service_role (edge functions + cron jobs) tiene acceso.
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages account deletions"
  ON account_deletions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 7. TABLA: deleted_emails
-- ============================================================
-- Solo service_role (edge functions) tiene acceso.
ALTER TABLE deleted_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages deleted emails"
  ON deleted_emails FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- FIN POLÍTICAS RLS
-- ============================================================
