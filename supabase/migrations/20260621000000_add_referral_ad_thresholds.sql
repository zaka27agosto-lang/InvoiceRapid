-- ============================================================
-- Migration: Añadir umbrales configurables a app_config
-- Fecha: 2026-06-21
--
-- Permite ajustar desde el dashboard de Supabase (SQL editor o
-- servicio backend) dos umbrales que antes eran hardcoded:
--   - referral_required_count: cuántos amigos necesita un referidor
--     para ganar 1 mes Pro gratis (default 2).
--   - interstitial_every_n_actions: cada cuántas acciones de
--     usuario (crear factura/albarán/cliente/producto) se muestra
--     un interstitial (default 3).
--
-- Esto habilita A/B testing y ajustes dinámicos sin recompilar la app.
-- ============================================================

INSERT INTO public.app_config (key, value) VALUES
  ('referral_required_count', '2'),
  ('interstitial_every_n_actions', '3')
ON CONFLICT (key) DO NOTHING;
