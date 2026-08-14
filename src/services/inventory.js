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
        await logMovement(item.id, 'venta', qty, anterior, nuevo, 'Venta #' + (referencia || ''), String(referencia || ''));
      }
    }
  }
}

// Devuelve al stock las unidades que se descontaron al crear un pedido, cuando
// ese pedido se cancela. Sin esto, cada cancelación reduce el inventario
// disponible para siempre aunque el producto nunca haya salido del local.
// Idempotente: si ya se restauró este pedido (existe un movimiento 'cancelacion'
// con esa referencia), no vuelve a sumar.
async function restoreStockForOrder(numero, motivo) {
  const referencia = String(numero);
  // El driver de la base de datos guarda los números como REAL, así que SQLite
  // puede haber quedado con "20260814007.0" en vez de "20260814007" para pedidos
  // ya existentes: se acepta cualquiera de las dos formas.
  const referenciaLegacy = referencia + '.0';
  const yaRestaurado = await prepare("SELECT 1 FROM movimientos_stock WHERE referencia IN (?, ?) AND tipo = 'cancelacion' LIMIT 1").get(referencia, referenciaLegacy);
  if (yaRestaurado) return;

  const movimientosVenta = await prepare("SELECT producto_id, cantidad FROM movimientos_stock WHERE referencia IN (?, ?) AND tipo = 'venta'").all(referencia, referenciaLegacy);
  for (const m of movimientosVenta) {
    const prod = await prepare('SELECT stock FROM productos WHERE id = ? AND stock IS NOT NULL').get(m.producto_id);
    if (!prod) continue;
    const anterior = prod.stock;
    const nuevo = anterior + m.cantidad;
    await prepare('UPDATE productos SET stock = ? WHERE id = ?').run(nuevo, m.producto_id);
    await logMovement(m.producto_id, 'cancelacion', m.cantidad, anterior, nuevo, motivo || ('Pedido #' + numero + ' cancelado'), referencia);
  }
}

async function logMovement(productoId, tipo, cantidad, stockAnterior, stockNuevo, motivo, referencia, createdBy) {
  await prepare(`
    INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(productoId, tipo, cantidad, stockAnterior ?? null, stockNuevo ?? null, motivo || '', referencia != null ? String(referencia) : '', createdBy || 'sistema');
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

module.exports = { checkStock, decrementStock, restoreStockForOrder, logMovement, getMovements, getAllMovements, getInventorySummary };
