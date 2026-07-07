// Generación de reportes CSV del lado del servidor (pedidos y clientes).
// Sin dependencias externas: CSV con escape correcto y BOM para que Excel
// abra bien los acentos.
const { prepare } = require('../db');

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  // ﻿ = BOM UTF-8 para que Excel interprete bien los acentos.
  return '﻿' + lines.join('\r\n');
}

async function pedidosCsv() {
  const orders = await prepare(
    'SELECT numero, fecha, cliente, telefono, productos, cantidad, subtotal, descuento, envio, total, pago, estado, tipo_entrega FROM pedidos ORDER BY id DESC'
  ).all();
  const headers = ['Numero', 'Fecha', 'Cliente', 'Telefono', 'Productos', 'Cantidad', 'Subtotal', 'Descuento', 'Envio', 'Total', 'Pago', 'Estado', 'Entrega'];
  const rows = orders.map(o => [
    o.numero, o.fecha, o.cliente, o.telefono, o.productos, o.cantidad,
    o.subtotal, o.descuento, o.envio, o.total, o.pago, o.estado, o.tipo_entrega
  ]);
  return toCsv(headers, rows);
}

async function clientesCsv() {
  const clientes = await prepare(
    'SELECT nombre, telefono, email, direccion, sector, total_pedidos, total_gastado, total_descuentos, ultimo_pedido FROM clientes ORDER BY total_gastado DESC'
  ).all();
  const headers = ['Nombre', 'Telefono', 'Email', 'Direccion', 'Sector', 'Total Pedidos', 'Total Gastado', 'Total Descuentos', 'Ultimo Pedido'];
  const rows = clientes.map(c => [
    c.nombre, c.telefono, c.email, c.direccion, c.sector,
    c.total_pedidos, c.total_gastado, c.total_descuentos, c.ultimo_pedido
  ]);
  return toCsv(headers, rows);
}

module.exports = { pedidosCsv, clientesCsv };
