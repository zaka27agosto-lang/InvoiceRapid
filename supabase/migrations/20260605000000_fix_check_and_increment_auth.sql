-- ====================================================================
-- MIGRACIÓN 00013 — Fix validación auth.uid() en check_and_increment_invoice
--
-- 🔴 CRÍTICO: La función SECURITY DEFINER aceptaba p_user_id del
--    llamante sin verificar que coincidiera con auth.uid().
--    Cualquier usuario autenticado podía modificar el contador
--    de facturas de OTRO usuario.
--
-- Fix: Validar que p_user_id == auth.uid() O que el caller sea
--       service_role (para Edge Functions que operan en nombre
--       del sistema, como activate-referral).
-- ====================================================================

CREATE OR REPLACE FUNCTION check_and_increment_invoice(
  p_user_id UUID,
  p_month TEXT,
  p_mode TEXT DEFAULT 'increment'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_count INTEGER;
  v_limit CONSTANT INTEGER := 5;
  v_result JSONB;
BEGIN
  -- 🔐 Validar que el llamante es el dueño O es service_role
  IF current_setting('role') != 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
      RAISE EXCEPTION 'No autorizado: solo puedes operar sobre tu propio contador';
    END IF;
  END IF;

  -- 1. Asegurar que existe la fila (upsert silencioso)
  INSERT INTO invoice_counters (user_id, month, invoice_count)
  VALUES (p_user_id, p_month, 0)
  ON CONFLICT (user_id, month) DO NOTHING;

  -- 2. Leer el contador actual con bloqueo FOR UPDATE
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
