-- ============================================================
-- Migration: Crear tabla invoice_counters + RPC functions
-- Fecha: 2026-06-04
-- ============================================================

-- 1. Tabla de contadores mensuales por usuario
CREATE TABLE IF NOT EXISTS invoice_counters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- formato "YYYY-MM"
  invoice_count INTEGER DEFAULT 0,
  rewarded_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- 2. Row Level Security
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own counters"
  ON invoice_counters
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. RPC: Incrementar contador de facturas (upsert + incremento atómico)
-- Usa auth.uid() para seguridad — no acepta user_id del cliente
CREATE OR REPLACE FUNCTION increment_invoice_counter(p_month TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO invoice_counters (user_id, month, invoice_count)
  VALUES (auth.uid(), p_month, 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    invoice_count = invoice_counters.invoice_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Incrementar contador de rewarded ads (upsert + incremento atómico)
CREATE OR REPLACE FUNCTION increment_rewarded_counter(p_month TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO invoice_counters (user_id, month, rewarded_count)
  VALUES (auth.uid(), p_month, 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    rewarded_count = invoice_counters.rewarded_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Obtener contador actual del usuario autenticado para un mes
CREATE OR REPLACE FUNCTION get_invoice_counter(p_month TEXT)
RETURNS TABLE(invoice_count INTEGER, rewarded_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT ic.invoice_count, ic.rewarded_count
  FROM invoice_counters ic
  WHERE ic.user_id = auth.uid() AND ic.month = p_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
