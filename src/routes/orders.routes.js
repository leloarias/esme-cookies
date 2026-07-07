const express = require('express');
const { prepare } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { sendNewOrderEmail, sendCustomerConfirmationEmail, sendStatusChangeEmail } = require('../services/email');
const { normalizePhone, sanitizeString, getDominicanDateTime } = require('../utils/helpers');
const { filtrarPromocionesVigentes, evaluarPromociones } = require('../services/promotions');
const { saveClientFromOrder, ensureClientExists } = require('../services/clients');
const { checkStock, decrementStock } = require('../services/inventory');
const { nextOrderNumber } = require('../services/orderNumber');
const { getIO } = require('../services/realtime');

const router = express.Router();

router.get('/api/orders', verifyToken, async (req, res) => {
  try {
    const orders = await prepare('SELECT * FROM pedidos ORDER BY id DESC').all();
    orders.forEach(o => {
      try { o.estado_timestamps = JSON.parse(o.estado_timestamps); } catch (e) { o.estado_timestamps = {}; }
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

router.get('/api/orders/cliente/:telefono', async (req, res) => {
  try {
    const telefono = req.params.telefono;
    const orders = await prepare('SELECT * FROM pedidos WHERE telefono = ?').all(telefono);
    orders.forEach(o => {
      try { o.estado_timestamps = JSON.parse(o.estado_timestamps); } catch (e) { o.estado_timestamps = {}; }
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos del cliente' });
  }
});

router.get('/api/orders/:num', verifyToken, async (req, res) => {
  try {
    const order = await prepare('SELECT * FROM pedidos WHERE numero = ?').get(req.params.num);
    if (!order) return res.status(404).json({ error: 'No encontrado' });
    try { order.estado_timestamps = JSON.parse(order.estado_timestamps); } catch (e) { order.estado_timestamps = {}; }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/api/orders', async (req, res) => {
  let { cliente, telefono, email, productos, cantidad, precio, subtotal, envio, total, pago, tipo_entrega, observaciones, direccion, sector, nota } = req.body;

  cliente = sanitizeString(cliente);
  telefono = sanitizeString(telefono);
  email = sanitizeString(email);
  productos = sanitizeString(productos);
  observaciones = sanitizeString(observaciones);
  direccion = sanitizeString(direccion);
  sector = sanitizeString(sector);
  nota = sanitizeString(nota);

  if (!cliente || !telefono || !productos) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  if (cliente.length < 2 || cliente.length > 100) {
    return res.status(400).json({ error: 'Nombre de cliente inválido' });
  }

  const telefonoDigits = telefono.replace(/\D/g, '');
  if (telefonoDigits.length < 10 || telefonoDigits.length > 15) {
    return res.status(400).json({ error: 'Número de teléfono inválido' });
  }

  const existingCliente = await prepare('SELECT id, nombre, activo FROM clientes WHERE telefono = ?').get(telefono);
  if (existingCliente && existingCliente.activo == 0) {
    return res.status(403).json({ error: 'Tu cuenta está inactiva. Por favor contacta al administrador.' });
  }

  const config = await prepare('SELECT isOpen FROM config WHERE id = 1').get() || { isOpen: 1 };
  if (config.isOpen == 0) {
    return res.status(403).json({ error: 'La tienda está cerrada actualmente. No se pueden procesar pedidos.' });
  }

  const fullObservaciones = [
    observaciones,
    direccion ? 'Direccion: ' + direccion : '',
    sector ? 'Sector: ' + sector : '',
    nota
  ].filter(Boolean).join(' | ');

  const estadoTimestamps = JSON.stringify({ 'Pendiente': new Date().toISOString() });

  const { date: currentDate, time: currentTime } = getDominicanDateTime();

  console.log(`[Order Debug] DR Date: ${currentDate}, DR Time: ${currentTime}, Subtotal: ${subtotal}, Cantidad: ${cantidad}`);

  const promosActivasRaw = await prepare("SELECT * FROM promociones WHERE activa = 1").all();
  const promosActivas = filtrarPromocionesVigentes(promosActivasRaw, currentDate, currentTime);

  const subTotalNum = parseFloat(subtotal) || 0;
  const tipoEntrega = tipo_entrega || 'pickup';
  const totalItems = parseInt(cantidad) || 0;

  const cartItemsArr = req.body.cartItems || [];
  console.log(`[Order Debug] cartItemsArr length: ${cartItemsArr.length}`);

  // Control de inventario: rechazar el pedido si algún producto no tiene stock suficiente.
  const stockCheck = await checkStock(cartItemsArr);
  if (!stockCheck.ok) {
    return res.status(409).json({ error: stockCheck.error });
  }

  const { descuentoTotal, envioDescuento, promosAplicadas } = evaluarPromociones(promosActivas, {
    subTotalNum, tipoEntrega, totalItems, envio, precio, cartItemsArr
  });

  const descuentoFinal = Math.min(descuentoTotal, subTotalNum);
  const promosJson = JSON.stringify(promosAplicadas);
  const descuentoDetalles = promosAplicadas.map(p => `${p.titulo}: -RD$${p.ahorro}`).join(', ');

  const today = new Date();
  const fechaStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  try {
    const newNum = await nextOrderNumber();

    const totalConDescuento = Math.max(0, (parseFloat(subtotal) || 0) - descuentoFinal + (parseFloat(envio) || 0) - envioDescuento);

    await prepare(`
      INSERT INTO pedidos (
        numero, fecha, cliente, telefono, productos, cantidad, precio, subtotal, descuento, descuento_detalles, envio, total,
        pago, estado, observaciones, tipo_entrega, estado_timestamps, direccion, sector, nota, promociones_aplicadas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newNum, fechaStr, cliente, telefono, productos, cantidad || 1, precio || 0,
      subtotal || total || 0, descuentoFinal + envioDescuento, descuentoDetalles, envio || 0, totalConDescuento, pago || 'Transferencia',
      fullObservaciones, tipo_entrega || 'pickup', estadoTimestamps, direccion || '', sector || '', nota || '', promosJson
    );

    const orderData = {
      numero: newNum,
      cliente,
      telefono,
      productos,
      subtotal: parseFloat(subtotal) || 0,
      descuento: descuentoFinal + envioDescuento,
      descuento_detalles: descuentoDetalles,
      promos_aplicadas: promosAplicadas,
      envio: (parseFloat(envio) || 0) - envioDescuento,
      total: totalConDescuento,
      tipo_entrega,
      observaciones: fullObservaciones
    };
    getIO().emit('nuevo_pedido', orderData);
    sendNewOrderEmail(orderData);
    await saveClientFromOrder(cliente, telefono, email, direccion || '', sector || '', totalConDescuento, descuentoFinal + envioDescuento);
    // Email de confirmación al cliente (si dejó su email y hay SMTP configurado; si no, se omite solo).
    sendCustomerConfirmationEmail(orderData);

    for (const p of promosAplicadas) {
      await prepare("UPDATE promociones SET usos_actuales = usos_actuales + 1 WHERE id = ?").run(p.id);
    }

    // Descontar inventario de los productos con control de stock.
    await decrementStock(cartItemsArr);

    res.json({
      success: true,
      numero: newNum,
      telefono: telefono,
      cliente: cliente,
      descuento: descuentoFinal + envioDescuento,
      promos: promosAplicadas,
      total: totalConDescuento,
      debug: {
        serverDate: currentDate,
        serverTime: currentTime,
        promosFound: promosActivasRaw.length,
        promosFiltered: promosActivas.length,
        cartItemsReceived: cartItemsArr.length
      }
    });
  } catch (err) {
    console.error('Error guardando pedido:', err);
    res.status(500).json({ error: 'Error al guardar pedido', detail: err.message });
  }
});

router.put('/api/orders/:num', verifyToken, async (req, res) => {
  const num = req.params.num;
  const { cliente, telefono, productos, cantidad, precio, subtotal, envio, total, pago, estado, observaciones, tipo_entrega, estado_timestamp, estado_anterior } = req.body;

  console.log('[PUT Order] Updating order:', num, 'New state:', estado, 'Previous:', estado_anterior);

  try {
    const existing = await prepare('SELECT * FROM pedidos WHERE numero = ?').get(num);
    if (!existing) {
      console.log('[PUT Order] Order not found:', num);
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    let timestamps = {};
    try { timestamps = existing.estado_timestamps ? JSON.parse(existing.estado_timestamps) : {}; } catch (e) {}

    if (estado) {
      if (estado_timestamp) {
        timestamps[estado] = estado_timestamp;
      } else if (!timestamps[estado]) {
        timestamps[estado] = new Date().toISOString();
      }
      if (estado_anterior) {
        timestamps['anterior'] = estado_anterior;
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (cliente !== undefined) { updateFields.push('cliente = ?'); updateValues.push(cliente); }
    if (telefono !== undefined) { updateFields.push('telefono = ?'); updateValues.push(telefono); }
    if (productos !== undefined) { updateFields.push('productos = ?'); updateValues.push(productos); }
    if (cantidad !== undefined) { updateFields.push('cantidad = ?'); updateValues.push(cantidad); }
    if (precio !== undefined) { updateFields.push('precio = ?'); updateValues.push(precio); }
    if (subtotal !== undefined) { updateFields.push('subtotal = ?'); updateValues.push(subtotal); }
    if (envio !== undefined) { updateFields.push('envio = ?'); updateValues.push(envio); }
    if (total !== undefined) { updateFields.push('total = ?'); updateValues.push(total); }
    if (pago !== undefined) { updateFields.push('pago = ?'); updateValues.push(pago); }
    if (estado !== undefined) { updateFields.push('estado = ?'); updateValues.push(estado); }
    if (observaciones !== undefined) { updateFields.push('observaciones = ?'); updateValues.push(observaciones); }
    if (tipo_entrega !== undefined) { updateFields.push('tipo_entrega = ?'); updateValues.push(tipo_entrega); }

    updateFields.push('estado_timestamps = ?');
    updateValues.push(JSON.stringify(timestamps));
    updateValues.push(num);

    const sql = 'UPDATE pedidos SET ' + updateFields.join(', ') + ' WHERE numero = ?';
    console.log('[PUT Order] SQL:', sql, 'Values:', updateValues);

    await prepare(sql).run(...updateValues);

    // Manejar cambio de estado para contabilidad del cliente
    if (estado && estado !== existing.estado) {
      const orderTotal = parseFloat(existing.total) || 0;
      const orderDescuento = parseFloat(existing.descuento) || 0;
      const telNorm = normalizePhone(existing.telefono);

      if (existing.estado === 'Cancelado' && estado !== 'Cancelado') {
        await ensureClientExists(telNorm, existing.cliente);
        await prepare('UPDATE clientes SET total_gastado = total_gastado + ?, total_descuentos = total_descuentos + ? WHERE telefono = ?')
          .run(orderTotal, orderDescuento, telNorm);
        console.log('[PUT Order] Reactivado, sumado al cliente:', telNorm);
      } else if (existing.estado !== 'Cancelado' && estado === 'Cancelado') {
        await ensureClientExists(telNorm, existing.cliente);
        await prepare('UPDATE clientes SET total_gastado = MAX(0, total_gastado - ?), total_descuentos = MAX(0, total_descuentos - ?) WHERE telefono = ?')
          .run(orderTotal, orderDescuento, telNorm);
        console.log('[PUT Order] Cancelado, restado del cliente:', telNorm);
      }

      // Email al cliente notificando el nuevo estado (si tiene email y hay SMTP; si no, se omite).
      sendStatusChangeEmail({
        numero: num,
        cliente: existing.cliente,
        telefono: existing.telefono,
        total: orderTotal
      }, estado);
    }

    console.log('[PUT Order] Success:', num, 'New state:', estado);
    res.json({ success: true });
  } catch (err) {
    console.error('[PUT Order] Error:', err);
    res.status(500).json({ error: 'Error al actualizar pedido: ' + err.message });
  }
});

router.delete('/api/orders/:num', verifyToken, async (req, res) => {
  const num = req.params.num;
  const hardDelete = req.body.hardDelete === true;

  try {
    if (hardDelete) {
      const order = await prepare('SELECT telefono, total, descuento, cliente FROM pedidos WHERE numero = ?').get(num);
      if (order && order.telefono) {
        const telNorm = normalizePhone(order.telefono);
        await ensureClientExists(telNorm, order.cliente);
        await prepare('UPDATE clientes SET total_pedidos = MAX(0, total_pedidos - 1), total_gastado = MAX(0, total_gastado - ?), total_descuentos = MAX(0, total_descuentos - ?) WHERE telefono = ?')
          .run(parseFloat(order.total) || 0, parseFloat(order.descuento) || 0, telNorm);
      }
      await prepare('DELETE FROM pedidos WHERE numero = ?').run(num);
    } else {
      const order = await prepare('SELECT estado, telefono, total, descuento, cliente, estado_timestamps FROM pedidos WHERE numero = ?').get(num);
      if (order) {
        let timestamps = {};
        try { timestamps = JSON.parse(order.estado_timestamps || '{}'); } catch (e) {}
        timestamps['Cancelado'] = new Date().toISOString();
        await prepare('UPDATE pedidos SET estado = ?, estado_timestamps = ? WHERE numero = ?').run('Cancelado', JSON.stringify(timestamps), num);
        if (order.estado !== 'Cancelado' && order.telefono) {
          const telNorm = normalizePhone(order.telefono);
          await ensureClientExists(telNorm, order.cliente);
          await prepare('UPDATE clientes SET total_gastado = MAX(0, total_gastado - ?), total_descuentos = MAX(0, total_descuentos - ?) WHERE telefono = ?')
            .run(parseFloat(order.total) || 0, parseFloat(order.descuento) || 0, telNorm);
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar eliminacion' });
  }
});

// Seguimiento público de pedidos por teléfono (campos limitados, sin dirección).
// Tolerante al formato del número: compara por teléfono normalizado.
router.get('/api/seguimiento/:telefono', async (req, res) => {
  try {
    const tel = normalizePhone(req.params.telefono);
    if (!tel || tel.length < 10) return res.json([]);
    const all = await prepare(
      'SELECT numero, fecha, cliente, estado, productos, total, tipo_entrega, estado_timestamps, telefono FROM pedidos ORDER BY id DESC'
    ).all();
    const orders = all.filter(o => normalizePhone(o.telefono) === tel).map(o => {
      let timestamps = {};
      try { timestamps = JSON.parse(o.estado_timestamps); } catch (e) {}
      return {
        numero: o.numero,
        fecha: o.fecha,
        cliente: o.cliente,
        estado: o.estado,
        productos: o.productos,
        total: o.total,
        tipo_entrega: o.tipo_entrega,
        estado_timestamps: timestamps
      };
    });
    res.json(orders);
  } catch (err) {
    console.error('Error en seguimiento:', err);
    res.status(500).json({ error: 'Error al obtener seguimiento' });
  }
});

module.exports = router;
