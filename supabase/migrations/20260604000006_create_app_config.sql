-- ============================================================
-- Migration: Crear tabla app_config para configuración remota
-- Fecha: 2026-06-04
--
-- Permite cambiar valores como max_rewarded_ads_per_month sin
-- necesidad de publicar una nueva versión de la app.
-- ============================================================

-- 1. Crear tabla de configuración remota
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Valores por defecto
INSERT INTO public.app_config (key, value) VALUES
  ('max_rewarded_ads_per_month', '1')
ON CONFLICT (key) DO NOTHING;

-- 3. Row Level Security
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
-- SELECT: cualquier usuario autenticado puede leer (configuración pública)
DROP POLICY IF EXISTS "app_config_select_authenticated" ON public.app_config;
CREATE POLICY "app_config_select_authenticated"
  ON public.app_config FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT/UPDATE/DELETE: solo service_role (Edge Functions, bypass RLS)
DROP POLICY IF EXISTS "app_config_write_service" ON public.app_config;
CREATE POLICY "app_config_write_service"
  ON public.app_config FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "app_config_update_service" ON public.app_config;
CREATE POLICY "app_config_update_service"
  ON public.app_config FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "app_config_delete_service" ON public.app_config;
CREATE POLICY "app_config_delete_service"
  ON public.app_config FOR DELETE
  USING (false);
