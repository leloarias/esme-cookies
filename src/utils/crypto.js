// Cifrado simétrico para secretos que el servidor necesita poder leer de
// vuelta (a diferencia de una contraseña de login, que se hashea y nunca se
// descifra). Hoy el único caso es config.emailPass (la contraseña de la
// app de Gmail): sin esto quedaba en texto plano en la base de datos.
//
// La clave sale del propio JWT_SECRET (ya es obligatorio y fuerte en
// producción — el servidor no arranca sin él) para no depender de otra
// variable de entorno más que alguien pueda olvidar configurar.
const crypto = require('crypto');

const PREFIX = 'enc1:';

function getKey() {
  const secret = process.env.JWT_SECRET || 'dev_only_esme_cookies_insecure_key';
  return crypto.createHash('sha256').update(secret).digest();
}

// CBC en vez de GCM a propósito: GCM usa la instrucción de CPU PCLMULQDQ
// (disponible recién desde ~2010) y provoca "Illegal instruction" en
// hardware viejo (confirmado en un Core 2 Duo de 2007). CBC no la necesita
// y corre en cualquier CPU x86.
function encrypt(text) {
  if (text === null || text === undefined || text === '') return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, ciphertext]).toString('base64');
}

// Si el valor no tiene el prefijo, es un dato viejo guardado antes de este
// cambio (texto plano) — se devuelve tal cual en vez de fallar, para no
// romper el envío de emails ya configurado.
function decrypt(value) {
  if (!value || typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 16);
    const ciphertext = raw.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (e) {
    return value;
  }
}

module.exports = { encrypt, decrypt };
