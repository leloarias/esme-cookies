const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

async function initDatabase() {
  // Base de datos local únicamente (SQLite vía better-sqlite3). Se eligió
  // sobre @libsql/client porque su binario nativo (compilado en Rust) crashea
  // con "Illegal instruction" al escribir en CPUs viejas sin AVX/SSE4.2
  // (confirmado en el servidor de producción, un Core 2 Duo de 2007).
  // better-sqlite3 usa la librería C de SQLite, mucho más portable.
  const url = process.env.DATABASE_URL || 'file:data/esme.db';
  if (!url.startsWith('file:')) {
    throw new Error('DATABASE_URL debe ser un archivo local ("file:ruta"). Las conexiones remotas (Turso) ya no son compatibles con este servidor.');
  }
  const filePath = url.slice('file:'.length);
  const dir = path.dirname(filePath);
  if (dir && dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(filePath);
  db.pragma('journal_mode = WAL');

  // Crear tablas
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      pickupAddress TEXT,
      deliveryPrice REAL,
      envioPrice REAL,
      emailUser TEXT,
      emailPass TEXT,
      adminEmail TEXT,
      emailHost TEXT DEFAULT 'smtp.gmail.com',
      emailPort INTEGER DEFAULT 465,
      emailSecure INTEGER DEFAULT 1,
      shopName TEXT DEFAULT 'Esme Cookies',
      shopPhone TEXT DEFAULT '',
      currency TEXT DEFAULT 'RD$',
      primaryColor TEXT DEFAULT '#2C1810',
      accentColor TEXT DEFAULT '#C9883A',
      isOpen INTEGER DEFAULT 1,
      emailTemplate TEXT,
      emailNotifications INTEGER DEFAULT 1,
      bankAccounts TEXT DEFAULT '[]',
      lastOrderNumber INTEGER DEFAULT 0,
      msgEsperandoPago TEXT,
      msgPagoConfirmado TEXT,
      msgPreparando TEXT,
      msgListo TEXT,
      msgEntregado TEXT,
      msgCancelado TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      precio REAL NOT NULL,
      descripcion TEXT,
      imagen TEXT,
      stock INTEGER
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER UNIQUE,
      fecha TEXT,
      cliente TEXT NOT NULL,
      telefono TEXT NOT NULL,
      productos TEXT NOT NULL,
      cantidad INTEGER,
      precio REAL,
      subtotal REAL,
      descuento REAL DEFAULT 0,
      descuento_detalles TEXT,
      envio REAL,
      total REAL,
      pago TEXT,
      estado TEXT DEFAULT 'Pendiente',
      observaciones TEXT,
      tipo_entrega TEXT,
      estado_timestamps TEXT,
      direccion TEXT,
      sector TEXT,
      nota TEXT,
      promociones_aplicadas TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS administradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS promociones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      tipo TEXT DEFAULT 'banner',
      descuento_pct REAL DEFAULT 0,
      descuento_fijo REAL DEFAULT 0,
      aplica_a TEXT DEFAULT 'todos',
      productos_ids TEXT,
      categoria TEXT DEFAULT 'todos',
      compra_minima REAL DEFAULT 0,
      cantidad_minima INTEGER DEFAULT 0,
      producto_gratis_id INTEGER,
      activa INTEGER DEFAULT 1,
      fecha_inicio TEXT,
      fecha_fin TEXT,
      limite_usos INTEGER,
      usos_actuales INTEGER DEFAULT 0,
      solo_clientes_nuevos INTEGER DEFAULT 0,
      color TEXT DEFAULT '#C9883A',
      emoji TEXT DEFAULT '🎉',
      imagen TEXT,
      orden INTEGER DEFAULT 0,
      hora_inicio TEXT,
      hora_fin TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      email TEXT,
      direccion TEXT,
      sector TEXT,
      total_pedidos INTEGER DEFAULT 0,
      total_gastado REAL DEFAULT 0,
      total_descuentos REAL DEFAULT 0,
      ultimo_pedido TEXT,
      notas TEXT,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'ajuste',
      cantidad INTEGER NOT NULL,
      stock_anterior INTEGER,
      stock_nuevo INTEGER,
      motivo TEXT,
      referencia TEXT,
      created_by TEXT DEFAULT 'sistema',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      unidad TEXT NOT NULL DEFAULT 'g',
      stock REAL DEFAULT 0,
      costo_unitario REAL DEFAULT 0,
      stock_minimo REAL DEFAULT 0,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS movimientos_ingredientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingrediente_id INTEGER NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'ajuste',
      cantidad REAL NOT NULL,
      stock_anterior REAL,
      stock_nuevo REAL,
      costo_total REAL DEFAULT 0,
      motivo TEXT,
      referencia TEXT,
      created_by TEXT DEFAULT 'sistema',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id)
    )
  `);

  // Migraciones para bases de datos ya existentes (columnas agregadas después).
  ensureColumn('productos', 'stock', 'INTEGER');
  ensureColumn('config', 'lowStockThreshold', 'INTEGER DEFAULT 5');
  ensureColumn('config', 'inventoryAlertsEnabled', 'INTEGER DEFAULT 1');
  ensureColumn('config', 'customBoxConfig', 'TEXT');
  ensureColumn('productos', 'tipo', "TEXT DEFAULT 'producto'");
  ensureColumn('productos', 'box_config', 'TEXT');
  ensureColumn('config', 'envioZones', "TEXT DEFAULT '[]'");
  ensureColumn('config', 'categoryImages', "TEXT DEFAULT '[]'");
  ensureColumn('productos', 'categoria', "TEXT DEFAULT 'Galletas'");
  ensureColumn('productos', 'receta', "TEXT DEFAULT '[]'");
  ensureColumn('ingredientes', 'alerta_enviada', 'INTEGER DEFAULT 0');
  ensureColumn('ingredientes', 'tamano_paquete', 'REAL DEFAULT 0');
  ensureColumn('pedidos', 'comprobante_url', 'TEXT');
  ensureColumn('pedidos', 'fecha_entrega', 'TEXT');

  // Inicializar config si está vacía
  const configCount = db.prepare('SELECT COUNT(*) as count FROM config').get();
  if (Number(configCount.count) === 0) {
    db.prepare('INSERT INTO config (id, pickupAddress, deliveryPrice, envioPrice) VALUES (1, ?, ?, ?)')
      .run('Calle Principal #1, San Juan', 50, 100);
  }

  // Migración: cifrar emailPass si quedó guardado en texto plano de antes de
  // este cambio (ver src/utils/crypto.js). Sin esto, la contraseña de la app
  // de Gmail queda legible por cualquiera que abra el archivo de la base de datos.
  const { encrypt } = require('../utils/crypto');
  const currentConfig = db.prepare('SELECT emailPass FROM config WHERE id = 1').get();
  const currentEmailPass = currentConfig && currentConfig.emailPass;
  if (currentEmailPass && !String(currentEmailPass).startsWith('enc1:')) {
    db.prepare('UPDATE config SET emailPass = ? WHERE id = 1').run(encrypt(currentEmailPass));
    console.log('[DB] Migración: emailPass cifrado en reposo');
  }

  // Asegurar que exista el producto "Caja Personalizada"
  const boxExists = db.prepare('SELECT COUNT(*) as c FROM productos WHERE id = 7').get();
  if (Number(boxExists.c) === 0) {
    db.prepare("INSERT INTO productos (id, nombre, precio, descripcion, stock, tipo, box_config) VALUES (7, ?, ?, ?, NULL, 'caja', ?)")
      .run('Caja Personalizada', 0, 'Selecciona tus galletas favoritas', JSON.stringify({ sizes: [6, 12, 24], allowedProducts: [] }));
    console.log('[DB] Producto "Caja Personalizada" creado');
  }

  // Migraciones
  ensureColumn('promociones', 'solo_cajas', 'INTEGER DEFAULT 0');
  // Promos para clientes leales (con N o más pedidos previos)
  ensureColumn('promociones', 'solo_clientes_leales', 'INTEGER DEFAULT 0');
  ensureColumn('promociones', 'min_pedidos_leal', 'INTEGER DEFAULT 3');

  // Inicializar admin por defecto si no existe. Sin contraseña hardcodeada:
  // si no se definió ADMIN_PASS en el .env, se genera una al azar y se
  // imprime una única vez (no se puede volver a mostrar después).
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM administradores').get();
  if (Number(adminCount.count) === 0) {
    const bcrypt = require('bcryptjs');
    const username = process.env.ADMIN_USER || 'admin';
    let password = process.env.ADMIN_PASS;
    const wasGenerated = !password;
    if (wasGenerated) {
      password = require('crypto').randomBytes(9).toString('base64url');
    }
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO administradores (username, password_hash) VALUES (?, ?)').run(username, hash);
    if (wasGenerated) {
      console.log('═══════════════════════════════════════════════');
      console.log(`[DB] Admin creado: usuario "${username}"`);
      console.log(`[DB] Contraseña generada (guárdala ya, no se vuelve a mostrar): ${password}`);
      console.log('═══════════════════════════════════════════════');
    } else {
      console.log('[DB] Admin creado: ' + username);
    }
  }

  return db;
}

// Capa de compatibilidad: expone la misma API async que usaba el driver
// anterior (@libsql/client) para no tener que tocar el resto del código.
// better-sqlite3 es síncrono por dentro; se envuelve en funciones async.
function prepare(sql) {
  const stmt = () => db.prepare(sql);
  return {
    async get(...params) {
      const args = params.length > 0 ? (Array.isArray(params[0]) ? params[0] : params) : [];
      return stmt().get(...args);
    },
    async all(...params) {
      const args = params.length > 0 ? (Array.isArray(params[0]) ? params[0] : params) : [];
      return stmt().all(...args);
    },
    async run(...params) {
      const args = params.length > 0 ? (Array.isArray(params[0]) ? params[0] : params) : [];
      const result = stmt().run(...args);
      return {
        lastInsertRowid: Number(result.lastInsertRowid) || 0,
        changes: result.changes || 0
      };
    }
  };
}

async function exec(sql) {
  db.exec(sql);
}

// Agrega una columna a una tabla si todavía no existe (migración idempotente).
function ensureColumn(table, column, definition) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = info.some(r => r.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[DB] Migración: columna ${table}.${column} agregada`);
  }
}

module.exports = {
  initDatabase,
  prepare,
  exec,
  saveDatabase: () => {},
  getDb: () => db
};
