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


-- 5. TABLA: customers
-- ============================================================
-- Corregido en migración 20260604000004_fix_customers_rls.sql:
--   - SELECT: cada usuario ve solo su propio stripe_customer_id
--   - INSERT: solo service_role (edge functions)
--   - UPDATE: solo service_role
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- SELECT: solo tu propio customer
CREATE POLICY "customers_select_own"
  ON customers FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: solo service_role (bypass RLS)
CREATE POLICY "customers_insert_service"
  ON customers FOR INSERT
  WITH CHECK (false);

-- UPDATE: solo service_role (bypass RLS)
CREATE POLICY "customers_update_service"
  ON customers FOR UPDATE
  USING (false);


-- 6. TABLA: account_deletions
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
-- 8. SISTEMA DE REFERIDOS
-- ============================================================

-- 8a. TABLA: profiles
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios leen su propio perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- UPDATE: los usuarios pueden actualizar su perfil, pero las columnas
-- sensibles (referral_used, device_id) están protegidas por el trigger
-- BEFORE UPDATE trg_protect_profile_fields (migración 00012)
CREATE POLICY "Usuarios actualizan su propio perfil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 8b. TABLA: referral_codes
-- ============================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- SELECT: solo ver tu propio código (corregido en 00012)
CREATE POLICY "Usuarios leen su propio código"
  ON referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- RPC verify_referral_code(code TEXT) → JSONB (SECURITY DEFINER)
-- Permite validar códigos sin exponer la tabla completa

-- 8c. TABLA: referral_events
-- ============================================================
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios leen eventos como referidor o referido"
  ON referral_events FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- INSERT: solo eventos con status='pending' y activated_at=NULL
-- (corregido en 00012 para prevenir inserción de eventos pre-activados)
CREATE POLICY "Usuarios crean eventos como referido"
  ON referral_events FOR INSERT
  WITH CHECK (
    auth.uid() = referred_id
    AND status = 'pending'
    AND activated_at IS NULL
  );
