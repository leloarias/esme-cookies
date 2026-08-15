// Copia el archivo de la base de datos a la carpeta de Respaldos, con fecha
// en el nombre, y borra copias de más de 14 días para no llenar el disco.
//
// Pensado para correr como tarea programada en OpenMediaVault (Sistema >
// Programación de tareas), una vez al día. No hace nada raro: es una simple
// copia de archivo, la base sigue funcionando normal mientras corre.
//
// Uso:
//   BACKUP_DIR=/srv/dev-disk-by-uuid-xxxx/Respaldos/esme-cookies node scripts/backup-db.js
//
// Si no se pasa BACKUP_DIR, guarda las copias en ./backups dentro del proyecto
// (sirve para probarlo en local antes de configurarlo en la OMV).
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DIAS_A_CONSERVAR = 14;

function rutaBaseLocal() {
  const url = process.env.DATABASE_URL || 'file:data/esme.db';
  if (!url.startsWith('file:')) {
    console.log('DATABASE_URL no es un archivo local (' + url + ') — no hay nada que respaldar con este script.');
    console.log('Si la base es remota (Turso), los backups los maneja Turso, no hace falta este script.');
    process.exit(0);
  }
  return url.slice('file:'.length);
}

function main() {
  const origen = rutaBaseLocal();
  if (!fs.existsSync(origen)) {
    console.error('No se encontró el archivo de la base:', origen);
    process.exit(1);
  }

  const destinoDir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
  fs.mkdirSync(destinoDir, { recursive: true });

  const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const nombreBase = path.basename(origen);
  const destino = path.join(destinoDir, fecha + '_' + nombreBase);

  fs.copyFileSync(origen, destino);
  console.log('Backup creado:', destino);

  // Borrar copias viejas (más de DIAS_A_CONSERVAR días)
  const limite = Date.now() - DIAS_A_CONSERVAR * 24 * 60 * 60 * 1000;
  const archivos = fs.readdirSync(destinoDir).filter((f) => f.endsWith('_' + nombreBase));
  let borrados = 0;
  for (const archivo of archivos) {
    const rutaCompleta = path.join(destinoDir, archivo);
    const stat = fs.statSync(rutaCompleta);
    if (stat.mtimeMs < limite) {
      fs.unlinkSync(rutaCompleta);
      borrados++;
    }
  }
  if (borrados > 0) console.log('Copias viejas borradas (+' + DIAS_A_CONSERVAR + ' días):', borrados);
}

main();
