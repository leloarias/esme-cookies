const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const cloudinary = require('cloudinary').v2;
const { Server } = require('socket.io');
require('dotenv').config();
const bcrypt = require('bcryptjs');

let db;
let orderCounter = 0;
const { initDatabase, prepare, exec, saveDatabase, getDb } = require('./database');
const { generateToken, verifyToken } = require('./auth');
const { sendNewOrderEmail } = require('./email');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});
const PORT = process.env.PORT || 3000;

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_TIMEOUT = 15 * 60 * 1000;

function checkLoginAttempts(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return true;
  if (Date.now() - record.lastAttempt > LOGIN_TIMEOUT) {
    loginAttempts.delete(ip);
    return true;
  }
  if (record.attempts >= MAX_LOGIN_ATTEMPTS) return false;
  return true;
}

function recordLoginAttempt(ip, success) {
  const record = loginAttempts.get(ip) || { attempts: 0, lastAttempt: 0 };
  if (success) {
    loginAttempts.delete(ip);
  } else {
    record.attempts++;
    record.lastAttempt = Date.now();
    loginAttempts.set(ip, record);
  }
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '').trim().substring(0, 2000);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

['images', 'uploads'].forEach(dir => {
  const dirPath = path.join(__dirname, 'public', dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Health check para UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('Cliente conectado a WebSocket:', socket.id);
});

// -----------------------------------------------------
// Rutas de Autenticación
// -----------------------------------------------------
app.post('/api/admin/login', async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  if (!checkLoginAttempts(clientIP)) {
    return res.status(429).json({ 
      error: 'Demasiados intentos. Por favor espera 15 minutos.',
      retryAfter: 15
    });
  }

  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }
  
  const sanitizedUsername = sanitizeString(username);
  if (sanitizedUsername.length < 2) {
    recordLoginAttempt(clientIP, false);
    return res.status(400).json({ error: 'Usuario inválido' });
  }

  const admin = await prepare('SELECT * FROM administradores WHERE username = ?').get(sanitizedUsername);
  if (!admin) {
    recordLoginAttempt(clientIP, false);
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const pwordMatch = bcrypt.compareSync(password, admin.password_hash);
  if (!pwordMatch) {
    recordLoginAttempt(clientIP, false);
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  
  recordLoginAttempt(clientIP, true);
  const token = generateToken(admin);
  console.log(`[${new Date().toISOString()}] Login exitoso: ${sanitizedUsername} desde ${clientIP}`);
  
  res.json({ success: true, token, adminId: admin.id });
});

// -----------------------------------------------------
// Rutas de Configuración
// -----------------------------------------------------
app.get('/api/config', verifyToken, async (req, res) => {
  try {
    const config = await prepare('SELECT * FROM config WHERE id = 1').get() || { pickupAddress: '', deliveryPrice: 0, envioPrice: 0 };
    delete config.emailPass;
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al leer config' });
  }
});

app.post('/api/config', verifyToken, async (req, res) => {
  try {
    const currentConfig = await prepare('SELECT * FROM config WHERE id=1').get() || {};
    const wasOpen = currentConfig.isOpen;
    
    const body = req.body;
    
    if (body.isOpen !== undefined) {
      await prepare('UPDATE config SET isOpen=? WHERE id=1').run(body.isOpen);
    }
    if (body.deliveryPrice !== undefined) {
      await prepare('UPDATE config SET deliveryPrice=? WHERE id=1').run(body.deliveryPrice);
    }
    if (body.envioPrice !== undefined) {
      await prepare('UPDATE config SET envioPrice=? WHERE id=1').run(body.envioPrice);
    }
    if (body.shopName !== undefined) {
      await prepare('UPDATE config SET shopName=? WHERE id=1').run(body.shopName);
    }
    if (body.shopPhone !== undefined) {
      await prepare('UPDATE config SET shopPhone=? WHERE id=1').run(body.shopPhone);
    }
    if (body.pickupAddress !== undefined) {
      await prepare('UPDATE config SET pickupAddress=? WHERE id=1').run(body.pickupAddress);
    }
    if (body.currency !== undefined) {
      await prepare('UPDATE config SET currency=? WHERE id=1').run(body.currency);
    }
    if (body.primaryColor !== undefined) {
      await prepare('UPDATE config SET primaryColor=? WHERE id=1').run(body.primaryColor);
    }
    if (body.accentColor !== undefined) {
      await prepare('UPDATE config SET accentColor=? WHERE id=1').run(body.accentColor);
    }
    if (body.emailUser !== undefined) {
      await prepare('UPDATE config SET emailUser=? WHERE id=1').run(body.emailUser);
    }
    if (body.emailPass) {
      await prepare('UPDATE config SET emailPass=? WHERE id=1').run(body.emailPass);
    }
    if (body.adminEmail !== undefined) {
      await prepare('UPDATE config SET adminEmail=? WHERE id=1').run(body.adminEmail);
    }
    if (body.emailHost !== undefined) {
      await prepare('UPDATE config SET emailHost=? WHERE id=1').run(body.emailHost);
    }
    if (body.emailPort !== undefined) {
      await prepare('UPDATE config SET emailPort=? WHERE id=1').run(body.emailPort);
    }
    if (body.emailSecure !== undefined) {
      await prepare('UPDATE config SET emailSecure=? WHERE id=1').run(body.emailSecure);
    }
    if (body.emailTemplate !== undefined) {
      await prepare('UPDATE config SET emailTemplate=? WHERE id=1').run(body.emailTemplate);
    }
    if (body.emailNotifications !== undefined) {
      await prepare('UPDATE config SET emailNotifications=? WHERE id=1').run(body.emailNotifications);
    }
    if (body.bankAccounts !== undefined) {
      let value = body.bankAccounts;
      if (typeof value !== 'string') {
        value = JSON.stringify(value);
      }
      await prepare('UPDATE config SET bankAccounts=? WHERE id=1').run(value);
    }
    if (body.msgEsperandoPago !== undefined) {
      await prepare('UPDATE config SET msgEsperandoPago=? WHERE id=1').run(body.msgEsperandoPago);
    }
    if (body.msgPagoConfirmado !== undefined) {
      await prepare('UPDATE config SET msgPagoConfirmado=? WHERE id=1').run(body.msgPagoConfirmado);
    }
    if (body.msgPreparando !== undefined) {
      await prepare('UPDATE config SET msgPreparando=? WHERE id=1').run(body.msgPreparando);
    }
    if (body.msgListo !== undefined) {
      await prepare('UPDATE config SET msgListo=? WHERE id=1').run(body.msgListo);
    }
    if (body.msgEntregado !== undefined) {
      await prepare('UPDATE config SET msgEntregado=? WHERE id=1').run(body.msgEntregado);
    }
    
    const newIsOpen = body.isOpen !== undefined ? body.isOpen : wasOpen;
    
    if (wasOpen != newIsOpen) {
      if (newIsOpen == 0) {
        io.emit('tienda_cerrada');
        console.log('[CONFIG] Tienda CERRADA');
      } else {
        io.emit('tienda_abierta');
        console.log('[CONFIG] Tienda ABIERTA');
      }
    }
    
    io.emit('config_update', {
      isOpen: newIsOpen,
      deliveryPrice: body.deliveryPrice,
      envioPrice: body.envioPrice,
      shopPhone: body.shopPhone,
      shopName: body.shopName
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error al guardar config:', err);
    res.status(500).json({ error: 'Error al guardar config: ' + err.message });
  }
});

app.get('/api/public-config', async (req, res) => {
  try {
    const config = await prepare(`SELECT shopName, shopPhone, currency, primaryColor, accentColor, isOpen, pickupAddress, deliveryPrice, envioPrice, bankAccounts,
      msgEsperandoPago, msgPagoConfirmado, msgPreparando, msgListo, msgEntregado FROM config WHERE id = 1`).get();
    if (config && config.bankAccounts) {
      try {
        let parsed = JSON.parse(config.bankAccounts);
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        config.bankAccounts = Array.isArray(parsed) ? parsed : [];
      } catch(e) {
        config.bankAccounts = [];
      }
    } else if (config) {
      config.bankAccounts = [];
    }
    res.json(config || {});
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener config pública' });
  }
});

// Recalcular totales de clientes desde pedidos reales
app.post('/api/clientes/recalcular', verifyToken, async (req, res) => {
  try {
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

    res.json({ success: true, actualizados, creados, eliminados });
  } catch (err) {
    console.error('Error recalculando clientes:', err);
    res.status(500).json({ error: 'Error al recalcular' });
  }
});

// -----------------------------------------------------
// Rutas de Administradores
// -----------------------------------------------------
app.get('/api/administradores', verifyToken, async (req, res) => {
  try {
    const admins = await prepare('SELECT id, username FROM administradores').all();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener admins' });
  }
});

app.post('/api/administradores', verifyToken, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    await prepare('INSERT INTO administradores (username, password_hash) VALUES (?, ?)').run(username, hash);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear admin, posible usuario duplicado' });
  }
});

app.put('/api/administradores/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Falta contraseña' });
  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    await prepare('UPDATE administradores SET password_hash = ? WHERE id = ?').run(hash, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar admin' });
  }
});

