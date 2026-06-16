-- Migration: Add fecha_entrega column to facturas table
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha_entrega TEXT;
