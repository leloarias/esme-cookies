const { createClient } = require('@libsql/client');

let db = null;

async function initDatabase() {
  const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN || '';

  db = createClient({
    url,
    authToken
  });

  // Crear tablas
  await db.execute(`
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      precio REAL NOT NULL,
      descripcion TEXT,
      imagen TEXT
    )
  `);

  await db.execute(`
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS administradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  await db.execute(`
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

  await db.execute(`
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

  // Inicializar config si está vacía
  const configCount = await db.execute('SELECT COUNT(*) as count FROM config');
  if (Number(configCount.rows[0].count) === 0) {
    await db.execute({
      sql: 'INSERT INTO config (id, pickupAddress, deliveryPrice, envioPrice) VALUES (1, ?, ?, ?)',
      args: ['Calle Principal #1, San Juan', 50, 100]
    });
  }

  // Inicializar admin por defecto si no existe
  const adminCount = await db.execute('SELECT COUNT(*) as count FROM administradores');
  if (Number(adminCount.rows[0].count) === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(process.env.ADMIN_PASS || 'admin123', 10);
    await db.execute({
      sql: 'INSERT INTO administradores (username, password_hash) VALUES (?, ?)',
      args: [process.env.ADMIN_USER || 'admin', hash]
    });
    console.log('[DB] Admin creado: ' + (process.env.ADMIN_USER || 'admin'));
  }

  return db;
}

// Capa de compatibilidad: emula prepare() de sql.js pero con async
function prepare(sql) {
  return {
    async get(...params) {
      const args = params.length > 0 ? (Array.isArray(params[0]) ? params[0] : params) : [];
      const result = await db.execute({ sql, args });
      return result.rows.length > 0 ? result.rows[0] : undefined;
    },
    async all(...params) {
      const args = params.length > 0 ? (Array.isArray(params[0]) ? params[0] : params) : [];
      const result = await db.execute({ sql, args });
      return result.rows;
    },
    async run(...params) {
      const args = params.length > 0 ? (Array.isArray(params[0]) ? params[0] : params) : [];
      const result = await db.execute({ sql, args });
      return {
        lastInsertRowid: Number(result.lastInsertRowid) || 0,
        changes: result.rowsAffected || 0
      };
    }
  };
}

async function exec(sql) {
  await db.execute(sql);
}

module.exports = {
  initDatabase,
  prepare,
  exec,
  saveDatabase: () => {},
  getDb: () => db
};
