const express = require('express');
const { prepare } = require('../database');
const { verifyToken } = require('../auth');

const router = express.Router();

router.get('/api/products', async (req, res) => {
  try {
    const products = await prepare('SELECT * FROM productos').all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

router.post('/api/products', verifyToken, async (req, res) => {
  const { nombre, precio, descripcion, imagen } = req.body;
  if (!nombre || !precio) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const info = await prepare('INSERT INTO productos (nombre, precio, descripcion, imagen) VALUES (?, ?, ?, ?)')
      .run(nombre, precio, descripcion || '', imagen || '');
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

    await prepare('UPDATE productos SET nombre = ?, precio = ?, descripcion = ?, imagen = ? WHERE id = ?')
      .run(nombre || current.nombre, precio || current.precio, descripcion || '', imagen || '', id);
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
