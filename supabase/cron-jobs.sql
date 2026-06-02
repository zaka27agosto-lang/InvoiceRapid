-- ============================================================
-- CRON JOBS — InvoiceRapidPro
-- Ejecutar en el SQL Editor del dashboard de Supabase (una sola vez)
-- ============================================================
-- Requisitos previos:
--   1. El plan de Supabase debe soportar pg_cron (Pro plan o superior)
--   2. La edge function `finalize-deletion` debe estar desplegada
--   3. Tener a mano la `service_role key` (Settings → API → service_role secret)
-- ============================================================

-- PASO 1: Habilitar extensiones necesarias
-- ⚠️ Requiere plan Pro de Supabase. Si falla, actívalas desde:
--    Dashboard → Database → Extensions → pg_cron / pg_net
--    También puedes ejecutar esto en el SQL Editor (el usuario postgres tiene permisos de superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- PASO 2: Guardar la clave en Vault (OPCIONAL - requiere habilitar Vault desde el Dashboard)
-- Si Vault no está disponible, la clave se almacena directamente en la definición del cron job
-- (solo visible para superusers de PostgreSQL)
-- INSERT INTO vault.secrets (name, secret)
-- VALUES ('finalize_deletion_key', 'TU_SERVICE_ROLE_KEY')
-- ON CONFLICT (name) DO NOTHING;

-- PASO 3: Programar el cron job — se ejecuta todos los días a las 03:00 UTC
-- Si el job ya existe, eliminarlo primero para recrearlo limpiamente:
--   SELECT cron.unschedule('finalize-deletion-daily');
--
-- NOTA: Si Vault está habilitado, puedes reemplazar el header Authorization por:
--   'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'finalize_deletion_key')
SELECT cron.schedule(
  'finalize-deletion-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rvolqqtlmdyggrhfzwip.supabase.co/functions/v1/finalize-deletion',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer TU_SERVICE_ROLE_KEY"}',
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- CRON JOB 2: Limpieza de registros huérfanos (diario a las 04:00 UTC)
-- ============================================================
-- Este job llama a la función public.cleanup_orphan_records() que:
--   1. Elimina factura_items cuyo factura_id ya no existe
--   2. Elimina albaran_items cuyo albaran_id ya no existe
--   3. Elimina registros de cualquier tabla cuyo user_id ya no está en auth.users
-- La función y el cron job se crean en la migración 20260602000001.
--
-- Para ejecutar manualmente la limpieza:
--   SELECT * FROM public.cleanup_orphan_records();
--
-- Para ver/editar/eliminar este job:
--   SELECT * FROM cron.job WHERE jobname = 'cleanup-orphan-records-daily';
--   SELECT cron.unschedule('cleanup-orphan-records-daily');

-- ============================================================
-- COMANDOS ÚTILES PARA GESTIONAR LOS CRON JOBS
-- ============================================================

-- Ver todos los jobs programados
-- SELECT * FROM cron.job;

-- Ver el historial de ejecuciones (últimas 100)
-- SELECT * FROM cron.job_run_details ORDER BY runid DESC LIMIT 100;

-- Ver peticiones HTTP encoladas por pg_net
-- SELECT * FROM net.http_request_queue;

-- Pausar el job (sin eliminarlo)
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'finalize-deletion-daily'),
--   active := false
-- );

-- Reactivar el job
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'finalize-deletion-daily'),
--   active := true
-- );

-- Eliminar el job permanentemente
-- SELECT cron.unschedule('finalize-deletion-daily');

-- Ejecutar el job manualmente para probarlo (inmediatamente)
-- SELECT cron.schedule(
--   'finalize-deletion-manual-test',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://rvolqqtlmdyggrhfzwip.supabase.co/functions/v1/finalize-deletion',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'finalize_deletion_key')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
-- -- Después de verificar que funciona, elimínalo:
-- -- SELECT cron.unschedule('finalize-deletion-manual-test');
