const express = require('express');
const { prepare } = require('../database');
const { verifyToken } = require('../auth');

const router = express.Router();

router.get('/api/promociones', async (req, res) => {
  try {
    const promosRaw = await prepare(`
      SELECT * FROM promociones
      WHERE activa = 1
      ORDER BY orden ASC, id DESC
    `).all();
    res.json(promosRaw);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener promociones' });
  }
});

router.get('/api/promociones/all', verifyToken, async (req, res) => {
  try {
    const promos = await prepare('SELECT * FROM promociones ORDER BY activa DESC, orden ASC, id DESC').all();
    res.json(promos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener promociones' });
  }
});

router.post('/api/promociones', verifyToken, async (req, res) => {
  const { titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, color, emoji, imagen, orden } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const info = await prepare(
      'INSERT INTO promociones (titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, color, emoji, imagen, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(titulo, descripcion || '', tipo || 'banner', descuento_pct || 0, descuento_fijo || 0, aplica_a || 'todos', productos_ids || '', categoria || 'todos', compra_minima || 0, cantidad_minima || 0, producto_gratis_id || null, activa !== false ? 1 : 0, fecha_inicio || '', fecha_fin || '', hora_inicio || null, hora_fin || null, limite_usos || null, solo_clientes_nuevos ? 1 : 0, color || '#C9883A', emoji || '🎉', imagen || '', orden || 0);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear promoción: ' + err.message });
  }
});

router.put('/api/promociones/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, color, emoji, imagen, orden } = req.body;
  try {
    const current = await prepare('SELECT activa FROM promociones WHERE id = ?').get(id);
    const willBeActive = activa ? 1 : 0;

    if (current && current.activa == 0 && willBeActive == 1) {
      await prepare('UPDATE promociones SET usos_actuales = 0 WHERE id = ?').run(id);
    }

    await prepare(
      'UPDATE promociones SET titulo=?, descripcion=?, tipo=?, descuento_pct=?, descuento_fijo=?, aplica_a=?, productos_ids=?, categoria=?, compra_minima=?, cantidad_minima=?, producto_gratis_id=?, activa=?, fecha_inicio=?, fecha_fin=?, hora_inicio=?, hora_fin=?, limite_usos=?, solo_clientes_nuevos=?, color=?, emoji=?, imagen=?, orden=? WHERE id=?'
    ).run(titulo, descripcion || '', tipo || 'banner', descuento_pct || 0, descuento_fijo || 0, aplica_a || 'todos', productos_ids || '', categoria || 'todos', compra_minima || 0, cantidad_minima || 0, producto_gratis_id || null, willBeActive, fecha_inicio || '', fecha_fin || '', hora_inicio || '', hora_fin || '', limite_usos || null, solo_clientes_nuevos ? 1 : 0, color || '#C9883A', emoji || '🎉', imagen || '', orden || 0, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar promoción: ' + err.message });
  }
});

router.delete('/api/promociones/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    await prepare('DELETE FROM promociones WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar promoción' });
  }
});

module.exports = router;
