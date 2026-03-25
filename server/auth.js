const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generar clave secreta segura
const JWT_SECRET = process.env.JWT_SECRET || 
  (process.env.NODE_ENV === 'production' 
    ? crypto.randomBytes(64).toString('hex')
    : 'super_secret_esme_cookies_key_123');

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
