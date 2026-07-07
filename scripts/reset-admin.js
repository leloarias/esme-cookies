// Resetea (o crea) la contraseña de un administrador en la base de datos actual
// (la que apunte el .env, ej. Turso en producción).
//
// Uso:
//   node scripts/reset-admin.js <usuario> <nueva_clave>
//   npm run reset-admin -- <usuario> <nueva_clave>
//
// Si no se pasan argumentos, usa ADMIN_USER / ADMIN_PASS del .env.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDatabase, prepare } = require('../src/db');

async function main() {
  const username = process.argv[2] || process.env.ADMIN_USER || 'admin';
  const password = process.argv[3] || process.env.ADMIN_PASS || 'admin123';

  await initDatabase();
  const hash = bcrypt.hashSync(password, 10);

  const existing = await prepare('SELECT id FROM administradores WHERE username = ?').get(username);
  if (existing) {
    await prepare('UPDATE administradores SET password_hash = ? WHERE username = ?').run(hash, username);
    console.log(`✅ Contraseña actualizada para el administrador "${username}".`);
  } else {
    await prepare('INSERT INTO administradores (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`✅ Administrador "${username}" creado.`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
