-- ====================================================================
-- MIGRACIÓN 00012 — Fix vulnerabilidades del sistema de referidos
-- 
-- #1 CRÍTICO: Trigger BEFORE UPDATE en profiles
--    → Bloquea modificaciones de referral_used y device_id
-- #2 ALTO: Política referral_codes — eliminar USING(true)
--    → Reemplazado por RPC verify_referral_code(code)
-- #3 ALTO: Política referral_events INSERT — restringir status
--    → Solo permite status='pending' y activated_at=NULL
-- ====================================================================

-- ====================================================================
-- #1 CRÍTICO: Proteger campos sensibles de profiles
--    referral_used: solo puede pasar de false/NULL a true, nunca revertirse
--    device_id: solo puede asignarse una vez (cuando es NULL)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- referral_used: solo puede pasar de false/NULL → true, nunca revertirse
  IF OLD.referral_used = true AND NEW.referral_used IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'No puedes desactivar referral_used una vez activado';
  END IF;

  -- device_id: solo puede asignarse una vez (cuando es NULL) o por service_role
  IF OLD.device_id IS NOT NULL AND OLD.device_id IS DISTINCT FROM NEW.device_id THEN
    -- Permitir solo si quien modifica es service_role (Edge Functions)
    IF current_setting('role') != 'service_role' THEN
      RAISE EXCEPTION 'No puedes modificar device_id una vez establecido';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Instalar el trigger (DROP primero para idempotencia)
DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- ====================================================================
-- #2 ALTO: Eliminar política que expone todos los referral_codes
--    a cualquier usuario autenticado (USING(true) para authenticated)
--    y crear RPC segura verify_referral_code(code)
-- ====================================================================

-- Eliminar la política débil de la migración 00008
DROP POLICY IF EXISTS "referral_codes_select_authenticated" ON public.referral_codes;

-- Asegurar que solo existe la política que permite ver tu propio código
-- (ya existe "Usuarios leen su propio código" de la migración 00001)
-- Si no existe, crearla:
DROP POLICY IF EXISTS "Usuarios leen su propio código" ON public.referral_codes;
CREATE POLICY "Usuarios leen su propio código"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- RPC segura: verificar si un código existe sin exponer datos
-- La usa la pantalla de onboarding para validar códigos
CREATE OR REPLACE FUNCTION public.verify_referral_code(code_to_check TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_user_id UUID;
BEGIN
  SELECT user_id INTO code_user_id
  FROM public.referral_codes
  WHERE code = code_to_check;

  IF code_user_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'is_self', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'is_self', (auth.uid() IS NOT NULL AND auth.uid() = code_user_id)
  );
END;
$$;

-- ====================================================================
-- #3 ALTO: Restringir INSERT en referral_events
--    Solo permite insertar eventos con status='pending' y activated_at=NULL
--    Previene que un usuario inserte eventos ya "activados" directamente
-- ====================================================================

DROP POLICY IF EXISTS "Usuarios crean eventos como referido" ON public.referral_events;

CREATE POLICY "Usuarios crean eventos como referido"
  ON public.referral_events FOR INSERT
  WITH CHECK (
    auth.uid() = referred_id
    AND status = 'pending'
    AND activated_at IS NULL
  );

-- ====================================================================
-- FIN DE MIGRACIÓN 00012
-- ====================================================================
