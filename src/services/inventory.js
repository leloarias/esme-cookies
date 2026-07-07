const { prepare } = require('../db');

async function checkStock(cartItems) {
  for (const item of (cartItems || [])) {
    const prod = await prepare('SELECT nombre, stock FROM productos WHERE id = ?').get(item.id);
    if (prod && prod.stock !== null && prod.stock !== undefined) {
      const qty = parseInt(item.qty) || 0;
      if (qty > prod.stock) {
        return { ok: false, error: `Stock insuficiente de "${prod.nombre}" (quedan ${prod.stock}).` };
      }
    }
  }
  return { ok: true };
}

async function decrementStock(cartItems, referencia) {
  for (const item of (cartItems || [])) {
    const qty = parseInt(item.qty) || 0;
    if (qty > 0) {
      const prod = await prepare('SELECT stock FROM productos WHERE id = ? AND stock IS NOT NULL').get(item.id);
      if (prod) {
        const anterior = prod.stock;
        const nuevo = Math.max(0, anterior - qty);
        await prepare('UPDATE productos SET stock = ? WHERE id = ?').run(nuevo, item.id);
        await logMovement(item.id, 'venta', qty, anterior, nuevo, 'Venta #' + (referencia || ''), referencia);
      }
    }
  }
}

async function logMovement(productoId, tipo, cantidad, stockAnterior, stockNuevo, motivo, referencia, createdBy) {
  await prepare(`
    INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(productoId, tipo, cantidad, stockAnterior ?? null, stockNuevo ?? null, motivo || '', referencia || '', createdBy || 'sistema');
}

async function getMovements(productoId, limit, offset) {
  return await prepare(`
    SELECT m.*, p.nombre as producto_nombre
    FROM movimientos_stock m
    LEFT JOIN productos p ON p.id = m.producto_id
    WHERE m.producto_id = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(productoId, limit || 50, offset || 0);
}

async function getAllMovements(limit, offset) {
  return await prepare(`
    SELECT m.*, p.nombre as producto_nombre
    FROM movimientos_stock m
    LEFT JOIN productos p ON p.id = m.producto_id
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit || 100, offset || 0);
}

async function getInventorySummary() {
  const all = await prepare('SELECT id, nombre, stock FROM productos').all();
  const conStock = all.filter(p => p.stock !== null && p.stock !== undefined);
  const sinControl = all.filter(p => p.stock === null || p.stock === undefined);
  const agotados = conStock.filter(p => p.stock <= 0);
  const threshold = await prepare('SELECT lowStockThreshold FROM config WHERE id = 1').get();
  const minStock = (threshold && threshold.lowStockThreshold) || 5;
  const bajos = conStock.filter(p => p.stock > 0 && p.stock <= minStock);
  const totalUnidades = conStock.reduce((s, p) => s + p.stock, 0);
  return {
    totalProductos: all.length,
    conStock: conStock.length,
    sinControl: sinControl.length,
    agotados: agotados.length,
    stockBajo: bajos.length,
    umbralMinimo: minStock,
    totalUnidades
  };
}

module.exports = { checkStock, decrementStock, logMovement, getMovements, getAllMovements, getInventorySummary };
