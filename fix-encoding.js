const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node fix-encoding.js <file>'); process.exit(1); }

const buggyToCorrect = new Map();
// Sospechosos: 4-byte UTF-8 emojis corruptos por doble encoding (latin-1+utf8)
const candidates = [
  // 🍪 F0 9F 8D AA
  { bug: 'C3 B0 C5 B8 C2 8D C2 AA', good: 'F0 9F 8D AA' },
  // 🎉 F0 9F 8E 89
  { bug: 'C3 B0 C5 B8 C2 8E C2 89', good: 'F0 9F 8E 89' },
  // 📋 F0 9F 93 8B
  { bug: 'C3 B0 C5 B8 C2 93 C2 8B', good: 'F0 9F 93 8B' },
  // 👤 F0 9F 91 A4
  { bug: 'C3 B0 C5 B8 C2 91 C2 A4', good: 'F0 9F 91 A4' },
  // 🚚 F0 9F 9A 9A
  { bug: 'C3 B0 C5 B8 C2 9A C2 9A', good: 'F0 9F 9A 9A' },
  // 📦 F0 9F 93 A6
  { bug: 'C3 B0 C5 B8 C2 93 C2 A6', good: 'F0 9F 93 A6' },
  // 💰 F0 9F 92 B0
  { bug: 'C3 B0 C5 B8 C2 92 C2 B0', good: 'F0 9F 92 B0' },
  // 💳 F0 9F 92 B3
  { bug: 'C3 B0 C5 B8 C2 92 C2 B3', good: 'F0 9F 92 B3' },
  // 📍 F0 9F 93 CD
  { bug: 'C3 B0 C5 B8 C2 93 C2 8D', good: 'F0 9F 93 ED' },
  // ⏰ ó ⚠️ otros...
  // 👑 F0 9F 91 91
  { bug: 'C3 B0 C5 B8 C2 91 C2 91', good: 'F0 9F 91 91' },
  // 🎁 F0 9F 8E 81
  { bug: 'C3 B0 C5 B8 C2 8E C2 81', good: 'F0 9F 8E 81' },
  // 🛒 F0 9F 9B 92
  { bug: 'C3 B0 C5 B8 C2 9B C2 92', good: 'F0 9F 9B 92' },
  // 🏠 F0 9F 8F A0
  { bug: 'C3 B0 C5 B8 C2 8F C2 A0', good: 'F0 9F 8F A0' },
  // ⭐ F0 9F 8C 9F
  { bug: 'C3 B0 C5 B8 C2 8C C2 9F', good: 'F0 9F 8C 9F' },
  // 🏪 F0 9F 8F AA
  { bug: 'C3 B0 C5 B8 C2 8F C2 AA', good: 'F0 9F 8F AA' },
  // 🚗 F0 9F 9A 97
  { bug: 'C3 B0 C5 B8 C2 9A C2 97', good: 'F0 9F 9A 97' },
  // 📦 rpido
  // ✉️ F0 9F 93 A9
  { bug: 'C3 B0 C5 B8 C2 93 C2 A9', good: 'F0 9F 93 A9' },
  // ✅ F0 9F 91 8C ó ✓ estándar
  { bug: 'C3 B0 C5 B8 C2 91 C2 8C', good: 'F0 9F 91 8C' },
  // ❌ F0 9F 93 89
  { bug: 'C3 B0 C5 B8 C2 93 C2 89', good: 'F0 9F 93 89' }, // Hmm That is different
];

let bytes = fs.readFileSync(path);
const orig = Buffer.from(bytes);
console.log('Tamaño original:', bytes.length);

let fixed = 0;
for (const c of candidates) {
  const bugBytes = Buffer.from(c.bug.split(' ').map(h => parseInt(h, 16)));
  const goodBytes = Buffer.from(c.good.split(' ').map(h => parseInt(h, 16)));
  let pos = 0;
  while ((pos = bytes.indexOf(bugBytes, pos)) !== -1) {
    bytes = Buffer.concat([bytes.slice(0, pos), goodBytes, bytes.slice(pos + bugBytes.length)]);
    pos += goodBytes.length;
    fixed++;
  }
}

console.log('Secuencias corregidas:', fixed);
console.log('Tamaño nuevo:', bytes.length);

if (fixed > 0) {
  fs.writeFileSync(path, bytes);
  console.log('Archivo guardado:', path);
} else {
  console.log('No se encontraron secuencias修正das');
}