const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'esme_cookies.db');

async function main() {
  const SQL = await initSqlJs();
  const data = fs.readFileSync(dbPath);
  const db = new SQL.Database(data);

  console.log('Buscando clientes duplicados...');

  const duplicates = db.exec(`
    SELECT 
      REPLACE(REPLACE(telefono, '-', ''), ' ', '') as telefono_norm,
      COUNT(*) as count,
      GROUP_CONCAT(id) as ids
    FROM clientes 
    GROUP BY REPLACE(REPLACE(telefono, '-', ''), ' ', '')
    HAVING COUNT(*) > 1
  `);

  if (!duplicates[0] || duplicates[0].values.length === 0) {
    console.log('No hay clientes duplicados.');
    return;
  }

  console.log(`\nEncontrados ${duplicates[0].values.length} grupos de duplicados.\n`);

  duplicates[0].values.forEach(row => {
    const telefonoNorm = row[0];
    const count = row[1];
    const ids = row[2].split(',').map(Number);
    
    console.log(`Teléfono ${telefonoNorm}: ${count} registros`);
    console.log('  IDs:', ids);
    
    const result = db.exec(`SELECT id FROM clientes WHERE REPLACE(REPLACE(telefono, '-', ''), ' ', '') = '${telefonoNorm}' ORDER BY total_pedidos DESC, total_gastado DESC LIMIT 1`);
    const keepId = result[0]?.values[0]?.[0];
    
    if (!keepId) return;
    
    const deleteIds = ids.filter(id => id !== keepId);
    console.log(`  → Mantener ID: ${keepId}, Eliminar: ${deleteIds.join(', ')}`);
    
    deleteIds.forEach(delId => {
      db.run(`DELETE FROM clientes WHERE id = ?`, [delId]);
    });
  });

  const dbData = db.export();
  fs.writeFileSync(dbPath, Buffer.from(dbData));
  
  console.log('\n✓ Limpieza completada y guardada');
}

main().catch(console.error);
