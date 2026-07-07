// Utilidades puras compartidas por todo el backend.

// Normaliza un teléfono a los últimos 10 dígitos (quita todo lo no numérico).
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10);
}

// Limpieza básica de strings de entrada (quita < >, recorta a 2000 chars).
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '').trim().substring(0, 2000);
}

// Fecha y hora actuales en la zona horaria de República Dominicana.
// Devuelve { date: 'YYYY-MM-DD', time: 'HH:MM' }.
function getDominicanDateTime(now = new Date()) {
  const drTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(now);

  const parts = drTime.split(/[\s,]+/);
  const date = parts[0];
  const time = parts[1] ? parts[1].substring(0, 5) : '00:00';
  return { date, time };
}

module.exports = {
  normalizePhone,
  sanitizeString,
  getDominicanDateTime
};
