// Control de inventario. El stock es OPCIONAL por producto:
//   - stock = NULL  -> el producto no lleva control de inventario (siempre disponible).
//   - stock = número -> se controla: se descuenta en cada pedido y se bloquea la sobreventa.
const { prepare } = require('../db');

// Verifica que haya stock suficiente para los items del carrito.
// Devuelve { ok: true } o { ok: false, error }.
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

// Descuenta el stock de los productos que llevan control (stock no nulo).
async function decrementStock(cartItems) {
  for (const item of (cartItems || [])) {
    const qty = parseInt(item.qty) || 0;
    if (qty > 0) {
      await prepare('UPDATE productos SET stock = MAX(0, stock - ?) WHERE id = ? AND stock IS NOT NULL').run(qty, item.id);
    }
  }
}

module.exports = { checkStock, decrementStock };
