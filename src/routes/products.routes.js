const express = require('express');
const { prepare } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Normaliza el valor de stock: vacío/ausente => null (sin control de inventario).
function parseStock(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v);
  return isNaN(n) ? null : Math.max(0, n);
}

router.get('/api/products', async (req, res) => {
  try {
    const products = await prepare('SELECT * FROM productos').all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

router.post('/api/products', verifyToken, async (req, res) => {
  const { nombre, precio, descripcion, imagen, stock } = req.body;
  if (!nombre || !precio) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const info = await prepare('INSERT INTO productos (nombre, precio, descripcion, imagen, stock) VALUES (?, ?, ?, ?, ?)')
      .run(nombre, precio, descripcion || '', imagen || '', parseStock(stock));
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar producto' });
  }
});

router.put('/api/products/:id', verifyToken, async (req, res) => {
  const { nombre, precio, descripcion, imagen } = req.body;
  const id = req.params.id;
  try {
    const current = await prepare('SELECT * FROM productos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Producto no encontrado' });

    // Si viene 'stock' en el body se actualiza (vacío = sin control); si no, se conserva.
    const stockVal = ('stock' in req.body) ? parseStock(req.body.stock) : current.stock;

    await prepare('UPDATE productos SET nombre = ?, precio = ?, descripcion = ?, imagen = ?, stock = ? WHERE id = ?')
      .run(nombre || current.nombre, precio || current.precio, descripcion || '', imagen || '', stockVal, id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'Error al actualizar producto: ' + err.message });
  }
});

router.delete('/api/products/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    await prepare('DELETE FROM productos WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;
