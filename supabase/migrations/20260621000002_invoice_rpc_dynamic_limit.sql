-- ============================================================
-- Migration: check_and_increment_invoice → leer límite desde app_config
-- Fecha: 2026-06-21
--
-- POR QUÉ ESTA MIGRACIÓN:
-- Antes la RPC tenía `v_limit CONSTANT INTEGER := 5` hardcoded.
-- La Edge Function sobreescribía `limit` en la respuesta con el valor
-- remoto de app_config, pero el enforcing real en SQL seguía siendo 5.
-- Resultado: si admin ponía monthly_free_invoice_limit=10, la UI mostraba
-- "5/10" pero el server rechazaba a partir de la 6ª factura real.
-- Si admin ponía 3 para endurecer, la app seguía permitiendo 5 (peor de
-- lo intencionado).
--
-- AHORA:
-- La RPC consulta app_config.monthly_free_invoice_limit en cada llamada.
-- El default es 5 si la fila no existe o el valor es inválido.
-- Postgres es ahora la única fuente de verdad del enforcing server-side.
--
-- Notas de seguridad:
-- - SECURITY DEFINER → la función se ejecuta como el dueño (postgres),
--   que es superuser, así que puede leer app_config sin tropezarse con RLS.
-- - `app_config.key` es PK → MAX 1 fila → SELECT INTO sin agregación.
-- - Validamos >= 0; nulo o basura → default conservador 5.
-- ============================================================

CREATE OR REPLACE FUNCTION check_and_increment_invoice(
  p_user_id UUID,
  p_month TEXT,
  p_mode TEXT DEFAULT 'increment'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER;
  v_limit INTEGER := 5; -- default conservador; coincide con la migración SQL
  v_result JSONB;
BEGIN
  -- 1. Leer el límite desde app_config (single source of truth).
  --    Si no existe o es inválido, mantener el default 5.
  --    SECURITY DEFINER permite leer aunque RLS lo restrinja a usuarios
  --    autenticados.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'app_config'
  ) THEN
    v_limit := 5;
  ELSE
    BEGIN
      SELECT value::INTEGER
        INTO v_limit
        FROM app_config
       WHERE key = 'monthly_free_invoice_limit';

      -- Si el admin dejó la fila vacía o puso algo raro, lo logueamos pero
      -- seguimos con default conservador para no romper creación de facturas.
      IF v_limit IS NULL OR v_limit < 0 THEN
        RAISE WARNING 'app_config.monthly_free_invoice_limit is null or negative (%), using default 5', v_limit;
        v_limit := 5;
      END IF;
    EXCEPTION
      -- 22P02 = invalid_text_representation: cubre 'value::INTEGER' sobre
      -- texto basura (ej. admin escribió 'five' o '   ' por error).
      -- NO usamos WHEN OTHERS para que errores reales (columna borrada, etc.)
      -- burbujeen a los logs de Supabase en lugar de quedar enmascarados.
      WHEN invalid_text_representation THEN
        RAISE WARNING 'app_config.monthly_free_invoice_limit no es entero válido, usando default 5';
        v_limit := 5;
    END;
  END IF;

  -- 2. Asegurar que existe la fila del contador (upsert silencioso)
  INSERT INTO invoice_counters (user_id, month, invoice_count)
  VALUES (p_user_id, p_month, 0)
  ON CONFLICT (user_id, month) DO NOTHING;

  -- 3. Leer el contador actual con bloqueo FOR UPDATE.
  --    Evita que otra transacción concurrente lea/escriba esta fila
  --    hasta que esta transacción termine.
  SELECT invoice_count INTO v_current_count
    FROM invoice_counters
   WHERE user_id = p_user_id
     AND month = p_month
   FOR UPDATE;

  -- 4. Si es solo check, devolver sin modificar
  IF p_mode = 'check' THEN
    v_result := jsonb_build_object(
      'canCreate', v_current_count < v_limit,
      'isPro', false,
      'currentCount', v_current_count,
      'limit', v_limit
    );
    RETURN v_result;
  END IF;

  -- 5. Si ya alcanzó el límite, rechazar
  IF v_current_count >= v_limit THEN
    v_result := jsonb_build_object(
      'canCreate', false,
      'isPro', false,
      'currentCount', v_current_count,
      'limit', v_limit
    );
    RETURN v_result;
  END IF;

  -- 6. Incrementar atómicamente (la fila está bloqueada)
  UPDATE invoice_counters
     SET invoice_count = v_current_count + 1,
         updated_at = NOW()
   WHERE user_id = p_user_id
     AND month = p_month;

  v_result := jsonb_build_object(
    'canCreate', true,
    'isPro', false,
    'currentCount', v_current_count + 1,
    'limit', v_limit
  );

  RETURN v_result;
END;
$$;

-- Comentario para el equipo (aparece en pg_description / documentación)
COMMENT ON FUNCTION check_and_increment_invoice(UUID, TEXT, TEXT) IS
  'Atomic check + increment of monthly free invoice counter. Limit is read from app_config.monthly_free_invoice_limit on each call. SECURITY DEFINER so it bypasses RLS on app_config. 2026-06-21: dynamic limit (was hardcoded := 5).';
