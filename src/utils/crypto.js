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

function encrypt(text) {
  if (text === null || text === undefined || text === '') return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

// Si el valor no tiene el prefijo, es un dato viejo guardado antes de este
// cambio (texto plano) — se devuelve tal cual en vez de fallar, para no
// romper el envío de emails ya configurado.
function decrypt(value) {
  if (!value || typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (e) {
    return value;
  }
}

module.exports = { encrypt, decrypt };
