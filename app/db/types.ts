// ── Tipos de la base de datos SQLite (también se usan para Supabase) ──

export interface Cliente {
  id: number;
  nombre: string;
  email?: string;
  telefono?: string;
  movil?: string;
  pais?: string;
  calle?: string;
  piso?: string;
  ciudad?: string;
  cp?: string;
  provincia?: string;
  nif?: string;
  persona_contacto?: string;
  direccion?: string;
}

export interface Factura {
  id: number;
  numero: string;
  cliente_id: number | null;
  cliente_nombre?: string;
  subtotal: number;
  descuento: number;
  iva_porcentaje: number;
  iva_importe: number;
  irpf_porcentaje: number;
  irpf_importe: number;
  total: number;
  estado: string;
  fecha: string;
  fecha_vencimiento?: string;
  notas?: string;
  metodo_pago?: string;
  sync_status?: string;
  // Campos adicionales que pueden venir de Supabase (datos remotos)
  created_at?: string;
  items?: FacturaItem[];
}

export interface FacturaItem {
  id: number;
  factura_id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
}

export interface Albaran {
  id: number;
  numero: string;
  cliente_id: number | null;
  cliente_nombre?: string;
  subtotal: number;
  descuento: number;
  iva_porcentaje: number;
  iva_importe: number;
  irpf_porcentaje: number;
  irpf_importe: number;
  total: number;
  estado: string;
  fecha: string;
  fecha_entrega?: string;
  notas?: string;
  firma_data?: string;
  direccion_entrega?: string;
  sync_status?: string;
}

export interface AlbaranItem {
  id: number;
  albaran_id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
}

// Re-export Producto from productos.ts for convenience
export type { Producto } from './productos';
