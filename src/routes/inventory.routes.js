const express = require('express');
const { prepare } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { getInventorySummary, logMovement, getMovements, getAllMovements } = require('../services/inventory');

const router = express.Router();

function parseStock(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v);
  return isNaN(n) ? null : Math.max(0, n);
}

router.get('/api/inventory', verifyToken, async (req, res) => {
  try {
    const products = await prepare('SELECT id, nombre, precio, stock, imagen FROM productos ORDER BY nombre').all();
    const threshold = await prepare('SELECT lowStockThreshold FROM config WHERE id = 1').get();
    const minStock = (threshold && threshold.lowStockThreshold) || 5;
    const result = products.map(p => ({
      ...p,
      stock: p.stock ?? null,
      sinControl: p.stock === null,
      estado: p.stock === null ? 'sin-control' : p.stock <= 0 ? 'agotado' : p.stock <= minStock ? 'bajo' : 'ok'
    }));
    res.json(result);
  } catch (err) {
    console.error('Error en GET /api/inventory:', err);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

router.get('/api/inventory/summary', verifyToken, async (req, res) => {
  try {
    const summary = await getInventorySummary();
    res.json(summary);
  } catch (err) {
    console.error('Error en GET /api/inventory/summary:', err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

router.get('/api/inventory/movements', verifyToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const productId = req.query.producto_id;
    let movements;
    if (productId) {
      movements = await getMovements(productId, limit, offset);
    } else {
      movements = await getAllMovements(limit, offset);
    }
    res.json(movements);
  } catch (err) {
    console.error('Error en GET /api/inventory/movements:', err);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

router.post('/api/inventory/adjust', verifyToken, async (req, res) => {
  const { producto_id, tipo, cantidad, motivo } = req.body;
  if (!producto_id || !tipo || cantidad === undefined) {
    return res.status(400).json({ error: 'Faltan datos: producto_id, tipo, cantidad' });
  }
  try {
    const product = await prepare('SELECT id, nombre, stock FROM productos WHERE id = ?').get(producto_id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    const anterior = product.stock ?? 0;
    const delta = parseInt(cantidad) || 0;
    let nuevo;
    if (tipo === 'entrada' || tipo === 'compra' || tipo === 'devolucion') {
      nuevo = anterior + Math.abs(delta);
    } else if (tipo === 'salida') {
      nuevo = Math.max(0, anterior - Math.abs(delta));
    } else if (tipo === 'ajuste') {
      nuevo = Math.max(0, Math.abs(delta));
    } else {
      nuevo = Math.max(0, delta);
    }
    await prepare('UPDATE productos SET stock = ? WHERE id = ?').run(nuevo, producto_id);
    await logMovement(producto_id, tipo, delta, anterior, nuevo, motivo || 'Ajuste manual', null, req.username || 'admin');
    res.json({ success: true, producto: product.nombre, stock_anterior: anterior, stock_nuevo: nuevo });
  } catch (err) {
    console.error('Error en POST /api/inventory/adjust:', err);
    res.status(500).json({ error: 'Error al ajustar stock' });
  }
});

router.get('/api/inventory/alerts', verifyToken, async (req, res) => {
  try {
    const config = await prepare('SELECT lowStockThreshold, inventoryAlertsEnabled FROM config WHERE id = 1').get();
    res.json({
      umbralMinimo: (config && config.lowStockThreshold) || 5,
      alertasActivas: (config && config.inventoryAlertsEnabled) !== 0
    });
  } catch (err) {
    console.error('Error en GET /api/inventory/alerts:', err);
    res.status(500).json({ error: 'Error al obtener config' });
  }
});

router.put('/api/inventory/alerts', verifyToken, async (req, res) => {
  const { umbralMinimo, alertasActivas } = req.body;
  try {
    if (umbralMinimo !== undefined) {
      await prepare('UPDATE config SET lowStockThreshold = ? WHERE id = 1').run(parseInt(umbralMinimo) || 5);
    }
    if (alertasActivas !== undefined) {
      await prepare('UPDATE config SET inventoryAlertsEnabled = ? WHERE id = 1').run(alertasActivas ? 1 : 0);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error en PUT /api/inventory/alerts:', err);
    res.status(500).json({ error: 'Error al actualizar config' });
  }
});

module.exports = router;
