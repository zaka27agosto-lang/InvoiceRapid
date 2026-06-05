-- ============================================================
-- RATE LIMIT: Restringir validación de códigos a autenticados
-- Elimina la política pública que permitía consultas anónimas
-- Solo usuarios con sesión pueden verificar códigos de referido
-- ============================================================

-- 1. Eliminar la política pública existente (permitía a cualquiera)
DROP POLICY IF EXISTS "Cualquiera puede verificar existencia de un código" ON public.referral_codes;

-- 2. Asegurar que no exista ya la política (idempotencia)
DROP POLICY IF EXISTS "referral_codes_select_authenticated" ON public.referral_codes;

-- 3. Crear política solo para usuarios autenticados
CREATE POLICY "referral_codes_select_authenticated"
ON public.referral_codes FOR SELECT
TO authenticated
USING (true);
