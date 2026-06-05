-- ============================================================
-- Migration: Crear RPC atómico check_and_increment_invoice
-- Fecha: 2026-06-04
--
-- Este RPC usa SELECT ... FOR UPDATE para bloquear la fila
-- y evitar race conditions cuando dos peticiones concurren
-- simultáneamente. La Edge Function lo llama con service_role.
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
  v_limit CONSTANT INTEGER := 5;
  v_result JSONB;
BEGIN
  -- 1. Asegurar que existe la fila (upsert silencioso)
  INSERT INTO invoice_counters (user_id, month, invoice_count)
  VALUES (p_user_id, p_month, 0)
  ON CONFLICT (user_id, month) DO NOTHING;

  -- 2. Leer el contador actual con bloqueo FOR UPDATE
  --    Esto evita que otra transacción concurrente lea/escriba
  --    la misma fila hasta que esta transacción termine.
  SELECT invoice_count INTO v_current_count
  FROM invoice_counters
  WHERE user_id = p_user_id AND month = p_month
  FOR UPDATE;

  -- 3. Si es solo check, devolver sin modificar
  IF p_mode = 'check' THEN
    v_result := jsonb_build_object(
      'canCreate', v_current_count < v_limit,
      'isPro', false,
      'currentCount', v_current_count,
      'limit', v_limit
    );
    RETURN v_result;
  END IF;

  -- 4. Si ya alcanzó el límite, rechazar
  IF v_current_count >= v_limit THEN
    v_result := jsonb_build_object(
      'canCreate', false,
      'isPro', false,
      'currentCount', v_current_count,
      'limit', v_limit
    );
    RETURN v_result;
  END IF;

  -- 5. Incrementar atómicamente (la fila está bloqueada)
  UPDATE invoice_counters
  SET invoice_count = v_current_count + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id AND month = p_month;

  v_result := jsonb_build_object(
    'canCreate', true,
    'isPro', false,
    'currentCount', v_current_count + 1,
    'limit', v_limit
  );

  RETURN v_result;
END;
$$;
