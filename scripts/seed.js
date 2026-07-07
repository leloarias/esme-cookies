// Carga datos de ejemplo para ver la app funcionando (productos, promoción, tienda).
// Uso: node scripts/seed.js   ó   npm run seed
// Solo inserta si la base está vacía. Para reiniciar el demo, borrá data/esme.db.
require('dotenv').config();
const { initDatabase, prepare } = require('../src/db');

const productos = [
  { nombre: 'Galleta Chocolate Chip', precio: 120, descripcion: 'La clásica, con trozos de chocolate.', stock: null },
  { nombre: 'Galleta Avena y Pasas', precio: 100, descripcion: 'Suave, con avena y pasas.', stock: 8 },
  { nombre: 'Brownie de Nuez', precio: 150, descripcion: 'Húmedo e intenso, con nueces.', stock: 3 },
  { nombre: 'Galleta Red Velvet', precio: 140, descripcion: 'Terciopelo rojo con chispas blancas.', stock: 0 },
  { nombre: 'Alfajor de Maicena', precio: 90, descripcion: 'Relleno de dulce de leche.', stock: null },
  { nombre: 'Galleta de Limón', precio: 110, descripcion: 'Cítrica y fresca.', stock: 15 }
];

async function main() {
  await initDatabase();

  const count = await prepare('SELECT COUNT(*) as c FROM productos').get();
  if (Number(count.c) > 0) {
    console.log('ℹ️  Ya hay productos en la base; no se insertan datos de ejemplo.');
    console.log('   (Para reiniciar el demo: borrá data/esme.db y volvé a correr esto.)');
    process.exit(0);
  }

  for (const p of productos) {
    await prepare('INSERT INTO productos (nombre, precio, descripcion, imagen, stock) VALUES (?, ?, ?, ?, ?)')
      .run(p.nombre, p.precio, p.descripcion, '', p.stock);
  }

  await prepare('INSERT INTO promociones (titulo, descripcion, tipo, descuento_pct, activa, emoji, color) VALUES (?, ?, ?, ?, 1, ?, ?)')
    .run('10% en tu primer pedido', 'Descuento de bienvenida', 'descuento_pct', 10, '🎉', '#C9883A');

  await prepare('UPDATE config SET shopName = ?, shopPhone = ?, isOpen = 1 WHERE id = 1')
    .run('Esme Cookies', '8290000000');

  console.log('✅ Datos de ejemplo cargados: ' + productos.length + ' productos y 1 promoción.');
  console.log('   (Incluye un producto agotado y dos con stock bajo para ver el inventario.)');
  process.exit(0);
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
