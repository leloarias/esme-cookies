// Generación de números de pedido, con prefijo de fecha AAAAMMDD.
// El contador vive en la fila única de `config` (lastOrderNumber), y cada
// número se reserva con una sola sentencia UPDATE...RETURNING: SQLite/libSQL
// serializa las escrituras, así que dos pedidos simultáneos nunca pueden
// calcular el mismo número (antes había una ventana de carrera entre leer
// un contador en memoria y confirmarlo con una consulta SELECT aparte).
const { prepare } = require('../db');

async function nextOrderNumber() {
  const today = new Date();
  const datePrefix = String(today.getFullYear()) + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const minToday = parseInt(datePrefix + '000');

  const result = await prepare(
    'UPDATE config SET lastOrderNumber = MAX(lastOrderNumber, ?) + 1 WHERE id = 1 RETURNING lastOrderNumber'
  ).get(minToday - 1);

  const newNum = Number(result.lastOrderNumber);
  console.log('New order number:', newNum);
  return newNum;
}

module.exports = { nextOrderNumber };