app.delete('/api/administradores/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    const row = await prepare('SELECT COUNT(*) as c FROM administradores').get();
    if (row.c <= 1) return res.status(400).json({ error: 'No se puede eliminar el único administrador' });
    await prepare('DELETE FROM administradores WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar admin' });
  }
});

// -----------------------------------------------------
// Rutas de Promociones
// -----------------------------------------------------
app.get('/api/promociones', async (req, res) => {
  try {
    const promosRaw = await prepare(`
      SELECT * FROM promociones 
      WHERE activa = 1 
      ORDER BY orden ASC, id DESC
    `).all();
    res.json(promosRaw);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener promociones' });
  }
});

app.get('/api/promociones/all', verifyToken, async (req, res) => {
  try {
    const promos = await prepare('SELECT * FROM promociones ORDER BY activa DESC, orden ASC, id DESC').all();
    res.json(promos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener promociones' });
  }
});

app.post('/api/promociones', verifyToken, async (req, res) => {
  const { titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, color, emoji, imagen, orden } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const info = await prepare(
      'INSERT INTO promociones (titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, color, emoji, imagen, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(titulo, descripcion || '', tipo || 'banner', descuento_pct || 0, descuento_fijo || 0, aplica_a || 'todos', productos_ids || '', categoria || 'todos', compra_minima || 0, cantidad_minima || 0, producto_gratis_id || null, activa !== false ? 1 : 0, fecha_inicio || '', fecha_fin || '', hora_inicio || null, hora_fin || null, limite_usos || null, solo_clientes_nuevos ? 1 : 0, color || '#C9883A', emoji || '🎉', imagen || '', orden || 0);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear promoción: ' + err.message });
  }
});

app.put('/api/promociones/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { titulo, descripcion, tipo, descuento_pct, descuento_fijo, aplica_a, productos_ids, categoria, compra_minima, cantidad_minima, producto_gratis_id, activa, fecha_inicio, fecha_fin, hora_inicio, hora_fin, limite_usos, solo_clientes_nuevos, color, emoji, imagen, orden } = req.body;
  try {
    const current = await prepare('SELECT activa FROM promociones WHERE id = ?').get(id);
    const willBeActive = activa ? 1 : 0;
    
    if (current && current.activa == 0 && willBeActive == 1) {
      await prepare('UPDATE promociones SET usos_actuales = 0 WHERE id = ?').run(id);
    }

    await prepare(
      'UPDATE promociones SET titulo=?, descripcion=?, tipo=?, descuento_pct=?, descuento_fijo=?, aplica_a=?, productos_ids=?, categoria=?, compra_minima=?, cantidad_minima=?, producto_gratis_id=?, activa=?, fecha_inicio=?, fecha_fin=?, hora_inicio=?, hora_fin=?, limite_usos=?, solo_clientes_nuevos=?, color=?, emoji=?, imagen=?, orden=? WHERE id=?'
    ).run(titulo, descripcion || '', tipo || 'banner', descuento_pct || 0, descuento_fijo || 0, aplica_a || 'todos', productos_ids || '', categoria || 'todos', compra_minima || 0, cantidad_minima || 0, producto_gratis_id || null, willBeActive, fecha_inicio || '', fecha_fin || '', hora_inicio || '', hora_fin || '', limite_usos || null, solo_clientes_nuevos ? 1 : 0, color || '#C9883A', emoji || '🎉', imagen || '', orden || 0, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar promoción: ' + err.message });
  }
});

app.delete('/api/promociones/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    await prepare('DELETE FROM promociones WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar promoción' });
  }
});

