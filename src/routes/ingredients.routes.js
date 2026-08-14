const express = require('express');
const { verifyToken } = require('../middleware/auth');
const {
  getIngredients, createIngredient, updateIngredient, deleteIngredient,
  restockIngredient, adjustIngredient, getMovements, getSummary, getCostoVentas
} = require('../services/ingredients');

const router = express.Router();

router.get('/api/ingredients', verifyToken, async (req, res) => {
  try {
    res.json(await getIngredients());
  } catch (err) {
    console.error('Error en GET /api/ingredients:', err);
    res.status(500).json({ error: 'Error al obtener ingredientes' });
  }
});

router.get('/api/ingredients/summary', verifyToken, async (req, res) => {
  try {
    res.json(await getSummary());
  } catch (err) {
    console.error('Error en GET /api/ingredients/summary:', err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

router.get('/api/ingredients/cogs', verifyToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'Faltan start y end' });
    const costoVentas = await getCostoVentas(start, end);
    res.json({ costoVentas });
  } catch (err) {
    console.error('Error en GET /api/ingredients/cogs:', err);
    res.status(500).json({ error: 'Error al calcular costo de ventas' });
  }
});

router.get('/api/ingredients/movements', verifyToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    res.json(await getMovements(req.query.ingrediente_id, limit, offset));
  } catch (err) {
    console.error('Error en GET /api/ingredients/movements:', err);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

router.post('/api/ingredients', verifyToken, async (req, res) => {
  try {
    if (!req.body.nombre || !req.body.nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    const id = await createIngredient(req.body);
    res.json({ success: true, id });
  } catch (err) {
    console.error('Error en POST /api/ingredients:', err);
    res.status(500).json({ error: 'Error al crear ingrediente' });
  }
});

router.put('/api/ingredients/:id', verifyToken, async (req, res) => {
  try {
    const ok = await updateIngredient(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: 'Ingrediente no encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error en PUT /api/ingredients/:id:', err);
    res.status(500).json({ error: 'Error al actualizar ingrediente' });
  }
});

router.delete('/api/ingredients/:id', verifyToken, async (req, res) => {
  try {
    await deleteIngredient(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error en DELETE /api/ingredients/:id:', err);
    res.status(500).json({ error: 'Error al eliminar ingrediente' });
  }
});

// Reabastecer (compra): suma stock y promedia el costo unitario.
router.post('/api/ingredients/:id/restock', verifyToken, async (req, res) => {
  try {
    const { cantidad, costo_unitario, motivo } = req.body;
    await restockIngredient(req.params.id, cantidad, costo_unitario, motivo, req.username || 'admin');
    res.json({ success: true });
  } catch (err) {
    console.error('Error en POST /api/ingredients/:id/restock:', err);
    res.status(400).json({ error: err.message || 'Error al reabastecer' });
  }
});

// Ajuste manual al stock contado físicamente (para detectar fugas).
router.post('/api/ingredients/:id/adjust', verifyToken, async (req, res) => {
  try {
    const { stock, motivo } = req.body;
    if (stock === undefined) return res.status(400).json({ error: 'Falta "stock"' });
    await adjustIngredient(req.params.id, stock, motivo, req.username || 'admin');
    res.json({ success: true });
  } catch (err) {
    console.error('Error en POST /api/ingredients/:id/adjust:', err);
    res.status(400).json({ error: err.message || 'Error al ajustar' });
  }
});

module.exports = router;
