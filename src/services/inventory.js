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

// Núcleo atómico compartido: descuenta una lista de { id, qty } producto por
// producto, cada uno con una sola sentencia UPDATE...WHERE stock >= cantidad
// (SQLite/libSQL serializa las escrituras concurrentes, así que esa sentencia
// sola ya evita la ventana de carrera que antes existía entre leer el stock
// y escribirlo en pasos separados). Si algún producto no alcanza, revierte
// lo que ya se descontó en esta misma llamada y devuelve { ok:false, error }.
async function decrementarAtomico(items, referencia, prefijoError) {
  const reservado = [];
  for (const { id, qty } of items) {
    if (!qty || qty <= 0) continue;

    const antes = await prepare('SELECT nombre, stock FROM productos WHERE id = ? AND stock IS NOT NULL').get(id);
    if (!antes) continue; // producto sin control de stock: no se reserva nada

    const result = await prepare('UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?').run(qty, id, qty);
    if (!result.changes) {
      for (const r of reservado) {
        await prepare('UPDATE productos SET stock = stock + ? WHERE id = ?').run(r.qty, r.id);
      }
      return { ok: false, error: `${prefijoError || 'Stock insuficiente de'} "${antes.nombre}" (quedan ${antes.stock}).` };
    }

    reservado.push({ id, qty });
    const despues = await prepare('SELECT stock FROM productos WHERE id = ?').get(id);
    await logMovement(id, 'venta', qty, antes.stock, despues.stock, 'Venta #' + (referencia || ''), String(referencia || ''));
  }
  return { ok: true };
}

async function decrementStock(cartItems, referencia) {
  const items = (cartItems || []).map(item => ({ id: item.id, qty: parseInt(item.qty) || 0 }));
  return decrementarAtomico(items, referencia);
}

// Devuelve al stock lo que quedó reservado para este pedido: la diferencia
// neta entre lo vendido ('venta') y lo ya devuelto ('cancelacion') según la
// bitácora de movimientos. Calcularlo neto (en vez de "¿ya existe algún
// movimiento de cancelación?") es lo que permite cancelar y reactivar el
// mismo pedido varias veces sin perder la cuenta del stock real.
async function restoreStockForOrder(numero, motivo) {
  const referencia = String(numero);
  // El driver de la base de datos guarda los números como REAL, así que SQLite
  // puede haber quedado con "20260814007.0" en vez de "20260814007" para pedidos
  // ya existentes: se acepta cualquiera de las dos formas.
  const referenciaLegacy = referencia + '.0';

  const movimientos = await prepare(
    "SELECT producto_id, tipo, cantidad FROM movimientos_stock WHERE referencia IN (?, ?) AND tipo IN ('venta', 'cancelacion')"
  ).all(referencia, referenciaLegacy);

  const netReservado = {};
  for (const m of movimientos) {
    const signo = m.tipo === 'venta' ? 1 : -1;
    netReservado[m.producto_id] = (netReservado[m.producto_id] || 0) + signo * m.cantidad;
  }

  for (const [productoId, cantidad] of Object.entries(netReservado)) {
    if (cantidad <= 0) continue; // ya estaba devuelto (o nunca se reservó)
    const prod = await prepare('SELECT stock FROM productos WHERE id = ? AND stock IS NOT NULL').get(productoId);
    if (!prod) continue;
    const anterior = prod.stock;
    const nuevo = anterior + cantidad;
    await prepare('UPDATE productos SET stock = ? WHERE id = ?').run(nuevo, productoId);
    await logMovement(productoId, 'cancelacion', cantidad, anterior, nuevo, motivo || ('Pedido #' + numero + ' cancelado'), referencia);
  }
}

// Vuelve a reservar (descuenta) el stock que se había devuelto al cancelar
// este pedido, cuando se reactiva a un estado distinto de Cancelado.
// restoreStockForOrder siempre devuelve TODO lo reservado en un solo
// movimiento 'cancelacion' por producto (nunca deja un resto a medias), así
// que la última cancelación de cada producto es exactamente lo que hay que
// volver a descontar — deshacerla, en vez de sumar/restar toda la bitácora,
// es lo que sigue siendo correcto después de varios ciclos de
// cancelar/reactivar sobre el mismo pedido.
async function reserveStockForOrder(numero) {
  const referencia = String(numero);
  const referenciaLegacy = referencia + '.0';

  const ultimasCancelaciones = await prepare(`
    SELECT producto_id, cantidad FROM movimientos_stock
    WHERE referencia IN (?, ?) AND tipo = 'cancelacion' AND id IN (
      SELECT MAX(id) FROM movimientos_stock
      WHERE referencia IN (?, ?) AND tipo = 'cancelacion'
      GROUP BY producto_id
    )
  `).all(referencia, referenciaLegacy, referencia, referenciaLegacy);

  const items = ultimasCancelaciones.map(m => ({ id: m.producto_id, qty: m.cantidad }));
  return decrementarAtomico(items, numero, 'No se pudo reactivar el pedido: no hay stock suficiente de');
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

module.exports = { checkStock, decrementStock, restoreStockForOrder, reserveStockForOrder, logMovement, getMovements, getAllMovements, getInventorySummary };
