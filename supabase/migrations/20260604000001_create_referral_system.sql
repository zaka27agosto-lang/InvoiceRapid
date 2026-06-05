-- ============================================================
-- SISTEMA DE REFERIDOS — InvoiceRapidPro
-- Tablas: profiles, referral_codes, referral_events
-- Triggers: auto-crear perfil + código al registrarse
-- ============================================================

-- 1. TABLA: profiles (extensión mínima de auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios leen su propio perfil" ON profiles;
CREATE POLICY "Usuarios leen su propio perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuarios actualizan su propio perfil" ON profiles;
CREATE POLICY "Usuarios actualizan su propio perfil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. TABLA: referral_codes (código único de 6 chars por usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- El usuario ve solo su propio código
DROP POLICY IF EXISTS "Usuarios leen su propio código" ON referral_codes;
CREATE POLICY "Usuarios leen su propio código"
  ON referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- Política pública: cualquiera puede verificar si un código existe
-- Necesario para la validación en la pantalla de onboarding (incluso sin sesión)
DROP POLICY IF EXISTS "Cualquiera puede verificar existencia de un código" ON referral_codes;
CREATE POLICY "Cualquiera puede verificar existencia de un código"
  ON referral_codes FOR SELECT
  USING (TRUE);

-- 3. TABLA: referral_events (registro de referidos)
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referred_id UUID NOT NULL REFERENCES auth.users(id),
  referred_email TEXT,
  code_used TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'activated', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios leen eventos como referidor o referido" ON referral_events;
CREATE POLICY "Usuarios leen eventos como referidor o referido"
  ON referral_events FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Usuarios crean eventos como referido" ON referral_events;
CREATE POLICY "Usuarios crean eventos como referido"
  ON referral_events FOR INSERT
  WITH CHECK (auth.uid() = referred_id);

-- 4. TRIGGER: auto-crear perfil al registrarse en auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. TRIGGER: auto-generar código de referido al crear perfil
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generar código alfanumérico de 6 caracteres en mayúsculas
    new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

    SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE code = new_code) INTO code_exists;

    EXIT WHEN NOT code_exists;
  END LOOP;

  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, new_code);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- 6. ÍNDICES para rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referred ON referral_events(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_status ON referral_events(status);
