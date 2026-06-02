-- ============================================================
-- FUNCIÓN DE LIMPIEZA DE HUÉRFANOS — InvoiceRapidPro
-- ============================================================

-- Elimina registros huérfanos en todas las tablas:
--   1. factura_items cuyo factura_id ya no existe
--   2. albaran_items cuyo albaran_id ya no existe
--   3. Registros de cualquier tabla cuyo user_id ya no está en auth.users
-- Se ejecuta vía pg_cron diariamente a las 04:00 UTC
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_orphan_records()
RETURNS TABLE(table_name TEXT, deleted_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    -- 1. Limpiar factura_items huérfanos (factura padre eliminada)
    WITH deleted AS (
        DELETE FROM factura_items
        WHERE factura_id NOT IN (SELECT id FROM facturas)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    IF v_count > 0 THEN
        table_name := 'factura_items';
        deleted_count := v_count;
        RETURN NEXT;
    END IF;

    -- 2. Limpiar albaran_items huérfanos (albaran padre eliminado)
    WITH deleted AS (
        DELETE FROM albaran_items
        WHERE albaran_id NOT IN (SELECT id FROM albaranes)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    IF v_count > 0 THEN
        table_name := 'albaran_items';
        deleted_count := v_count;
        RETURN NEXT;
    END IF;

    -- 3. Limpiar facturas de usuarios que ya no existen
    WITH deleted AS (
        DELETE FROM facturas
        WHERE user_id NOT IN (SELECT id FROM auth.users)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    IF v_count > 0 THEN
        table_name := 'facturas';
        deleted_count := v_count;
        RETURN NEXT;
    END IF;

    -- 4. Limpiar albaranes de usuarios que ya no existen
    WITH deleted AS (
        DELETE FROM albaranes
        WHERE user_id NOT IN (SELECT id FROM auth.users)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    IF v_count > 0 THEN
        table_name := 'albaranes';
        deleted_count := v_count;
        RETURN NEXT;
    END IF;

    -- 5. Limpiar clientes de usuarios que ya no existen
    WITH deleted AS (
        DELETE FROM clientes
        WHERE user_id NOT IN (SELECT id FROM auth.users)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    IF v_count > 0 THEN
        table_name := 'clientes';
        deleted_count := v_count;
        RETURN NEXT;
    END IF;

    -- 6. Limpiar productos de usuarios que ya no existen
    WITH deleted AS (
        DELETE FROM productos
        WHERE user_id NOT IN (SELECT id FROM auth.users)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    IF v_count > 0 THEN
        table_name := 'productos';
        deleted_count := v_count;
        RETURN NEXT;
    END IF;

    -- Si no se eliminó nada, devolver una fila vacía para el log
    IF NOT FOUND THEN
        RETURN;
    END IF;
END;
$$;

-- ============================================================
-- CRON JOB: Ejecutar la limpieza todos los días a las 04:00 UTC
-- ============================================================

-- Eliminar job anterior si existe (para re-crearlo limpiamente)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphan-records-daily') THEN
        PERFORM cron.unschedule('cleanup-orphan-records-daily');
    END IF;
END $$;

-- Programar el job
SELECT cron.schedule(
    'cleanup-orphan-records-daily',
    '0 4 * * *',
    'SELECT * FROM public.cleanup_orphan_records();'
);
