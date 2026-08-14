// Ingredientes (materia prima) y su consumo automático por receta de cada
// producto. Mismo patrón que src/services/inventory.js (stock + bitácora de
// movimientos), aplicado un nivel más abajo: no al producto terminado, sino
// a lo que se usó para hacerlo.
const { prepare } = require('../db');
const { sendLowStockEmail } = require('./email');

async function getIngredients() {
  return await prepare('SELECT * FROM ingredientes ORDER BY nombre ASC').all();
}

async function createIngredient(data) {
  const info = await prepare(`
    INSERT INTO ingredientes (nombre, unidad, stock, costo_unitario, stock_minimo, tamano_paquete)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.nombre.trim(), data.unidad || 'g', Number(data.stock) || 0, Number(data.costo_unitario) || 0, Number(data.stock_minimo) || 0, Number(data.tamano_paquete) || 0);
  return info.lastInsertRowid;
}

async function updateIngredient(id, data) {
  const current = await prepare('SELECT * FROM ingredientes WHERE id = ?').get(id);
  if (!current) return false;
  await prepare(`
    UPDATE ingredientes SET nombre = ?, unidad = ?, costo_unitario = ?, stock_minimo = ?, activo = ?, tamano_paquete = ? WHERE id = ?
  `).run(
    data.nombre !== undefined ? data.nombre.trim() : current.nombre,
    data.unidad !== undefined ? data.unidad : current.unidad,
    data.costo_unitario !== undefined ? Number(data.costo_unitario) : current.costo_unitario,
    data.stock_minimo !== undefined ? Number(data.stock_minimo) : current.stock_minimo,
    data.activo !== undefined ? data.activo : current.activo,
    data.tamano_paquete !== undefined ? Number(data.tamano_paquete) : current.tamano_paquete,
    id
  );
  return true;
}

async function deleteIngredient(id) {
  await prepare('DELETE FROM movimientos_ingredientes WHERE ingrediente_id = ?').run(id);
  await prepare('DELETE FROM ingredientes WHERE id = ?').run(id);
}

async function logMovement(ingredienteId, tipo, cantidad, stockAnterior, stockNuevo, costoTotal, motivo, referencia, createdBy) {
  await prepare(`
    INSERT INTO movimientos_ingredientes (ingrediente_id, tipo, cantidad, stock_anterior, stock_nuevo, costo_total, motivo, referencia, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ingredienteId, tipo, cantidad, stockAnterior ?? null, stockNuevo ?? null, costoTotal || 0, motivo || '', referencia != null ? String(referencia) : '', createdBy || 'sistema');
}

// Comprar/reabastecer: suma stock y promedia el costo unitario ponderado por
// lo que ya había, para que el costo del producto no salte con cada compra.
async function restockIngredient(id, cantidad, costoUnitarioCompra, motivo, createdBy) {
  const ing = await prepare('SELECT * FROM ingredientes WHERE id = ?').get(id);
  if (!ing) throw new Error('Ingrediente no encontrado');
  const qty = Number(cantidad) || 0;
  if (qty <= 0) throw new Error('Cantidad inválida');

  const anterior = Number(ing.stock) || 0;
  const nuevo = anterior + qty;
  let costoUnitario = Number(ing.costo_unitario) || 0;
  if (costoUnitarioCompra !== undefined && costoUnitarioCompra !== null && costoUnitarioCompra !== '') {
    const costoCompra = Number(costoUnitarioCompra);
    costoUnitario = nuevo > 0 ? ((anterior * costoUnitario) + (qty * costoCompra)) / nuevo : costoCompra;
  }

  await prepare(`
    UPDATE ingredientes
    SET stock = ?, costo_unitario = ?, alerta_enviada = CASE WHEN ? > stock_minimo THEN 0 ELSE alerta_enviada END
    WHERE id = ?
  `).run(nuevo, costoUnitario, nuevo, id);
  await logMovement(id, 'compra', qty, anterior, nuevo, qty * (Number(costoUnitarioCompra) || 0), motivo || 'Reabastecimiento', '', createdBy);
}

// Ajuste manual (corrige a favor o en contra) — la vía para reflejar un
// conteo físico real y detectar fugas: la diferencia queda en la bitácora.
async function adjustIngredient(id, nuevoStock, motivo, createdBy) {
  const ing = await prepare('SELECT * FROM ingredientes WHERE id = ?').get(id);
  if (!ing) throw new Error('Ingrediente no encontrado');
  const anterior = Number(ing.stock) || 0;
  const nuevo = Math.max(0, Number(nuevoStock));
  await prepare(`
    UPDATE ingredientes
    SET stock = ?, alerta_enviada = CASE WHEN ? > stock_minimo THEN 0 ELSE alerta_enviada END
    WHERE id = ?
  `).run(nuevo, nuevo, id);
  await logMovement(id, 'ajuste', nuevo - anterior, anterior, nuevo, (nuevo - anterior) * (Number(ing.costo_unitario) || 0), motivo || 'Ajuste manual', '', createdBy);
  checkAndNotifyLowStock().catch(e => console.error('[Ingredientes] Error verificando stock bajo:', e.message));
}

// Las recetas se cargan por lote (ej: "el lote de 24 galletas lleva 500g de
// harina"), no por pieza — el admin no tiene que dividir a mano. Se guardan
// como { rinde, lineas: [{ingrediente_id, cantidad}] } donde cantidad es el
// total del lote; acá se reduce a "cuánto por unidad" para el resto del
// sistema (consumo, costo, chequeo de stock), que sigue trabajando por pieza.
// Formato viejo (array plano, ya por unidad) se sigue soportando tal cual.
function parseRecetaPorUnidad(recetaRaw) {
  if (!recetaRaw) return [];
  let receta;
  try { receta = JSON.parse(recetaRaw); } catch (e) { return []; }
  if (Array.isArray(receta)) return receta;
  if (!receta || !Array.isArray(receta.lineas)) return [];
  const rinde = Number(receta.rinde) || 1;
  return receta.lineas.map(l => ({ ingrediente_id: l.ingrediente_id, cantidad: (Number(l.cantidad) || 0) / rinde }));
}

// Verifica que haya ingredientes suficientes para preparar lo que se está
// pidiendo, según receta. Es un control aparte del stock del producto
// terminado: un producto puede tener stock disponible pero no haber
// suficiente materia prima real para prepararlo.
async function checkIngredientStock(cartItems) {
  const requerido = {}; // ingrediente_id -> cantidad total necesaria
  for (const item of (cartItems || [])) {
    const qty = parseInt(item.qty) || 0;
    if (qty <= 0) continue;
    const prod = await prepare('SELECT receta FROM productos WHERE id = ?').get(item.id);
    if (!prod || !prod.receta) continue;
    const receta = parseRecetaPorUnidad(prod.receta);
    for (const linea of receta) {
      const cantidad = (Number(linea.cantidad) || 0) * qty;
      if (cantidad <= 0) continue;
      requerido[linea.ingrediente_id] = (requerido[linea.ingrediente_id] || 0) + cantidad;
    }
  }
  for (const ingredienteId of Object.keys(requerido)) {
    const ing = await prepare('SELECT nombre, unidad, stock FROM ingredientes WHERE id = ?').get(ingredienteId);
    if (!ing) continue;
    const disponible = Number(ing.stock) || 0;
    if (requerido[ingredienteId] > disponible) {
      return { ok: false, error: `No hay suficiente "${ing.nombre}" para preparar el pedido (se necesitan ${requerido[ingredienteId]}${ing.unidad}, quedan ${disponible}${ing.unidad}).` };
    }
  }
  return { ok: true };
}

// Descuenta los ingredientes que corresponden a lo vendido en un pedido,
// según la receta de cada producto (cartItems: [{id, qty}]). Si un producto
// no tiene receta cargada, simplemente no consume nada (no rompe la venta).
async function consumeForOrder(cartItems, referencia) {
  for (const item of (cartItems || [])) {
    const qty = parseInt(item.qty) || 0;
    if (qty <= 0) continue;
    const prod = await prepare('SELECT receta FROM productos WHERE id = ?').get(item.id);
    if (!prod || !prod.receta) continue;
    const receta = parseRecetaPorUnidad(prod.receta);
    if (receta.length === 0) continue;

    for (const linea of receta) {
      const ing = await prepare('SELECT * FROM ingredientes WHERE id = ?').get(linea.ingrediente_id);
      if (!ing) continue;
      const consumo = (Number(linea.cantidad) || 0) * qty;
      if (consumo <= 0) continue;
      const anterior = Number(ing.stock) || 0;
      const nuevo = Math.max(0, anterior - consumo);
      await prepare('UPDATE ingredientes SET stock = ? WHERE id = ?').run(nuevo, ing.id);
      await logMovement(ing.id, 'consumo', consumo, anterior, nuevo, consumo * (Number(ing.costo_unitario) || 0), 'Venta #' + referencia, referencia, 'sistema');
    }
  }
  checkAndNotifyLowStock().catch(e => console.error('[Ingredientes] Error verificando stock bajo:', e.message));
}

// Revisa qué ingredientes activos están en el mínimo o menos y todavía no
// tienen aviso pendiente (alerta_enviada = 0). Manda UN correo con todos y
// marca alerta_enviada = 1 para no repetir hasta que se reabastezcan
// (restockIngredient/adjustIngredient reamnan la alerta al subir el stock).
async function checkAndNotifyLowStock() {
  const bajos = await prepare(`
    SELECT * FROM ingredientes WHERE activo = 1 AND stock <= stock_minimo AND alerta_enviada = 0
  `).all();
  if (bajos.length === 0) return;
  const result = await sendLowStockEmail(bajos);
  if (result.success) {
    for (const ing of bajos) {
      await prepare('UPDATE ingredientes SET alerta_enviada = 1 WHERE id = ?').run(ing.id);
    }
  }
}

// Reverso de consumeForOrder cuando un pedido se cancela. Idempotente: si ya
// se devolvió este pedido, no vuelve a sumar.
async function restoreForOrder(referencia) {
  const ref = String(referencia);
  const refLegacy = ref + '.0'; // ver nota en inventory.js sobre el driver de la base de datos
  const yaRestaurado = await prepare("SELECT 1 FROM movimientos_ingredientes WHERE referencia IN (?, ?) AND tipo = 'devolucion' LIMIT 1").get(ref, refLegacy);
  if (yaRestaurado) return;

  const consumos = await prepare("SELECT ingrediente_id, cantidad FROM movimientos_ingredientes WHERE referencia IN (?, ?) AND tipo = 'consumo'").all(ref, refLegacy);
  for (const m of consumos) {
    const ing = await prepare('SELECT * FROM ingredientes WHERE id = ?').get(m.ingrediente_id);
    if (!ing) continue;
    const anterior = Number(ing.stock) || 0;
    const nuevo = anterior + Number(m.cantidad);
    await prepare(`
      UPDATE ingredientes
      SET stock = ?, alerta_enviada = CASE WHEN ? > stock_minimo THEN 0 ELSE alerta_enviada END
      WHERE id = ?
    `).run(nuevo, nuevo, ing.id);
    await logMovement(ing.id, 'devolucion', Number(m.cantidad), anterior, nuevo, Number(m.cantidad) * (Number(ing.costo_unitario) || 0), 'Pedido #' + referencia + ' cancelado', ref, 'sistema');
  }
}

// Costo de producir una unidad de un producto, según su receta actual.
async function getCostoProducto(productoId) {
  const prod = await prepare('SELECT receta FROM productos WHERE id = ?').get(productoId);
  if (!prod || !prod.receta) return 0;
  const receta = parseRecetaPorUnidad(prod.receta);

  let costo = 0;
  for (const linea of receta) {
    const ing = await prepare('SELECT costo_unitario FROM ingredientes WHERE id = ?').get(linea.ingrediente_id);
    if (!ing) continue;
    costo += (Number(linea.cantidad) || 0) * (Number(ing.costo_unitario) || 0);
  }
  return costo;
}

async function getMovements(ingredienteId, limit, offset) {
  if (ingredienteId) {
    return await prepare(`
      SELECT m.*, i.nombre as ingrediente_nombre, i.unidad
      FROM movimientos_ingredientes m
      LEFT JOIN ingredientes i ON i.id = m.ingrediente_id
      WHERE m.ingrediente_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(ingredienteId, limit || 50, offset || 0);
  }
  return await prepare(`
    SELECT m.*, i.nombre as ingrediente_nombre, i.unidad
    FROM movimientos_ingredientes m
    LEFT JOIN ingredientes i ON i.id = m.ingrediente_id
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit || 50, offset || 0);
}

async function getSummary() {
  const all = await getIngredients();
  const activos = all.filter(i => i.activo != 0);
  const bajos = activos.filter(i => i.stock <= i.stock_minimo);
  const inversion = activos.reduce((s, i) => s + (Number(i.stock) || 0) * (Number(i.costo_unitario) || 0), 0);
  return {
    totalIngredientes: activos.length,
    stockBajo: bajos.length,
    inversionTotal: Math.round(inversion * 100) / 100
  };
}

// Costo total de lo consumido (vendido) en un rango de fechas, para el
// reporte de ganancia/pérdida: ingresos (ya calculados en el dashboard) menos
// esto es la ganancia bruta real, no solo lo que entra menos descuentos/envío.
async function getCostoVentas(fechaInicio, fechaFin) {
  const row = await prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'consumo' THEN costo_total ELSE 0 END), 0) as consumo,
      COALESCE(SUM(CASE WHEN tipo = 'devolucion' THEN costo_total ELSE 0 END), 0) as devuelto
    FROM movimientos_ingredientes
    WHERE date(created_at) BETWEEN date(?) AND date(?)
  `).get(fechaInicio, fechaFin);
  const consumo = Number(row.consumo) || 0;
  const devuelto = Number(row.devuelto) || 0;
  return Math.round((consumo - devuelto) * 100) / 100;
}

module.exports = {
  getIngredients, createIngredient, updateIngredient, deleteIngredient,
  restockIngredient, adjustIngredient, checkIngredientStock,
  consumeForOrder, restoreForOrder, getCostoProducto,
  getMovements, getSummary, getCostoVentas, checkAndNotifyLowStock
};
