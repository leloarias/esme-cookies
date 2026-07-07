// Lógica de negocio de clientes reutilizada por las rutas de pedidos y clientes:
// alta/actualización automática desde un pedido y recálculo de totales.
const { prepare } = require('../db');
const { normalizePhone } = require('../utils/helpers');

// Crea o actualiza el cliente a partir de los datos de un pedido nuevo.
async function saveClientFromOrder(cliente, telefono, email, direccion, sector, total, descuento) {
  try {
    const descuentoNum = parseFloat(descuento) || 0;
    const telefonoNorm = normalizePhone(telefono);
    if (!telefonoNorm) return;
    const totalNum = parseFloat(total) || 0;
    const emailVal = (email || '').trim();
    const now = new Date();
    const fechaStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear();
    const existing = await prepare('SELECT id, nombre, activo FROM clientes WHERE telefono = ?').get(telefonoNorm);
    if (existing) {
      // Solo actualiza el email si vino uno nuevo (no pisa el existente con vacío).
      await prepare("UPDATE clientes SET nombre=?, email=COALESCE(NULLIF(?, ''), email), direccion=?, sector=?, total_pedidos=total_pedidos+1, total_gastado=total_gastado+?, total_descuentos=total_descuentos+?, ultimo_pedido=? WHERE id=?")
        .run(cliente, emailVal, direccion || '', sector || '', totalNum, descuentoNum, fechaStr, existing.id);
    } else {
      await prepare('INSERT INTO clientes (nombre, telefono, email, direccion, sector, total_pedidos, total_gastado, total_descuentos, ultimo_pedido, activo) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 1)')
        .run(cliente, telefonoNorm, emailVal, direccion || '', sector || '', totalNum, descuentoNum, fechaStr);
    }
    console.log('Client saved:', telefonoNorm);
  } catch (err) {
    console.error('Error guardando cliente:', err);
  }
}

// Garantiza que exista un cliente para ese teléfono (lo crea vacío si falta).
async function ensureClientExists(telefono, nombre) {
  try {
    const telefonoNorm = normalizePhone(telefono);
    if (!telefonoNorm) return null;
    const existing = await prepare('SELECT id FROM clientes WHERE telefono = ?').get(telefonoNorm);
    if (!existing) {
      const info = await prepare('INSERT INTO clientes (nombre, telefono, total_pedidos, total_gastado, total_descuentos, activo) VALUES (?, ?, 0, 0, 0, 1)')
        .run(nombre || 'Cliente', telefonoNorm);
      console.log('Cliente creado automáticamente:', telefonoNorm);
      return info.lastInsertRowid;
    }
    return existing.id;
  } catch (err) {
    console.error('Error asegurando cliente:', err);
    return null;
  }
}

// Recalcula los totales de todos los clientes a partir de los pedidos reales,
// fusionando duplicados y creando los clientes que falten.
async function recalcularClientes() {
  let clientes = await prepare('SELECT id, telefono, nombre FROM clientes').all();
  const pedidos = await prepare('SELECT telefono, estado, total, descuento, fecha, cliente FROM pedidos').all();
  let actualizados = 0;
  let creados = 0;
  let eliminados = 0;

  // 1. Fusionar clientes duplicados (mismo teléfono normalizado)
  const phoneMap = {};
  for (const c of clientes) {
    const norm = normalizePhone(c.telefono);
    if (phoneMap[norm]) {
      // Ya existe un cliente con este teléfono → eliminar el duplicado
      const keep = phoneMap[norm];
      // Sumar datos del duplicado al principal
      await prepare('UPDATE clientes SET total_pedidos = total_pedidos + ?, total_gastado = total_gastado + ?, total_descuentos = total_descuentos + ? WHERE id = ?')
        .run(c.total_pedidos || 0, c.total_gastado || 0, c.total_descuentos || 0, keep.id);
      await prepare('DELETE FROM clientes WHERE id = ?').run(c.id);
      eliminados++;
      console.log('[Recalc] Duplicado eliminado:', c.telefono, '→', keep.telefono);
    } else {
      phoneMap[norm] = c;
    }
  }

  // 2. Actualizar clientes desde pedidos reales
  clientes = await prepare('SELECT id, telefono, nombre FROM clientes').all();
  for (const c of clientes) {
    const cTel = normalizePhone(c.telefono);
    const pedidosCliente = pedidos.filter(p => normalizePhone(p.telefono) === cTel);
    const pedidosActivos = pedidosCliente.filter(p => p.estado !== 'Cancelado');
    const gastado = pedidosActivos.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
    const descuentos = pedidosActivos.reduce((s, p) => s + (parseFloat(p.descuento) || 0), 0);
    const ultimo = pedidosCliente.length > 0 ? pedidosCliente[pedidosCliente.length - 1].fecha : null;
    await prepare('UPDATE clientes SET telefono = ?, total_pedidos = ?, total_gastado = ?, total_descuentos = ?, ultimo_pedido = ? WHERE id = ?')
      .run(cTel, pedidosActivos.length, gastado, descuentos, ultimo, c.id);
    actualizados++;
  }

  // 3. Crear clientes que tienen pedidos pero no existen
  clientes = await prepare('SELECT telefono FROM clientes').all();
  const telefonosClientes = new Set(clientes.map(c => normalizePhone(c.telefono)));
  const telefonosPedidos = [...new Set(pedidos.map(p => normalizePhone(p.telefono)))];

  for (const tel of telefonosPedidos) {
    if (!telefonosClientes.has(tel)) {
      const pedido = pedidos.find(p => normalizePhone(p.telefono) === tel);
      const pedidosCliente = pedidos.filter(p => normalizePhone(p.telefono) === tel);
      const pedidosActivos = pedidosCliente.filter(p => p.estado !== 'Cancelado');
      const gastado = pedidosActivos.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
      const descuentos = pedidosActivos.reduce((s, p) => s + (parseFloat(p.descuento) || 0), 0);
      const ultimo = pedidosCliente.length > 0 ? pedidosCliente[pedidosCliente.length - 1].fecha : null;
      await prepare('INSERT INTO clientes (nombre, telefono, total_pedidos, total_gastado, total_descuentos, ultimo_pedido, activo) VALUES (?, ?, ?, ?, ?, ?, 1)')
        .run(pedido ? pedido.cliente : 'Cliente', tel, pedidosActivos.length, gastado, descuentos, ultimo);
      creados++;
    }
  }

  return { actualizados, creados, eliminados };
}

module.exports = { saveClientFromOrder, ensureClientExists, recalcularClientes };
