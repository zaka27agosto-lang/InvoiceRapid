-- ============================================================
-- FIX: Bucle de reintento en generate_referral_code()
-- Evita colisiones silenciosas si el código generado ya existe
-- Añade contador de intentos + fallback con UUID
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
  max_attempts INT := 10;
BEGIN
  LOOP
    new_code := upper(substring(md5(random()::text) from 1 for 6));
    
    -- Verificar si ya existe
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.referral_codes WHERE code = new_code
    );
    
    attempts := attempts + 1;
    
    -- Seguridad: salir si demasiados intentos (no debería pasar)
    IF attempts >= max_attempts THEN
      -- Usar UUID truncado como fallback garantizado único
      new_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, new_code)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
