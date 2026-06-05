-- ============================================================
-- Migration: Crear RPC reset_invoice_counter para modo desarrollo
-- Fecha: 2026-06-04
-- ============================================================

-- RPC: Resetear contador de facturas a 0 para el mes indicado
-- Usa auth.uid() para seguridad — solo el usuario autenticado puede resetear su propio contador
-- Diseñado para el botón de modo desarrollo en Ajustes
CREATE OR REPLACE FUNCTION reset_invoice_counter(p_month TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO invoice_counters (user_id, month, invoice_count)
  VALUES (auth.uid(), p_month, 0)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    invoice_count = 0,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
