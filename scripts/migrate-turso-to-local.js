// Trae todos los datos de una base Turso (la que usaba el deploy viejo de
// Render) a la base local del proyecto, para dejar de depender de Turso y
// que todo corra en el propio servidor (excepto el túnel/dominio).
//
// No toca el DATABASE_URL normal del .env: la base ORIGEN se pasa aparte,
// por variables de entorno separadas, así el token de Turso no queda
// guardado en ningún archivo del repo.
//
// Uso (Linux/Mac/OMV):
//   SOURCE_DATABASE_URL=libsql://tu-base.turso.io \
//   SOURCE_DATABASE_AUTH_TOKEN=tu-token \
//   node scripts/migrate-turso-to-local.js
//
// Uso (PowerShell en Windows):
//   $env:SOURCE_DATABASE_URL="libsql://tu-base.turso.io"
//   $env:SOURCE_DATABASE_AUTH_TOKEN="tu-token"
//   node scripts/migrate-turso-to-local.js
//
// El destino es el DATABASE_URL normal del .env (por defecto file:data/esme.db).
require('dotenv').config();
const { createClient } = require('@libsql/client');
const { initDatabase, getDb } = require('../src/db');

// Orden pensado para que las tablas que otras referencian (productos,
// administradores, clientes) se copien antes que las que dependen de ellas
// (movimientos_stock, movimientos_ingredientes). SQLite no fuerza esto acá,
// pero mantiene los datos consistentes si algún día se activan FKs.
const TABLAS = [
  'config',
  'productos',
  'administradores',
  'clientes',
  'ingredientes',
  'pedidos',
  'promociones',
  'movimientos_stock',
  'movimientos_ingredientes'
];

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const sourceToken = process.env.SOURCE_DATABASE_AUTH_TOKEN;
  if (!sourceUrl) {
    console.error('Falta SOURCE_DATABASE_URL (la base de Turso de donde migrar).');
    process.exit(1);
  }

  // Prepara el destino con el mismo esquema/migraciones que usa la app
  // (crea tablas y siembra un admin/config/caja por defecto si está vacío).
  await initDatabase();
  const target = getDb();

  const source = createClient({ url: sourceUrl, authToken: sourceToken || '' });

  console.log('Origen:', sourceUrl);
  console.log('Destino:', process.env.DATABASE_URL || 'file:data/esme.db');
  console.log('');

  for (const tabla of TABLAS) {
    let filas;
    try {
      filas = (await source.execute(`SELECT * FROM ${tabla}`)).rows;
    } catch (e) {
      console.log(`- ${tabla}: no existe en el origen, se salta (${e.message})`);
      continue;
    }

    if (filas.length === 0) {
      console.log(`- ${tabla}: 0 filas en el origen, nada que copiar`);
      continue;
    }

    // Vacía lo que initDatabase() haya sembrado por defecto en esa tabla,
    // para que los datos reales de Turso no choquen con IDs ya usados.
    await target.execute(`DELETE FROM ${tabla}`);

    const columnas = Object.keys(filas[0]);
    const placeholders = columnas.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${placeholders})`;

    for (const fila of filas) {
      await target.execute({ sql, args: columnas.map((c) => fila[c]) });
    }
    console.log(`- ${tabla}: ${filas.length} filas migradas`);
  }

  console.log('\nListo. Revisá con la app (o con scripts/check-cajas.js) que los datos se vean bien.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error migrando:', err);
  process.exit(1);
});
