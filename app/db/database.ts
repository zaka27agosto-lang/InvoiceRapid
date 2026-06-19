import { Platform } from 'react-native';

// Solo importar SQLite en plataformas nativas
let db: any = null;
let SQLite: any = null;

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SQLite = require('expo-sqlite');
  db = SQLite.openDatabaseSync('facturas2.db');
}

/**
 * Elimina TODOS los datos de la BD local.
 * Se llama cuando se detecta un cambio de usuario (logout + login con otra cuenta)
 * para evitar fugas de datos entre cuentas.
 *
 * @returns true si la BD quedó vacía, false si algo falló
 */
export function clearAllData(): boolean {
  if (!db) return false;
  try {
    db.execSync(`
      DELETE FROM factura_items;
      DELETE FROM facturas;
      DELETE FROM albaran_items;
      DELETE FROM albaranes;
      DELETE FROM clientes;
      DELETE FROM productos;
    `);

    // 🔍 Verificar que todas las tablas quedaron vacías.
    // Si clearAllData falla silenciosamente (BD bloqueada, corrupta),
    // los datos de la cuenta anterior sobreviven y acaban subiéndose
    // a la nube de la nueva cuenta en el siguiente auto-sync.
    const remaining = db.getFirstSync(`
      SELECT
        (SELECT COUNT(*) FROM facturas) +
        (SELECT COUNT(*) FROM factura_items) +
        (SELECT COUNT(*) FROM clientes) +
        (SELECT COUNT(*) FROM productos) +
        (SELECT COUNT(*) FROM albaranes) +
        (SELECT COUNT(*) FROM albaran_items) AS total
    `) as { total: number } | null;

    return (remaining?.total ?? 999) === 0;
  } catch (error) {
    return false;
  }
}

export function initDB() {
  // No inicializar SQLite en web
  if (Platform.OS === 'web' || !db) {
    return;
  }

  db.execSync('PRAGMA foreign_keys = ON;');
  db.execSync(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT,
      telefono TEXT,
      movil TEXT,
      pais TEXT,
      calle TEXT,
      piso TEXT,
      ciudad TEXT,
      cp TEXT,
      provincia TEXT,
      nif TEXT,
      persona_contacto TEXT,
      direccion TEXT
    );

    CREATE TABLE IF NOT EXISTS facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      cliente_id INTEGER,
      cliente_nombre TEXT,
      subtotal REAL DEFAULT 0,
      descuento REAL DEFAULT 0,
      iva_porcentaje REAL DEFAULT 21,
      iva_importe REAL DEFAULT 0,
      irpf_porcentaje REAL DEFAULT 0,
      irpf_importe REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      estado TEXT DEFAULT 'no_enviada',
      fecha TEXT DEFAULT (datetime('now')),
      fecha_vencimiento TEXT,
      fecha_entrega TEXT,
      notas TEXT,
      metodo_pago TEXT DEFAULT 'efectivo',
      sync_status TEXT DEFAULT 'pending',
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    );

    CREATE TABLE IF NOT EXISTS factura_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factura_id INTEGER NOT NULL,
      descripcion TEXT,
      cantidad REAL DEFAULT 1,
      unidad TEXT DEFAULT 'ud',
      precio_unitario REAL DEFAULT 0,
      descuento REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      FOREIGN KEY (factura_id) REFERENCES facturas(id)
    );

    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descripcion TEXT NOT NULL,
      precio REAL NOT NULL DEFAULT 0,
      unidad TEXT DEFAULT 'ud',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS albaranes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      cliente_id INTEGER,
      cliente_nombre TEXT,
      subtotal REAL DEFAULT 0,
      descuento REAL DEFAULT 0,
      iva_porcentaje REAL DEFAULT 21,
      iva_importe REAL DEFAULT 0,
      irpf_porcentaje REAL DEFAULT 0,
      irpf_importe REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      estado TEXT DEFAULT 'pendiente',
      fecha TEXT DEFAULT (datetime('now')),
      fecha_entrega TEXT,
      notas TEXT,
      firma_data TEXT,
      direccion_entrega TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'pending',
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    );

    CREATE TABLE IF NOT EXISTS albaran_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      albaran_id INTEGER NOT NULL,
      descripcion TEXT,
      cantidad REAL DEFAULT 1,
      unidad TEXT DEFAULT 'ud',
      precio_unitario REAL DEFAULT 0,
      descuento REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      FOREIGN KEY (albaran_id) REFERENCES albaranes(id)
    );

  `);

  // Migration: add firma_data column if it doesn't exist yet (for existing databases)
  try {
    db.execSync('ALTER TABLE albaranes ADD COLUMN firma_data TEXT;');
  } catch {
    // Column already exists, ignore
  }

  // Migration: add direccion_entrega column if it doesn't exist yet
  try {
    db.execSync('ALTER TABLE albaranes ADD COLUMN direccion_entrega TEXT DEFAULT \'\';');
  } catch (_) {
    // Column already exists, ignore
  }

  // Migration: add sync_status column if it doesn't exist yet
  try {
    db.execSync('ALTER TABLE albaranes ADD COLUMN sync_status TEXT DEFAULT \'pending\';');
  } catch (_) {
    // Column already exists, ignore
  }

  // Migration: add sync_status column to facturas if it doesn't exist yet
  try {
    db.execSync('ALTER TABLE facturas ADD COLUMN sync_status TEXT DEFAULT \'pending\';');
  } catch (_) {
    // Column already exists, ignore
  }

  // Migration: add fecha_entrega column to facturas if it doesn't exist yet
  try {
    db.execSync('ALTER TABLE facturas ADD COLUMN fecha_entrega TEXT;');
  } catch (_) {
    // Column already exists, ignore
  }
}

export default db;