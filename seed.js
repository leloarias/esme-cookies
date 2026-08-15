const { initDatabase, prepare } = require('./src/db');

async function seed() {
  await initDatabase();

  const countRow = await prepare('SELECT COUNT(*) as c FROM promociones').get();
  console.log('Promos actuales:', countRow.c);

  if (countRow.c === 0) {
    await prepare(`
      INSERT INTO promociones (titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, solo_clientes_leales, min_pedidos_leal, solo_cajas, color, emoji, imagen, orden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('¡Bienvenido! 10% OFF', '10% de descuento en tu primer pedido', 'banner', 10, 0, 'todos', '', 'todos', 0, 0, null, 0, '2025-01-01', '2030-12-31', null, null, 1, 1, 0, 3, 0, '#C9883A', '🎉', '', 0);

    await prepare(`
      INSERT INTO promociones (titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, solo_clientes_leales, min_pedidos_leal, solo_cajas, color, emoji, imagen, orden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('2x1 Jueves', 'Lleva 2 y paga 1 cada jueves', 'banner', 0, 0, 'productos', '', 'todos', 0, 0, null, 0, '2025-01-01', '2025-12-31', null, null, 0, 0, 0, 3, 0, '#C9883A', '🎉', '', 0);

    await prepare(`
      INSERT INTO promociones (titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, solo_clientes_leales, min_pedidos_leal, solo_cajas, color, emoji, imagen, orden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('⭐ Bienvenida 10%', '10% OFF para clientes nuevos', 'banner', 10, 0, 'orden', '', 'todos', 0, 0, null, 1, '2025-07-01', '2026-12-31', null, null, 1, 1, 0, 3, 0, '#C9883A', '🎉', '', 0);

    await prepare(`
      INSERT INTO promociones (titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, solo_clientes_leales, min_pedidos_leal, solo_cajas, color, emoji, imagen, orden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('👑 Cliente Fiel 15%', '15% OFF para clientes con 3+ pedidos', 'banner', 15, 0, 'orden', '', 'todos', 0, 0, null, 1, '2025-07-01', '2026-12-31', null, null, 0, 0, 1, 3, 0, '#C9883A', '👑', '', 0);

    console.log('4 promos insertadas');
  } else {
    console.log('Ya hay promos, actualizando activa=1 para promos 3 y 4...');
    await prepare('UPDATE promociones SET activa=1 WHERE id IN (3, 4)').run();
  }

  const rows = await prepare('SELECT id, titulo, activa, solo_clientes_nuevos, solo_clientes_leales, min_pedidos_leal FROM promociones').all();
  console.log('Promos en DB:');
  rows.forEach(r => console.log(' ', r.id, r.titulo, 'activa:', r.activa, 'nuevos:', r.solo_clientes_nuevos, 'leales:', r.solo_clientes_leales, 'min:', r.min_pedidos_leal));
}

seed().catch(console.error);