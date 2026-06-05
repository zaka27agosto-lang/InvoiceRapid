-- ============================================================
-- FIX: Validar auth.uid() en ensure_referral_code
-- La versión anterior aceptaba cualquier user_uuid sin verificar
-- que el llamante fuera el propietario. Esto permitía a cualquier
-- usuario autenticado generar un código para otro usuario.
-- ============================================================

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
  -- 🔐 Validar que el usuario autenticado es el dueño del user_uuid
  IF auth.uid() IS NULL OR auth.uid() != user_uuid THEN
    RAISE EXCEPTION 'No autorizado: solo puedes gestionar tu propio código de referido';
  END IF;

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

  -- Insertar con ON CONFLICT para evitar errores de duplicado
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (user_uuid, new_code)
  ON CONFLICT (user_id) DO NOTHING;

  -- Releer por si hubo conflicto (otra llamada concurrente ganó)
  SELECT code INTO existing_code
  FROM public.referral_codes
  WHERE user_id = user_uuid;

  RETURN COALESCE(existing_code, new_code);
END;
$$;
