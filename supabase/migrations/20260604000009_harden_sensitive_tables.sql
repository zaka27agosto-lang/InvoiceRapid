-- ============================================================
-- HARDEN SENSITIVE TABLES — InvoiceRapidPro
-- Restringe account_deletions y deleted_emails a service_role.
-- NOTA: customers ya fue corregido en la migración 00004.
-- ============================================================

-- ============================================================
-- 1. account_deletions: restringir a service_role
--    La política anterior usaba USING (true) sin TO, lo que permitía
--    acceso a cualquier rol (público, autenticado, anónimo).
--    Solo las Edge Functions (con service_role) deben acceder.
-- ============================================================
DROP POLICY IF EXISTS "Service role manages account deletions" ON public.account_deletions;

CREATE POLICY "Service role manages account deletions"
  ON public.account_deletions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. deleted_emails: restringir a service_role
--    Misma corrección que account_deletions.
-- ============================================================
DROP POLICY IF EXISTS "Service role manages deleted emails" ON public.deleted_emails;

CREATE POLICY "Service role manages deleted emails"
  ON public.deleted_emails FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
