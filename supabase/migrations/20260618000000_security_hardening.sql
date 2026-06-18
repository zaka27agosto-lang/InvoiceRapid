-- ============================================================
-- MIGRACIÓN: Security Hardening — 18/06/2026
-- ============================================================
-- Aplica hardening de seguridad a producción:
--   1. RLS en tabla customers (si no estaba activo)
--   2. Políticas RLS para customers
--
-- ⚠️ Esta migración es IDEMPOTENTE. Puede ejecutarse múltiples veces.
-- ============================================================

-- 1. Asegurar RLS en customers (por si init-tables no lo aplicó)
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;

-- 2. Políticas RLS para customers (IF NOT EXISTS no funciona en policies, usar DO block)
DO $$
BEGIN
    -- SELECT: cada usuario ve solo su propio stripe_customer_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'customers'
        AND policyname = 'customers_select_own'
    ) THEN
        CREATE POLICY "customers_select_own"
        ON customers FOR SELECT
        USING (auth.uid() = user_id);
    END IF;

    -- INSERT: solo service_role
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'customers'
        AND policyname = 'customers_insert_service'
    ) THEN
        CREATE POLICY "customers_insert_service"
        ON customers FOR INSERT
        WITH CHECK (false);
    END IF;

    -- UPDATE: solo service_role
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'customers'
        AND policyname = 'customers_update_service'
    ) THEN
        CREATE POLICY "customers_update_service"
        ON customers FOR UPDATE
        USING (false);
    END IF;
END $$;
