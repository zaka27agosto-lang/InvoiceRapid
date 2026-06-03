-- Add direccion_entrega column to albaranes for delivery address
ALTER TABLE albaranes ADD COLUMN direccion_entrega TEXT DEFAULT '';
