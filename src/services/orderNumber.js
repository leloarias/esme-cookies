// Generación de números de pedido. Mantiene un contador en memoria que se
// inicializa al arrancar (con el MAX(numero) de la base) y garantiza que
// cada nuevo pedido tenga un número único, con prefijo de fecha AAAAMMDD.
const { prepare } = require('../db');

let orderCounter = 0;

function setOrderCounter(n) {
  orderCounter = n || 0;
}

function getOrderCounter() {
  return orderCounter;
}

// Reserva y devuelve el próximo número de pedido libre.
async function nextOrderNumber() {
  const today = new Date();
  const datePrefix = String(today.getFullYear()) + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');

  let newNum = orderCounter + 1;
  const minToday = parseInt(datePrefix + '000');

  if (newNum < minToday) {
    newNum = minToday;
  }

  let existing = await prepare('SELECT numero FROM pedidos WHERE numero = ?').get(newNum);
  while (existing) {
    newNum++;
    existing = await prepare('SELECT numero FROM pedidos WHERE numero = ?').get(newNum);
  }

  orderCounter = newNum;
  // Persistido en config: si el pedido más alto se borra permanentemente y el
  // servidor reinicia, MAX(numero) por sí solo "retrocedería" y reemitiría un
  // número ya usado, lo que rompe la devolución de stock/ingredientes (el
  // sistema los cree del pedido viejo, ya devuelto, y no repite la devolución).
  await prepare('UPDATE config SET lastOrderNumber = ? WHERE id = 1').run(newNum);
  console.log('New order number:', newNum);
  return newNum;
}

module.exports = { setOrderCounter, getOrderCounter, nextOrderNumber };
