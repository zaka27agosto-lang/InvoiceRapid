-- ============================================================
-- MIGRACIÓN 20260604000002 — device_id + ensure_referral_code
-- ============================================================

-- 1. Añadir columna device_id a profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_device_id ON profiles(device_id);

-- 2. Función RPC: asegurar que un usuario tiene código de referido
--    Útil para usuarios existentes que se registraron antes de esta feature
CREATE OR REPLACE FUNCTION public.ensure_referral_code(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_code TEXT;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Verificar si ya tiene código
  SELECT code INTO existing_code
  FROM public.referral_codes
  WHERE user_id = user_uuid;

  IF existing_code IS NOT NULL THEN
    RETURN existing_code;
  END IF;

  -- Asegurar que el perfil existe
  INSERT INTO public.profiles (id)
  VALUES (user_uuid)
  ON CONFLICT (id) DO NOTHING;

  -- Generar código único
  LOOP
    new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

    SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE code = new_code) INTO code_exists;

    EXIT WHEN NOT code_exists;
  END LOOP;

  INSERT INTO public.referral_codes (user_id, code)
  VALUES (user_uuid, new_code);

  RETURN new_code;
END;
$$;
