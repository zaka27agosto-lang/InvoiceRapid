-- ============================================================
-- Migration: Añadir monthly_free_invoice_limit a app_config
-- Fecha: 2026-06-21
--
-- Sustituye el hardcoded `LIMITE_FACTURAS_MENSUAL = 5` que vivía en
-- `utils/subscription.ts`. Ahora el umbral se puede ajustar desde el
-- SQL Editor del dashboard de Supabase sin recompilar la app.
--
-- Cambio complementario:
--   - supabase/functions/check-and-increment-invoice: lee este valor.
--   - utils/remoteConfig.ts: lo expone en `AppConfig.monthly_free_invoice_limit`.
--   - utils/subscription.ts: usa `getRemoteConfigSync().monthly_free_invoice_limit`
--     en lugar de la constante.
-- ============================================================

INSERT INTO public.app_config (key, value) VALUES
  ('monthly_free_invoice_limit', '5')
ON CONFLICT (key) DO NOTHING;
