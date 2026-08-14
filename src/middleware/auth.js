const jwt = require('jsonwebtoken');

// Clave secreta para firmar los tokens.
// IMPORTANTE: debe ser un valor FIJO (definido en .env). Antes se generaba
// aleatoriamente en producción, lo que invalidaba todas las sesiones admin
// en cada reinicio del servidor (PM2).
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] Falta JWT_SECRET en el entorno (.env). Define un valor ' +
      'fijo y secreto antes de arrancar en producción.\n' +
      '  Genéralo con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
  }
  // Solo desarrollo local: valor estable (no aleatorio) para no cerrar sesión al reiniciar.
  console.warn('[auth] JWT_SECRET no definido: usando clave de DESARROLLO. No usar en producción.');
  JWT_SECRET = 'dev_only_esme_cookies_insecure_key';
}

// Configuración de algoritmo y expires
const JWT_OPTIONS = {
  algorithm: 'HS512',
  expiresIn: '8h', // Reducido de 24h a 8h para mayor seguridad
  issuer: 'esme-cookies-app'
};

function generateToken(adminUser) {
  const payload = {
    username: adminUser.username,
    id: adminUser.id,
    iat: Math.floor(Date.now() / 1000),
    type: 'admin_access'
  };
  
  return jwt.sign(payload, JWT_SECRET, JWT_OPTIONS);
}

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Acceso denegado, token faltante.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Formato de token inválido.' });
  }

  const token = parts[1];

  try {
    const verified = jwt.verify(token, JWT_SECRET, { algorithms: ['HS512'] });
    
    // Verificar que es un token de acceso admin
    if (verified.type !== 'admin_access') {
      return res.status(401).json({ error: 'Token inválido para esta acción.' });
    }
    
    req.admin = verified;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada. Por favor, inicia sesión nuevamente.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token no válido.' });
    }
    res.status(401).json({ error: 'Error de autenticación.' });
  }
}

module.exports = {
  generateToken,
  verifyToken
};
