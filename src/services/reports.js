const { prepare } = require('../db');

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(headers, rows) {
  // Usamos punto y coma (;) como delimitador para compatibilidad con Excel
  // en español (donde la coma es separador decimal).
  const delim = ';';
  const lines = [headers.map(csvEscape).join(delim)];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(delim));
  }
  return '\uFEFF' + lines.join('\r\n');
}

function fmtCurrency(val) {
  if (val === null || val === undefined) return '0.00';
  return Number(val).toFixed(2);
}

function tipoEntregaTexto(tipo) {
  const map = { pickup: 'Pasar a buscar', delivery: 'Delivery', envio: 'Envío' };
  return map[tipo] || tipo || '';
}

async function pedidosCsv() {
  const orders = await prepare(`
    SELECT numero, fecha, cliente, telefono, productos, cantidad, subtotal,
           descuento, envio, total, pago, estado, tipo_entrega,
           direccion, sector, nota, descuento_detalles, created_at
    FROM pedidos ORDER BY id DESC
  `).all();
  const headers = [
    'Número', 'Fecha', 'Cliente', 'Teléfono', 'Tipo de Entrega',
    'Productos', 'Cantidad',
    'Subtotal (RD$)', 'Descuento (RD$)', 'Envío (RD$)', 'Total (RD$)',
    'Método de Pago', 'Estado',
    'Dirección', 'Sector', 'Nota', 'Detalle Descuento',
    'Registrado'
  ];
  const rows = orders.map(o => [
    String(o.numero).padStart(4, '0'),
    o.fecha || '',
    o.cliente || '',
    o.telefono || '',
    tipoEntregaTexto(o.tipo_entrega),
    o.productos || '',
    o.cantidad || 0,
    fmtCurrency(o.subtotal),
    o.descuento > 0 ? fmtCurrency(o.descuento) : '0.00',
    fmtCurrency(o.envio),
    fmtCurrency(o.total),
    o.pago || '',
    o.estado || '',
    o.direccion || '',
    o.sector || '',
    o.nota || '',
    o.descuento_detalles || '',
    o.created_at || ''
  ]);
  return toCsv(headers, rows);
}

async function clientesCsv() {
  const clientes = await prepare(`
    SELECT id, nombre, telefono, email, direccion, sector,
           total_pedidos, total_gastado, total_descuentos,
           ultimo_pedido, activo, notas, created_at
    FROM clientes ORDER BY total_gastado DESC
  `).all();
  const headers = [
    'ID', 'Nombre', 'Teléfono', 'Email', 'Dirección', 'Sector',
    'Total Pedidos', 'Total Gastado (RD$)', 'Total Descuentos (RD$)',
    'Último Pedido', 'Activo', 'Notas', 'Registrado'
  ];
  const rows = clientes.map(c => [
    c.id,
    c.nombre || '',
    c.telefono || '',
    c.email || '',
    c.direccion || '',
    c.sector || '',
    c.total_pedidos || 0,
    fmtCurrency(c.total_gastado),
    fmtCurrency(c.total_descuentos),
    c.ultimo_pedido || '',
    c.activo == 1 ? 'Sí' : 'No',
    c.notas || '',
    c.created_at || ''
  ]);
  return toCsv(headers, rows);
}

module.exports = { pedidosCsv, clientesCsv };