// -----------------------------------------------------
// Rutas de Clientes
// -----------------------------------------------------
app.get('/api/clientes', verifyToken, async (req, res) => {
  try {
    const clientes = await prepare('SELECT * FROM clientes WHERE activo = 1 ORDER BY total_gastado DESC').all();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

app.get('/api/clientes/all', verifyToken, async (req, res) => {
  try {
    const clientes = await prepare('SELECT * FROM clientes ORDER BY total_gastado DESC').all();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

app.get('/api/clientes/buscar', verifyToken, async (req, res) => {
  const q = req.query.q || '';
  try {
    const clientes = await prepare('SELECT * FROM clientes WHERE activo = 1 AND (nombre LIKE ? OR telefono LIKE ?) ORDER BY total_gastado DESC LIMIT 20')
      .all(`%${q}%`, `%${q}%`);
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar clientes' });
  }
});

app.post('/api/clientes/:id/reactivar', verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    await prepare('UPDATE clientes SET activo = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al reactivar cliente' });
  }
});

app.put('/api/clientes/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { nombre, telefono, email, direccion, sector, notas, activo } = req.body;
  try {
    const telNorm = normalizePhone(telefono);
    await prepare('UPDATE clientes SET nombre=?, telefono=?, email=?, direccion=?, sector=?, notas=?, activo=? WHERE id=?')
      .run(nombre, telNorm, email || '', direccion || '', sector || '', notas || '', activo !== undefined ? activo : 1, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

app.delete('/api/clientes/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const hardDelete = req.query.hard === 'true';
  try {
    if (hardDelete) {
      await prepare('DELETE FROM clientes WHERE id = ?').run(id);
    } else {
      await prepare('UPDATE clientes SET activo = 0 WHERE id = ?').run(id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

app.post('/api/clientes', verifyToken, async (req, res) => {
  const { nombre, telefono, email, direccion, sector, notas } = req.body;
  if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
  try {
    const info = await prepare('INSERT INTO clientes (nombre, telefono, email, direccion, sector, notas) VALUES (?, ?, ?, ?, ?, ?)')
      .run(nombre, telefono, email || '', direccion || '', sector || '', notas || '');
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

app.get('/api/clientes/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const cliente = await prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    console.error('Error getting cliente:', err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

async function saveClientFromOrder(cliente, telefono, direccion, sector, total, descuento) {
  try {
    const descuentoNum = parseFloat(descuento) || 0;
    const telefonoNorm = normalizePhone(telefono);
    if (!telefonoNorm) return;
    const totalNum = parseFloat(total) || 0;
    const now = new Date();
    const fechaStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear();
    const existing = await prepare('SELECT id, nombre, activo FROM clientes WHERE telefono = ?').get(telefonoNorm);
    if (existing) {
      await prepare('UPDATE clientes SET nombre=?, direccion=?, sector=?, total_pedidos=total_pedidos+1, total_gastado=total_gastado+?, total_descuentos=total_descuentos+?, ultimo_pedido=? WHERE id=?')
        .run(cliente, direccion || '', sector || '', totalNum, descuentoNum, fechaStr, existing.id);
    } else {
      await prepare('INSERT INTO clientes (nombre, telefono, direccion, sector, total_pedidos, total_gastado, total_descuentos, ultimo_pedido, activo) VALUES (?, ?, ?, ?, 1, ?, ?, ?, 1)')
        .run(cliente, telefonoNorm, direccion || '', sector || '', totalNum, descuentoNum, fechaStr);
    }
    console.log('Client saved:', telefonoNorm);
  } catch (err) {
    console.error('Error guardando cliente:', err);
  }
}

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

async function decrementPromoUsos() {
  try {
    await prepare('UPDATE promociones SET usos_actuales = usos_actuales + 1 WHERE activa = 1 AND limite_usos IS NOT NULL AND limite_usos > 0 AND usos_actuales < limite_usos').run();
  } catch (err) {
    console.error('Error decrementando usos de promos:', err);
  }
}

// -----------------------------------------------------
// Rutas de Productos
// -----------------------------------------------------
app.get('/api/products', async (req, res) => {
  try {
    const products = await prepare('SELECT * FROM productos').all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.post('/api/products', verifyToken, async (req, res) => {
  const { nombre, precio, descripcion, imagen } = req.body;
  if (!nombre || !precio) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const info = await prepare('INSERT INTO productos (nombre, precio, descripcion, imagen) VALUES (?, ?, ?, ?)')
      .run(nombre, precio, descripcion || '', imagen || '');
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar producto' });
  }
});

app.put('/api/products/:id', verifyToken, async (req, res) => {
  const { nombre, precio, descripcion, imagen } = req.body;
  const id = req.params.id;
  try {
    const current = await prepare('SELECT * FROM productos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Producto no encontrado' });

    await prepare('UPDATE productos SET nombre = ?, precio = ?, descripcion = ?, imagen = ? WHERE id = ?')
      .run(nombre || current.nombre, precio || current.precio, descripcion || '', imagen || '', id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'Error al actualizar producto: ' + err.message });
  }
});

app.delete('/api/products/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    await prepare('DELETE FROM productos WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// -----------------------------------------------------
// Rutas de Pedidos
// -----------------------------------------------------
app.get('/api/orders', verifyToken, async (req, res) => {
  try {
    const orders = await prepare('SELECT * FROM pedidos ORDER BY id DESC').all();
    orders.forEach(o => {
      try { o.estado_timestamps = JSON.parse(o.estado_timestamps); } catch(e) { o.estado_timestamps = {}; }
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

app.get('/api/orders/cliente/:telefono', async (req, res) => {
  try {
    const telefono = req.params.telefono;
    const orders = await prepare('SELECT * FROM pedidos WHERE telefono = ?').all(telefono);
    orders.forEach(o => {
      try { o.estado_timestamps = JSON.parse(o.estado_timestamps); } catch(e) { o.estado_timestamps = {}; }
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos del cliente' });
  }
});

app.get('/api/orders/:num', verifyToken, async (req, res) => {
  try {
    const order = await prepare('SELECT * FROM pedidos WHERE numero = ?').get(req.params.num);
    if (!order) return res.status(404).json({ error: 'No encontrado' });
    try { order.estado_timestamps = JSON.parse(order.estado_timestamps); } catch(e) { order.estado_timestamps = {}; }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/orders', async (req, res) => {
  let { cliente, telefono, productos, cantidad, precio, subtotal, envio, total, pago, tipo_entrega, observaciones, direccion, sector, nota } = req.body;
  
  cliente = sanitizeString(cliente);
  telefono = sanitizeString(telefono);
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
  
  const now = new Date();
  const drTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(now);
  
  const parts = drTime.split(/[\s,]+/);
  const currentDate = parts[0];
  const currentTime = parts[1] ? parts[1].substring(0, 5) : "00:00"; 
  
  console.log(`[Order Debug] DR Date: ${currentDate}, DR Time: ${currentTime}, Subtotal: ${subtotal}, Cantidad: ${cantidad}`);

  const promosActivasRaw = await prepare("SELECT * FROM promociones WHERE activa = 1").all();
  
  const promosActivas = promosActivasRaw.filter(p => {
    if (p.limite_usos && p.limite_usos > 0) {
      const usosActuales = p.usos_actuales || 0;
      if (usosActuales >= p.limite_usos) {
        console.log(`[Order Debug] Promo ${p.titulo} rechazada: límite de usos alcanzado (${usosActuales}/${p.limite_usos})`);
        return false;
      }
    }
    if (p.fecha_inicio && p.fecha_inicio > currentDate) return false;
    if (p.fecha_fin && p.fecha_fin < currentDate) return false;
    if (p.hora_inicio && p.hora_inicio > currentTime) return false;
    if (p.hora_fin && p.hora_fin < currentTime) return false;
    return true;
  });

  let descuentoTotal = 0;
  let envioDescuento = 0;
  let promosAplicadas = [];
  
  const subTotalNum = parseFloat(subtotal) || 0;
  const tipoEntrega = tipo_entrega || 'pickup';
  const totalItems = parseInt(cantidad) || 0;
  
  const cartItemsArr = req.body.cartItems || []; 
  console.log(`[Order Debug] cartItemsArr length: ${cartItemsArr.length}`);

  promosActivas.forEach(promo => {
    let aplica = false;
    let ahorro = 0;

    if (promo.compra_minima > 0 && subTotalNum < promo.compra_minima) {
       console.log(`[Order Debug] Promo ${promo.titulo} rechazada: compra_minima ${promo.compra_minima} > ${subTotalNum}`);
       return;
    }
    if (promo.cantidad_minima > 0 && totalItems < promo.cantidad_minima) {
       console.log(`[Order Debug] Promo ${promo.titulo} rechazada: cantidad_minima ${promo.cantidad_minima} > ${totalItems}`);
       return;
    }

    switch(promo.tipo) {
      case 'descuento_pct':
        ahorro = Math.round(subTotalNum * (promo.descuento_pct / 100));
        aplica = ahorro > 0;
        break;
      case 'descuento_fijo':
        ahorro = promo.descuento_fijo;
        aplica = subTotalNum > 0;
        break;
      case 'free_delivery':
        if (tipoEntrega === 'delivery') {
          envioDescuento = parseFloat(envio) || 0;
          ahorro = envioDescuento;
          aplica = true;
        }
        break;
      case 'free_envio':
        if (tipoEntrega === 'envio') {
          envioDescuento = parseFloat(envio) || 0;
          ahorro = envioDescuento;
          aplica = true;
        }
        break;
      case 'free_all':
        if (tipoEntrega !== 'pickup') {
          envioDescuento = parseFloat(envio) || 0;
          ahorro = envioDescuento;
          aplica = true;
        }
        break;
      case 'bogo':
        if (totalItems >= 3) {
          let precios = [];
          if (cartItemsArr.length > 0) {
            cartItemsArr.forEach(item => {
              for(let i=0; i<item.qty; i++) precios.push(item.precio);
            });
          } else if (precio) {
            precios = String(precio).split(',').map(p => parseFloat(p.trim()) || 0).filter(p => p > 0);
          }
          
          if (precios.length >= 3) {
            const gruposGratuitos = Math.floor(precios.length / 3);
            precios.sort((a, b) => a - b);
            ahorro = precios.slice(0, gruposGratuitos).reduce((a, b) => a + b, 0);
            aplica = true;
          }
        }
        break;
    }

    if (aplica && ahorro > 0) {
      descuentoTotal += (promo.tipo.startsWith('free_') ? 0 : ahorro);
      promosAplicadas.push({ 
        id: promo.id,
        tipo: promo.tipo, 
        titulo: promo.titulo, 
        ahorro: ahorro 
      });
    }
  });
  
  const descuentoFinal = Math.min(descuentoTotal, subTotalNum);
  const promosJson = JSON.stringify(promosAplicadas);
  const descuentoDetalles = promosAplicadas.map(p => `${p.titulo}: -RD$${p.ahorro}`).join(', ');
  
  const today = new Date();
  const datePrefix = String(today.getFullYear()) + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const fechaStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  try {
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
    
    console.log('New order number:', newNum);

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
    io.emit('nuevo_pedido', orderData);
    sendNewOrderEmail(orderData);
    await saveClientFromOrder(cliente, telefono, direccion || '', sector || '', totalConDescuento, descuentoFinal + envioDescuento);
    
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

app.put('/api/orders/:num', verifyToken, async (req, res) => {
  const num = req.params.num;
  const { cliente, telefono, productos, cantidad, precio, subtotal, envio, total, pago, estado, observaciones, tipo_entrega, estado_timestamp, estado_anterior } = req.body;
  
  console.log('[PUT Order] Updating order:', num, 'New state:', estado, 'Previous:', estado_anterior);
  
  try {
    const existing = await prepare('SELECT * FROM pedidos WHERE numero = ?').get(num);
    if (!existing) {
      console.log('[PUT Order] Order not found:', num);
      return res.status(404).json({error: 'Pedido no encontrado'});
    }

    let timestamps = {};
    try { timestamps = existing.estado_timestamps ? JSON.parse(existing.estado_timestamps) : {}; } catch(e){}

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
    }
    
    console.log('[PUT Order] Success:', num, 'New state:', estado);
    res.json({ success: true });
  } catch(err) {
    console.error('[PUT Order] Error:', err);
    res.status(500).json({ error: 'Error al actualizar pedido: ' + err.message });
  }
});

app.delete('/api/orders/:num', verifyToken, async (req, res) => {
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
        try { timestamps = JSON.parse(order.estado_timestamps || '{}'); } catch(e){}
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
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar eliminacion' });
  }
});

// -----------------------------------------------------
// Estadísticas (Stats)
// -----------------------------------------------------
app.get('/api/stats', verifyToken, async (req, res) => {
  try {
    const orders = await prepare('SELECT * FROM pedidos').all();
    const porTipoEntrega = { pickup: 0, delivery: 0, envio: 0 };
    const productosCount = {};
    
    let ventas = 0, pendientes = 0, confirmados = 0, listos = 0, cancelados = 0, prodVendidos = 0;

    orders.forEach(o => {
      ventas += (o.total || 0);
      prodVendidos += (o.cantidad || 0);
      
      if (porTipoEntrega[o.tipo_entrega] !== undefined) porTipoEntrega[o.tipo_entrega]++;
      
      if (o.estado === 'Pendiente') pendientes++;
      else if (o.estado === 'Confirmado') confirmados++;
      else if (o.estado === 'Entregado') listos++;
      else if (o.estado === 'Cancelado') cancelados++;

      if (o.productos) {
        o.productos.split(',').forEach(p => {
          const match = p.trim().match(/^(.+?)\s*x\d+$/);
          const name = match ? match[1].trim() : p.trim();
          productosCount[name] = (productosCount[name] || 0) + 1;
        });
      }
    });

    const topProductos = Object.entries(productosCount).sort((a,b) => b[1]-a[1]).slice(0, 10);
    const ticketPromedio = orders.length > 0 ? Math.round(ventas / orders.length) : 0;

    res.json({
      total: orders.length, ventas, pendientes, confirmados, listos, cancelados,
      productosVendidos: prodVendidos, ticketPromedio, porTipoEntrega, topProductos
    });
  } catch(err) {
    res.status(500).json({ error: 'Error calculando estadisticas' });
  }
});

// -----------------------------------------------------
// Carga de Imágenes (Upload)
// -----------------------------------------------------
app.post('/api/upload-image', verifyToken, async (req, res) => {
  try {
    const { imagen, filename } = req.body;
    if (!imagen || !filename) return res.status(400).json({ error: 'Faltan datos' });

    // Subir a Cloudinary
    const result = await cloudinary.uploader.upload(imagen, {
      folder: 'esme-cookies',
      public_id: `product_${Date.now()}`,
      overwrite: true,
      resource_type: 'image'
    });

    res.json({ success: true, url: result.secure_url });
  } catch(err) {
    console.error('Error subiendo imagen a Cloudinary:', err.message);
    res.status(500).json({ error: 'Error subiendo imagen: ' + err.message });
  }
});

app.post('/api/reporte/generate', verifyToken, (req, res) => {
  res.json({ success: true, message: 'Reporte Excel ya no soportado, implementaremos CSV en el futuro.'});
});

app.post('/api/test-email', verifyToken, async (req, res) => {
  const { sendNewOrderEmail } = require('./email');
  try {
    await sendNewOrderEmail({
      numero: 'TEST',
      cliente: 'Prueba del Sistema',
      telefono: 'N/A',
      productos: 'Email de prueba',
      total: 0,
      tipo_entrega: 'test',
      observaciones: 'Este es un email de prueba enviado desde el panel de administración.'
    });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: 'Error enviando email: ' + err.message });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Arrancar Servidor
async function startServer() {
  try {
    db = await initDatabase();
    console.log('Base de datos inicializada correctamente');
    
    const maxOrder = await prepare('SELECT MAX(numero) as maxNum FROM pedidos').get();
    orderCounter = maxOrder?.maxNum || parseInt(new Date().getFullYear() + '0100000');
    console.log('Order counter initialized:', orderCounter);
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log('═══════════════════════════════════════════════');
      console.log('   🍪 ESME COOKIES - Servidor Online');
      console.log('═══════════════════════════════════════════════');
      console.log(`   Puerto: ${PORT}`);
      console.log('═══════════════════════════════════════════════');
    });

    // Verificador de expiración cada minuto
    setInterval(async () => {
      try {
        const now = new Date();
        const drTime = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Santo_Domingo',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false
        }).format(now);
        
        const parts = drTime.split(/[\s,]+/);
        const currentDate = parts[0];
        const currentTime = parts[1] ? parts[1].substring(0, 5) : "00:00";

        try {
          const expiredPromos = await prepare(
            'SELECT id, titulo FROM promociones WHERE activa = 1 AND fecha_fin < ?'
          ).all(currentDate);

          if (expiredPromos.length > 0) {
            for (const p of expiredPromos) {
              console.log(`[Promo] Expirando automaticamente: ${p.titulo}`);
              await prepare('UPDATE promociones SET activa = 0 WHERE id = ?').run(p.id);
              io.emit('promo_expirada', { id: p.id, titulo: p.titulo });
            }
            io.emit('ofertas_update');
          }
        } catch (promoErr) {
          console.error('Error verificando promos:', promoErr.message);
        }

        // Cancelar pedidos pendientes después de 24 horas
        try {
          const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const cutoffISO = cutoffTime.toISOString();
          const allPending = await prepare(
            "SELECT numero, cliente, telefono, created_at FROM pedidos WHERE estado IN ('Pendiente', 'Esperando Pago')"
          ).all();

          for (const o of allPending) {
            if (o.created_at) {
              const createdDate = new Date(o.created_at);
              if (!isNaN(createdDate.getTime()) && createdDate < cutoffTime) {
                console.log(`[Order] Cancelando pedido sin confirmar: #${o.numero} (creado: ${o.created_at})`);
                await prepare('UPDATE pedidos SET estado = ? WHERE numero = ?').run('Cancelado', o.numero);
                io.emit('pedido_cancelado', { numero: o.numero, cliente: o.cliente });
              }
            }
          }
        } catch (orderErr) {
          console.error('Error verificando pedidos viejos:', orderErr.message);
        }
      } catch (err) {
        console.error('Error verificando promos expiradas:', err);
      }
    }, 60000);
  } catch (err) {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  }
}

startServer();
