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
    // Si la petición es del admin (?all=1 o con token), devuelve TODOS los productos (incluyendo desactivados)
    // Si es del cliente público, devuelve solo los activos (activo = 1)
    const includeAll = req.query.all === '1';
    let products;
    if (includeAll) {
      products = await prepare('SELECT * FROM productos ORDER BY id ASC').all();
    } else {
      products = await prepare('SELECT * FROM productos WHERE activo = 1 ORDER BY id ASC').all();
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

router.post('/api/products', verifyToken, async (req, res) => {
  const { nombre, precio, descripcion, imagen, stock, tipo, box_config, categoria, receta } = req.body;
  if (typeof nombre !== 'string' || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  if (tipo !== undefined && !['producto', 'caja'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  const precioVal = (tipo === 'caja') ? (precio || 0) : precio;
  if (tipo !== 'caja' && (precioVal === undefined || precioVal === null || isNaN(Number(precioVal)) || Number(precioVal) <= 0)) {
    return res.status(400).json({ error: 'El precio debe ser un número mayor a 0' });
  }
  try {
    const boxConfigStr = box_config ? (typeof box_config === 'string' ? box_config : JSON.stringify(box_config)) : null;
    const recetaStr = receta ? (typeof receta === 'string' ? receta : JSON.stringify(receta)) : '[]';
    const info = await prepare("INSERT INTO productos (nombre, precio, descripcion, imagen, stock, tipo, box_config, categoria, receta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(nombre.trim(), precioVal, descripcion || '', imagen || '', parseStock(stock), tipo || 'producto', boxConfigStr, (categoria || 'Galletas').trim(), recetaStr);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar producto' });
  }
});

router.put('/api/products/:id', verifyToken, async (req, res) => {
  const { nombre, precio, descripcion, imagen, tipo, box_config, categoria, receta } = req.body;
  const id = req.params.id;
  try {
    const current = await prepare('SELECT * FROM productos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Producto no encontrado' });

    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || !nombre.trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    }
    if (tipo !== undefined && !['producto', 'caja'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });

    const tipoVal = tipo !== undefined ? tipo : current.tipo;
    const precioVal = precio !== undefined ? precio : current.precio;
    if (tipoVal !== 'caja' && (precioVal === undefined || precioVal === null || Number(precioVal) <= 0)) {
      return res.status(400).json({ error: 'Precio requerido para productos normales' });
    }

    const nombreVal = nombre !== undefined ? nombre.trim() : current.nombre;
    const stockVal = ('stock' in req.body) ? parseStock(req.body.stock) : current.stock;
    const categoriaVal = categoria !== undefined ? (categoria.trim() || 'Galletas') : current.categoria;
    const boxConfigStr = box_config !== undefined
      ? (typeof box_config === 'string' ? box_config : JSON.stringify(box_config))
      : current.box_config;
    const recetaStr = receta !== undefined
      ? (typeof receta === 'string' ? receta : JSON.stringify(receta))
      : current.receta;

    await prepare('UPDATE productos SET nombre = ?, precio = ?, descripcion = ?, imagen = ?, stock = ?, tipo = ?, box_config = ?, categoria = ?, receta = ? WHERE id = ?')
      .run(nombreVal, tipoVal !== 'caja' ? precioVal : (precioVal || 0), descripcion || '', imagen || '', stockVal, tipoVal, boxConfigStr, categoriaVal, recetaStr, id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'Error al actualizar producto: ' + err.message });
  }
});

// Ajuste de stock dedicado (no toca los demás campos del producto).
// body: { set: <valor|''> }  fija el stock ('' = sin control)
//       { add: <delta> }     suma/resta unidades (reabastecer / consumir)
router.post('/api/products/:id/stock', verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    const current = await prepare('SELECT stock FROM productos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Producto no encontrado' });

    let newStock;
    if (req.body.set !== undefined) {
      newStock = parseStock(req.body.set);
    } else if (req.body.add !== undefined) {
      const base = (current.stock === null || current.stock === undefined) ? 0 : current.stock;
      newStock = Math.max(0, base + (parseInt(req.body.add) || 0));
    } else {
      return res.status(400).json({ error: 'Falta "set" o "add"' });
    }

    await prepare('UPDATE productos SET stock = ? WHERE id = ?').run(newStock, id);
    res.json({ success: true, stock: newStock });
  } catch (err) {
    console.error('Error ajustando stock:', err);
    res.status(500).json({ error: 'Error al actualizar stock' });
  }
});

router.delete('/api/products/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    const product = await prepare('SELECT tipo FROM productos WHERE id = ?').get([id]);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    await prepare('DELETE FROM movimientos_stock WHERE producto_id = ?').run([id]);
    await prepare('DELETE FROM productos WHERE id = ?').run([id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE product error:', err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;
