const express = require('express');
const { prepare } = require('../db');
const { verifyToken } = require('../middleware/auth');

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
  const { titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, solo_clientes_leales, min_pedidos_leal, solo_cajas, color, emoji, imagen, orden } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const info = await prepare(
      'INSERT INTO promociones (titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, solo_clientes_leales, min_pedidos_leal, solo_cajas, color, emoji, imagen, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(titulo, descripcion || '', tipo || 'banner', descuento_pct || 0, descuento_fijo || 0, aplica_a || 'todos', productos_ids || '', categoria || 'todos', compra_minima || 0, cantidad_minima || 0, producto_gratis_id || null, activa !== false ? 1 : 0, fecha_inicio || '', fecha_fin || '', hora_inicio || null, hora_fin || null, limite_usos || null, solo_clientes_nuevos ? 1 : 0, solo_clientes_leales ? 1 : 0, parseInt(min_pedidos_leal) || 3, solo_cajas ? 1 : 0, color || '#C9883A', emoji || '🎉', imagen || '', orden || 0);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear promoción: ' + err.message });
  }
});

router.put('/api/promociones/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, solo_clientes_leales, min_pedidos_leal, solo_cajas, color, emoji, imagen, orden } = req.body;
  try {
    const current = await prepare('SELECT activa FROM promociones WHERE id = ?').get(id);
    const willBeActive = activa ? 1 : 0;

    if (current && current.activa == 0 && willBeActive == 1) {
      await prepare('UPDATE promociones SET usos_actuales = 0 WHERE id = ?').run(id);
    }

    await prepare(
      'UPDATE promociones SET titulo=?, descripcion=?, tipo=?, descuento_pct=?, descuento_fijo=?, aplica_a=?, productos_ids=?, categoria=?, compra_minima=?, cantidad_minima=?, producto_gratis_id=?, activa=?, fecha_inicio=?, fecha_fin=?, hora_inicio=?, hora_fin=?, limite_usos=?, solo_clientes_nuevos=?, solo_clientes_leales=?, min_pedidos_leal=?, solo_cajas=?, color=?, emoji=?, imagen=?, orden=? WHERE id=?'
    ).run(titulo, descripcion || '', tipo || 'banner', descuento_pct || 0, descuento_fijo || 0, aplica_a || 'todos', productos_ids || '', categoria || 'todos', compra_minima || 0, cantidad_minima || 0, producto_gratis_id || null, willBeActive, fecha_inicio || '', fecha_fin || '', hora_inicio || '', hora_fin || '', limite_usos || null, solo_clientes_nuevos ? 1 : 0, solo_clientes_leales ? 1 : 0, parseInt(min_pedidos_leal) || 3, solo_cajas ? 1 : 0, color || '#C9883A', emoji || '🎉', imagen || '', orden || 0, id);
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

// Validar qué promos aplican para un teléfono (sin auth - para el cliente en la tienda)
router.post('/api/validate-promo', async (req, res) => {
  const { telefono } = req.body;
  if (!telefono) return res.status(400).json({ error: 'Teléfono requerido' });

  try {
    // Normalizar teléfono y buscar cliente
    const telNorm = telefono.replace(/\D/g, '');
    const clienteRow = await prepare('SELECT total_pedidos FROM clientes WHERE telefono = ?').get(telefono);
    const clientePedidos = clienteRow ? (clienteRow.total_pedidos || 0) : 0;

    // Obtener todas las promos activas
    const now = new Date();
    const drTime = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santo_Domingo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(now);
    const parts = drTime.split(/[\s,]+/);
    const currentDate = parts[0];
    const currentTime = parts[1] ? parts[1].substring(0, 5) : '00:00';

    const promos = await prepare('SELECT * FROM promociones WHERE activa = 1').all();
    const resultados = [];

    for (const promo of promos) {
      // Verificar límites de uso
      if (promo.limite_usos && promo.limite_usos > 0) {
        const usosActuales = promo.usos_actuales || 0;
        if (usosActuales >= promo.limite_usos) {
          resultados.push({ id: promo.id, titulo: promo.titulo, aplica: false, razon: 'Límite de usos agotado', tipo: promo.tipo });
          continue;
        }
      }

      // Verificar fechas
      if (promo.fecha_inicio && promo.fecha_inicio > currentDate) {
        resultados.push({ id: promo.id, titulo: promo.titulo, aplica: false, razon: 'Aplica desde ' + promo.fecha_inicio, tipo: promo.tipo });
        continue;
      }
      if (promo.fecha_fin && promo.fecha_fin < currentDate) {
        resultados.push({ id: promo.id, titulo: promo.titulo, aplica: false, razon: 'Venció el ' + promo.fecha_fin, tipo: promo.tipo });
        continue;
      }

      // Verificar horario
      if (promo.hora_inicio && promo.hora_inicio > currentTime) {
        resultados.push({ id: promo.id, titulo: promo.titulo, aplica: false, razon: 'Activa a las ' + promo.hora_inicio, tipo: promo.tipo });
        continue;
      }
      if (promo.hora_fin && promo.hora_fin < currentTime) {
        resultados.push({ id: promo.id, titulo: promo.titulo, aplica: false, razon: 'Finalizó a las ' + promo.hora_fin, tipo: promo.tipo });
        continue;
      }

      // Verificar si es solo para clientes nuevos
      if (promo.solo_clientes_nuevos) {
        if (clientePedidos > 0) {
          resultados.push({ id: promo.id, titulo: promo.titulo, aplica: false, razon: 'Solo para nuevos clientes (' + clientePedidos + ' pedidos previos)', tipo: promo.tipo });
          continue;
        }
        resultados.push({ id: promo.id, titulo: promo.titulo, aplica: true, razon: '¡Aplicas! Eres cliente nuevo', tipo: promo.tipo });
        continue;
      }

      // Verificar si es solo para clientes leales
      if (promo.solo_clientes_leales) {
        const minPedidos = promo.min_pedidos_leal || 3;
        if (clientePedidos < minPedidos) {
          resultados.push({ id: promo.id, titulo: promo.titulo, aplica: false, razon: 'Necesitas ' + minPedidos + '+ pedidos (tienes ' + clientePedidos + ')', tipo: promo.tipo });
          continue;
        }
        resultados.push({ id: promo.id, titulo: promo.titulo, aplica: true, razon: '¡Aplicas! Tienes ' + clientePedidos + ' pedidos', tipo: promo.tipo });
        continue;
      }

      // Promo general (no tiene restricción de cliente)
      resultados.push({ id: promo.id, titulo: promo.titulo, aplica: true, razon: '¡Disponible para ti!', tipo: promo.tipo });
    }

    res.json({ telefono: telefono, pedidos_previos: clientePedidos, promos: resultados });
  } catch (err) {
    console.error('Error validando promos:', err);
    res.status(500).json({ error: 'Error al validar promociones' });
  }
});

module.exports = router;
