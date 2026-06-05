-- ============================================================
-- CRON JOBS — InvoiceRapidPro
-- Ejecutar en el SQL Editor del dashboard de Supabase (una sola vez)
-- ============================================================
-- Requisitos previos:
--   1. El plan de Supabase debe soportar pg_cron (Pro plan o superior)
--   2. La edge function `finalize-deletion` debe estar desplegada
--   3. Configurar la variable CRON_SECRET en la Edge Function (ver paso 2)
-- ============================================================

-- PASO 1: Habilitar extensiones necesarias
-- ⚠️ Requiere plan Pro de Supabase. Si falla, actívalas desde:
--    Dashboard → Database → Extensions → pg_cron / pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- PASO 2: Configurar CRON_SECRET
-- 
-- Antes de crear el cron job, debes configurar la variable de entorno CRON_SECRET
-- en la Edge Function finalize-deletion:
--   1. Ve a Supabase Dashboard → Edge Functions → finalize-deletion
--   2. Añade la variable: CRON_SECRET = <un-valor-secreto-largo>
--   3. Usa ese mismo valor en el header 'x-cron-secret' del paso 3
--
-- NOTA DE SEGURIDAD: La Edge Function usa el header 'x-cron-secret', NO 'Authorization: Bearer'.
-- Esto es por diseño — el CRON_SECRET es un secreto compartido específico para cron jobs,
-- no la service_role key general. Así, si el cron job se ve comprometido, solo afecta a
-- finalize-deletion, no a toda la base de datos.

-- PASO 3: Programar el cron job — se ejecuta todos los días a las 03:00 UTC
--
-- ⚠️ REEMPLAZA 'TU_CRON_SECRET' por el valor real de CRON_SECRET configurado en el paso 2.
-- El header es 'x-cron-secret' (minúsculas), que es lo que la Edge Function verifica.
--
-- Si el job ya existe, eliminarlo primero para recrearlo limpiamente:
--   SELECT cron.unschedule('finalize-deletion-daily');
SELECT cron.schedule(
  'finalize-deletion-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rvolqqtlmdyggrhfzwip.supabase.co/functions/v1/finalize-deletion',
    headers := '{"Content-Type":"application/json","x-cron-secret":"TU_CRON_SECRET"}',
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- CRON JOB 2: Limpieza de registros huérfanos (diario a las 04:00 UTC)
-- ============================================================
-- Este job llama a la función public.cleanup_orphan_records() que elimina
-- registros huérfanos de todas las tablas. La función y el cron job se
-- crean en la migración 20260602000001.

-- ============================================================
-- COMANDOS ÚTILES PARA GESTIONAR LOS CRON JOBS
-- ============================================================

-- Ver todos los jobs programados:
-- SELECT * FROM cron.job;

-- Ver el historial de ejecuciones (últimas 100):
-- SELECT * FROM cron.job_run_details ORDER BY runid DESC LIMIT 100;

-- Ver peticiones HTTP encoladas por pg_net:
-- SELECT * FROM net.http_request_queue;

-- Pausar el job (sin eliminarlo):
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'finalize-deletion-daily'),
--   active := false
-- );

-- Reactivar el job:
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'finalize-deletion-daily'),
--   active := true
-- );

-- Eliminar el job permanentemente:
-- SELECT cron.unschedule('finalize-deletion-daily');
