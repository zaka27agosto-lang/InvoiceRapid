import { Platform } from 'react-native';

// Solo importar SQLite en plataformas nativas
let db: any = null;
let SQLite: any = null;

if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
  db = SQLite.openDatabaseSync('facturas2.db');
}

export function initDB() {
  // No inicializar SQLite en web
  if (Platform.OS === 'web' || !db) {
    console.log('SQLite no está disponible en web');
    return;
  }

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
      notas TEXT,
      metodo_pago TEXT DEFAULT 'efectivo',
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
  `);
}

export default db;