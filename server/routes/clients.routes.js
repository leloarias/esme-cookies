const express = require('express');
const { prepare } = require('../database');
const { verifyToken } = require('../auth');
const { normalizePhone } = require('../utils/helpers');
const { recalcularClientes } = require('../services/clients');

const router = express.Router();

// Recalcular totales de clientes desde pedidos reales
router.post('/api/clientes/recalcular', verifyToken, async (req, res) => {
  try {
    const { actualizados, creados, eliminados } = await recalcularClientes();
    res.json({ success: true, actualizados, creados, eliminados });
  } catch (err) {
    console.error('Error recalculando clientes:', err);
    res.status(500).json({ error: 'Error al recalcular' });
  }
});

router.get('/api/clientes', verifyToken, async (req, res) => {
  try {
    const clientes = await prepare('SELECT * FROM clientes WHERE activo = 1 ORDER BY total_gastado DESC').all();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

router.get('/api/clientes/all', verifyToken, async (req, res) => {
  try {
    const clientes = await prepare('SELECT * FROM clientes ORDER BY total_gastado DESC').all();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

router.get('/api/clientes/buscar', verifyToken, async (req, res) => {
  const q = req.query.q || '';
  try {
    const clientes = await prepare('SELECT * FROM clientes WHERE activo = 1 AND (nombre LIKE ? OR telefono LIKE ?) ORDER BY total_gastado DESC LIMIT 20')
      .all(`%${q}%`, `%${q}%`);
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar clientes' });
  }
});

router.post('/api/clientes/:id/reactivar', verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    await prepare('UPDATE clientes SET activo = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al reactivar cliente' });
  }
});

router.put('/api/clientes/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { nombre, telefono, email, direccion, sector, notas, activo } = req.body;
  try {
    const telNorm = normalizePhone(telefono);
    await prepare('UPDATE clientes SET nombre=?, telefono=?, email=?, direccion=?, sector=?, notas=?, activo=? WHERE id=?')
      .run(nombre, telNorm, email || '', direccion || '', sector || '', notas || '', activo !== undefined ? activo : 1, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

router.delete('/api/clientes/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const hardDelete = req.query.hard === 'true';
  try {
    if (hardDelete) {
      await prepare('DELETE FROM clientes WHERE id = ?').run(id);
    } else {
      await prepare('UPDATE clientes SET activo = 0 WHERE id = ?').run(id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

router.post('/api/clientes', verifyToken, async (req, res) => {
  const { nombre, telefono, email, direccion, sector, notas } = req.body;
  if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
  try {
    const info = await prepare('INSERT INTO clientes (nombre, telefono, email, direccion, sector, notas) VALUES (?, ?, ?, ?, ?, ?)')
      .run(nombre, telefono, email || '', direccion || '', sector || '', notas || '');
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

router.get('/api/clientes/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const cliente = await prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    console.error('Error getting cliente:', err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

module.exports = router;
