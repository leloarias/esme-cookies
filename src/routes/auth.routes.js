const express = require('express');
const bcrypt = require('bcryptjs');
const { prepare } = require('../db');
const { generateToken } = require('../middleware/auth');
const { sanitizeString } = require('../utils/helpers');

const router = express.Router();

// Control de intentos de login por IP (rate limiting simple en memoria).
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

router.post('/api/admin/login', async (req, res) => {
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

module.exports = router;
