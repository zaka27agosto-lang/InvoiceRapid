-- ============================================================
-- Migration: Activar RLS en tabla customers + políticas seguras
-- Fecha: 2026-06-04
--
-- La tabla customers contiene stripe_customer_id de cada usuario
-- y NO tenía RLS activado, exponiendo los IDs de stripe de todos
-- los usuarios autenticados.
--
-- Historial:
-- - init-tables-and-rls.sql comentaba que el RLS se omitía
--   intencionadamente por el flujo de checkout, pero eso ya no
--   aplica porque checkout usa Edge Functions con service_role.
-- ============================================================

-- 1. Activar RLS (seguro aunque ya esté activado)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes para evitar duplicados
DROP POLICY IF EXISTS "customers_select_own" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_service" ON public.customers;
DROP POLICY IF EXISTS "customers_update_service" ON public.customers;

-- 3. SELECT: cada usuario solo puede ver su propio stripe_customer_id
CREATE POLICY "customers_select_own"
  ON public.customers FOR SELECT
  USING (auth.uid() = user_id);

-- 4. INSERT: solo el sistema (service_role, bypass RLS) puede insertar
--    El flujo de checkout usa Edge Functions con service_role
CREATE POLICY "customers_insert_service"
  ON public.customers FOR INSERT
  WITH CHECK (false);

-- 5. UPDATE: solo el sistema puede modificar
CREATE POLICY "customers_update_service"
  ON public.customers FOR UPDATE
  USING (false);
