const express = require('express');
const { prepare } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { sendNewOrderEmail, sendCustomerConfirmationEmail, sendStatusChangeEmail } = require('../services/email');
const { normalizePhone, sanitizeString, getDominicanDateTime } = require('../utils/helpers');
const { filtrarPromocionesVigentes, evaluarPromociones } = require('../services/promotions');
const { saveClientFromOrder, ensureClientExists } = require('../services/clients');
const { checkStock, decrementStock, restoreStockForOrder, reserveStockForOrder } = require('../services/inventory');
const { consumeForOrder: consumeIngredientsForOrder, restoreForOrder: restoreIngredientsForOrder, reserveForOrder: reserveIngredientsForOrder, checkIngredientStock } = require('../services/ingredients');
const { nextOrderNumber } = require('../services/orderNumber');
const { getIO } = require('../services/realtime');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

router.get('/api/orders', verifyToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const totalRow = await prepare('SELECT COUNT(*) as count FROM pedidos').get();
    const total = Number(totalRow.count);

    if (req.query.all === 'true') {
      const orders = await prepare('SELECT * FROM pedidos ORDER BY id DESC').all();
      orders.forEach(o => {
        try { o.estado_timestamps = JSON.parse(o.estado_timestamps); } catch (e) { o.estado_timestamps = {}; }
      });
      return res.json(orders);
    }

    const orders = await prepare('SELECT * FROM pedidos ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
    orders.forEach(o => {
      try { o.estado_timestamps = JSON.parse(o.estado_timestamps); } catch (e) { o.estado_timestamps = {}; }
    });
    res.json({ data: orders, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

router.get('/api/orders/cliente/:telefono', verifyToken, async (req, res) => {
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

const METODOS_PAGO_VALIDOS = ['Transferencia', 'Efectivo'];

router.post('/api/orders', async (req, res) => {
  let { cliente, telefono, email, productos, pago, tipo_entrega, observaciones, direccion, sector, nota, fecha_entrega } = req.body;

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

  // Fecha de entrega deseada (opcional): formato YYYY-MM-DD desde el
  // <input type="date">. Se valida el formato y que no sea una fecha ya
  // pasada, pero no es obligatoria — muchos pedidos son "cuando puedan".
  if (fecha_entrega) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_entrega)) {
      return res.status(400).json({ error: 'Fecha de entrega inválida' });
    }
    const hoy = getDominicanDateTime().date;
    if (fecha_entrega < hoy) {
      return res.status(400).json({ error: 'La fecha de entrega no puede ser en el pasado' });
    }
  } else {
    fecha_entrega = null;
  }

  const telefonoDigits = telefono.replace(/\D/g, '');
  if (telefonoDigits.length < 10 || telefonoDigits.length > 15) {
    return res.status(400).json({ error: 'Número de teléfono inválido' });
  }

  // Comparar por teléfono normalizado: clientes.telefono siempre se guarda
  // a 10 dígitos (normalizePhone), así que comparar contra el texto tal cual
  // lo escribió la persona dejaba evadir el bloqueo con solo cambiar el
  // formato (espacios, guiones, código de país).
  const existingCliente = await prepare('SELECT id, nombre, activo FROM clientes WHERE telefono = ?').get(normalizePhone(telefono));
  if (existingCliente && existingCliente.activo == 0) {
    return res.status(403).json({ error: 'Tu cuenta está inactiva. Por favor contacta al administrador.' });
  }

  const config = await prepare('SELECT isOpen, deliveryPrice, envioPrice, envioZones FROM config WHERE id = 1').get() || { isOpen: 1, deliveryPrice: 0, envioPrice: 0 };
  if (config.isOpen == 0) {
    return res.status(403).json({ error: 'La tienda está cerrada actualmente. No se pueden procesar pedidos.' });
  }

  // Método de pago contra lista blanca: evita que alguien inyecte texto tipo
  // "PAGADO - confirmado" desde la consola del navegador para engañar al staff.
  const pagoValidado = METODOS_PAGO_VALIDOS.includes(pago) ? pago : 'Transferencia';

  const fullObservaciones = [
    observaciones,
    direccion ? 'Direccion: ' + direccion : '',
    sector ? (tipo_entrega === 'envio' ? 'Destino: ' : 'Sector: ') + sector : '',
    nota
  ].filter(Boolean).join(' | ');

  const estadoTimestamps = JSON.stringify({ 'Pendiente': new Date().toISOString() });

  const { date: currentDate, time: currentTime } = getDominicanDateTime();

  const promosActivasRaw = await prepare("SELECT * FROM promociones WHERE activa = 1").all();
  const promosActivas = filtrarPromocionesVigentes(promosActivasRaw, currentDate, currentTime);

  const tipoEntrega = tipo_entrega || 'pickup';

  // Precios recalculados en el servidor contra la tabla real de productos:
  // nunca confiar en precio/subtotal/total que manda el navegador (se puede
  // editar desde la consola). Los ids que no existen en el catálogo se ignoran.
  const cartItemsRaw = req.body.cartItems || [];
  const cartItemsArr = [];
  let subTotalNum = 0;
  for (const item of cartItemsRaw) {
    const qty = parseInt(item && item.qty) || 0;
    if (qty <= 0) continue;
    const prod = await prepare('SELECT id, nombre, precio, categoria FROM productos WHERE id = ?').get(item.id);
    if (!prod) continue;
    const precioReal = Number(prod.precio) || 0;
    subTotalNum += precioReal * qty;
    cartItemsArr.push({ id: prod.id, nombre: prod.nombre, precio: precioReal, categoria: prod.categoria, qty });
  }
  if (cartItemsArr.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío o los productos ya no existen.' });
  }
  const totalItems = cartItemsArr.reduce((a, item) => a + item.qty, 0);

  // Validación real de "armá tu caja": no alcanza con que el carrito tenga
  // el producto placeholder (id 7) — el tamaño elegido y los productos deben
  // coincidir con lo que permite productos.box_config. Antes solo se
  // chequeaba la presencia del id 7, así que un pedido armado directo a la
  // API (sin pasar por el armador) podía activar promos "solo cajas" con un
  // pedido mínimo de un producto.
  const boxItem = cartItemsArr.find(item => Number(item.id) === 7);
  let hasBox = false;
  if (boxItem) {
    const boxProd = await prepare('SELECT box_config FROM productos WHERE id = 7').get();
    let boxConfig = { sizes: [6, 12, 24], allowedProducts: [] };
    try {
      const parsed = JSON.parse((boxProd && boxProd.box_config) || '{}');
      if (parsed && typeof parsed === 'object') boxConfig = { ...boxConfig, ...parsed };
    } catch (e) { /* usa el default */ }

    const contenidoCaja = cartItemsArr.filter(item => Number(item.id) !== 7);
    const cantidadCaja = contenidoCaja.reduce((s, item) => s + item.qty, 0);
    const tamanoValido = Array.isArray(boxConfig.sizes) && boxConfig.sizes.includes(cantidadCaja);
    const productosValidos = !Array.isArray(boxConfig.allowedProducts) || boxConfig.allowedProducts.length === 0 ||
      contenidoCaja.every(item => boxConfig.allowedProducts.includes(item.id));
    hasBox = tamanoValido && productosValidos;
  }

  // El precio de envío también se resuelve en el servidor: nunca se confía en
  // un precio que mande el navegador.
  //
  // El delivery local (dentro de San Juan) es un precio único. El envío
  // nacional sí varía mucho según destino, así que si hay zonas configuradas,
  // son la lista cerrada de provincias/ciudades con envío: un destino fuera de
  // esa lista se rechaza en vez de cobrar un precio genérico que no cubre el flete real.
  let envio = tipoEntrega === 'pickup' ? 0 : (tipoEntrega === 'delivery' ? Number(config.deliveryPrice) || 0 : Number(config.envioPrice) || 0);
  if (tipoEntrega === 'envio') {
    let zonas = [];
    try { zonas = JSON.parse(config.envioZones || '[]'); } catch (e) { zonas = []; }
    if (Array.isArray(zonas) && zonas.length > 0) {
      const zona = zonas.find(z => (z.nombre || '').trim().toLowerCase() === (sector || '').trim().toLowerCase());
      if (!zona) {
        return res.status(400).json({ error: 'Elegí la provincia o ciudad de destino para calcular el envío.' });
      }
      envio = Number(zona.precio) || 0;
    }
  }

  console.log(`[Order Debug] DR Date: ${currentDate}, DR Time: ${currentTime}, Subtotal: ${subTotalNum}, Cantidad: ${totalItems}`);

  // Obtener pedidos previos del cliente para validar promos de nuevos/leales
  const clienteRow = await prepare('SELECT total_pedidos FROM clientes WHERE telefono = ?').get(normalizePhone(telefono));
  const clientePedidos = clienteRow ? (clienteRow.total_pedidos || 0) : 0;
  console.log(`[Order Debug] Cliente pedidos previos: ${clientePedidos}`);

  // Control de inventario: rechazar el pedido si algún producto no tiene stock suficiente.
  const stockCheck = await checkStock(cartItemsArr);
  if (!stockCheck.ok) {
    return res.status(409).json({ error: stockCheck.error });
  }
  // Un producto puede figurar con stock disponible pero no tener materia
  // prima real para prepararlo (el stock del producto y el de sus
  // ingredientes son dos cosas separadas) — se rechaza igual aunque el
  // stock del producto "se vea bien".
  const ingredientStockCheck = await checkIngredientStock(cartItemsArr);
  if (!ingredientStockCheck.ok) {
    return res.status(409).json({ error: ingredientStockCheck.error });
  }

  const { descuentoTotal, envioDescuento, promosAplicadas } = evaluarPromociones(promosActivas, {
    subTotalNum, tipoEntrega, totalItems, envio, cartItemsArr, clientePedidos, hasBox
  });

  const descuentoFinal = Math.min(descuentoTotal, subTotalNum);
  const promosJson = JSON.stringify(promosAplicadas);
  const descuentoDetalles = promosAplicadas.map(p => `${p.titulo}: -RD$${p.ahorro}`).join(', ');

  const today = new Date();
  const fechaStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  try {
    const newNum = await nextOrderNumber();

    // Reservar stock e ingredientes de forma atómica ANTES de crear el
    // pedido: si dos pedidos casi simultáneos compiten por la misma unidad,
    // el que pierde la carrera se rechaza acá en vez de aceptarse y quedar
    // sin poder prepararse (ver decrementStock/consumeForOrder, que hacen el
    // descuento con una sola sentencia UPDATE...WHERE stock >= cantidad).
    const stockResult = await decrementStock(cartItemsArr, newNum);
    if (!stockResult.ok) {
      return res.status(409).json({ error: stockResult.error });
    }
    const ingredientResult = await consumeIngredientsForOrder(cartItemsArr, newNum);
    if (!ingredientResult.ok) {
      await restoreStockForOrder(newNum, 'Reserva revertida: no había ingredientes suficientes');
      return res.status(409).json({ error: ingredientResult.error });
    }

    const totalConDescuento = Math.max(0, subTotalNum - descuentoFinal + envio - envioDescuento);

    try {
      await prepare(`
        INSERT INTO pedidos (
          numero, fecha, cliente, telefono, productos, cantidad, precio, subtotal, descuento, descuento_detalles, envio, total,
          pago, estado, observaciones, tipo_entrega, estado_timestamps, direccion, sector, nota, promociones_aplicadas, fecha_entrega
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newNum, fechaStr, cliente, telefono, productos, totalItems, subTotalNum,
        subTotalNum, descuentoFinal + envioDescuento, descuentoDetalles, envio, totalConDescuento, pagoValidado,
        fullObservaciones, tipo_entrega || 'pickup', estadoTimestamps, direccion || '', sector || '', nota || '', promosJson, fecha_entrega
      );
    } catch (insertErr) {
      // El pedido no se pudo guardar: revertir la reserva para no dejar
      // stock/ingredientes descontados sin un pedido real detrás.
      await restoreStockForOrder(newNum, 'Reserva revertida: error al guardar el pedido');
      await restoreIngredientsForOrder(newNum);
      throw insertErr;
    }

    const orderData = {
      numero: newNum,
      cliente,
      telefono,
      productos,
      subtotal: subTotalNum,
      descuento: descuentoFinal + envioDescuento,
      descuento_detalles: descuentoDetalles,
      promos_aplicadas: promosAplicadas,
      envio: envio - envioDescuento,
      total: totalConDescuento,
      tipo_entrega,
      observaciones: fullObservaciones,
      fecha_entrega: fecha_entrega
    };
    // Solo a admins autenticados: incluye nombre, teléfono y dirección del
    // cliente, así que nunca debe llegar al socket público de la tienda.
    getIO().to('admins').emit('nuevo_pedido', orderData);
    sendNewOrderEmail(orderData);
    await saveClientFromOrder(cliente, telefono, email, direccion || '', sector || '', totalConDescuento, descuentoFinal + envioDescuento);
    // Email de confirmación al cliente (si dejó su email y hay SMTP configurado; si no, se omite solo).
    sendCustomerConfirmationEmail(orderData);

    for (const p of promosAplicadas) {
      await prepare("UPDATE promociones SET usos_actuales = usos_actuales + 1 WHERE id = ?").run(p.id);
    }

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

// Subir comprobante de pago (captura/foto de la transferencia). Pública
// como la creación del pedido, pero exige el mismo teléfono del pedido
// como comprobación mínima de que quien sube la imagen es quien lo hizo —
// mismo criterio de "tolerancia" que /api/seguimiento (compara normalizado).
router.post('/api/orders/:num/comprobante', async (req, res) => {
  const num = req.params.num;
  const { telefono, imagen } = req.body;

  if (!telefono || !imagen) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    const order = await prepare('SELECT numero, telefono, cliente FROM pedidos WHERE numero = ?').get(num);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    if (normalizePhone(telefono) !== normalizePhone(order.telefono)) {
      return res.status(403).json({ error: 'El teléfono no coincide con el del pedido' });
    }

    const result = await cloudinary.uploader.upload(imagen, {
      folder: 'esme-cookies/comprobantes',
      public_id: `comprobante_${num}_${Date.now()}`,
      overwrite: true,
      resource_type: 'image'
    });

    await prepare('UPDATE pedidos SET comprobante_url = ? WHERE numero = ?').run(result.secure_url, num);

    // Aviso en vivo a admins conectados: así el equipo sabe que ya puede
    // verificar el pago sin tener que revisar cada pedido manualmente.
    getIO().to('admins').emit('comprobante_subido', { numero: order.numero, cliente: order.cliente });

    res.json({ success: true, url: result.secure_url });
  } catch (err) {
    // El detalle técnico (ej. Cloudinary sin configurar) queda en el log del
    // servidor — al cliente no le sirve de nada ver "cloud_name is disabled".
    console.error('Error subiendo comprobante:', err.message);
    res.status(500).json({ error: 'No se pudo subir el comprobante. Intenta de nuevo en unos minutos o envíalo por WhatsApp.' });
  }
});

router.put('/api/orders/:num', verifyToken, async (req, res) => {
  const num = req.params.num;
  const { cliente, telefono, productos, cantidad, precio, subtotal, envio, total, pago, estado, observaciones, tipo_entrega, estado_timestamp, estado_anterior, fecha_entrega } = req.body;

  console.log('[PUT Order] Updating order:', num, 'New state:', estado, 'Previous:', estado_anterior);

  try {
    const existing = await prepare('SELECT * FROM pedidos WHERE numero = ?').get(num);
    if (!existing) {
      console.log('[PUT Order] Order not found:', num);
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Si se reactiva un pedido cancelado, hay que volver a reservar el stock
    // e ingredientes que se habían devuelto al cancelarlo — si no, el pedido
    // queda "activo" pero esas unidades siguen figurando como disponibles,
    // con riesgo de venderlas dos veces. Se valida ANTES del UPDATE principal
    // para poder rechazar la reactivación (409) sin dejar el pedido a medias
    // si ya no hay stock suficiente.
    if (estado && existing.estado === 'Cancelado' && estado !== 'Cancelado') {
      const stockResult = await reserveStockForOrder(num);
      if (!stockResult.ok) {
        return res.status(409).json({ error: stockResult.error });
      }
      const ingredientResult = await reserveIngredientsForOrder(num);
      if (!ingredientResult.ok) {
        await restoreStockForOrder(num, 'Reserva revertida: no había ingredientes suficientes para reactivar');
        return res.status(409).json({ error: ingredientResult.error });
      }
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
    if (fecha_entrega !== undefined) { updateFields.push('fecha_entrega = ?'); updateValues.push(fecha_entrega); }

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
        await restoreStockForOrder(num);
        await restoreIngredientsForOrder(num);
        console.log('[PUT Order] Cancelado, restado del cliente y devuelto el stock:', telNorm);
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
      const order = await prepare('SELECT estado, telefono, total, descuento, cliente FROM pedidos WHERE numero = ?').get(num);
      // Solo revertir estadísticas del cliente y devolver stock si el pedido no
      // estaba ya cancelado (si lo estaba, ya se revirtió/devolvió en su momento;
      // repetirlo aquí restaría dos veces y dejaría al cliente con saldo negativo falso).
      if (order && order.telefono && order.estado !== 'Cancelado') {
        const telNorm = normalizePhone(order.telefono);
        await ensureClientExists(telNorm, order.cliente);
        await prepare('UPDATE clientes SET total_pedidos = MAX(0, total_pedidos - 1), total_gastado = MAX(0, total_gastado - ?), total_descuentos = MAX(0, total_descuentos - ?) WHERE telefono = ?')
          .run(parseFloat(order.total) || 0, parseFloat(order.descuento) || 0, telNorm);
        await restoreStockForOrder(num);
        await restoreIngredientsForOrder(num);
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
          await restoreStockForOrder(num);
          await restoreIngredientsForOrder(num);
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
