const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'esme_cookies.db');

async function main() {
  const SQL = await initSqlJs();
  let data = null;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }
  const db = new SQL.Database(data);

  // Check if admin table exists
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables:', tables);

  if (tables[0]) {
    tables[0].values.forEach(t => console.log(' -', t[0]));
  }

  // Create admin if not exists
  const adminExists = db.exec("SELECT COUNT(*) FROM administradores")[0]?.values[0][0] || 0;
  console.log('\nAdmin count:', adminExists);

  if (adminExists === 0) {
    const hash = bcrypt.hashSync('admin1234', 10);
    db.run("INSERT INTO administradores (username, password_hash) VALUES (?, ?)", ['admin', hash]);
    console.log('Admin created with username: admin, password: admin1234');
  } else {
    // Update password
    const hash = bcrypt.hashSync('admin1234', 10);
    db.run("UPDATE administradores SET password_hash = ? WHERE username = 'admin'", [hash]);
    console.log('Admin password updated to: admin1234');
  }

  // Check clientes table
  const clientCount = db.exec("SELECT COUNT(*) FROM clientes")[0]?.values[0][0] || 0;
  console.log('\nClient count:', clientCount);

  // Show duplicates
  if (clientCount > 0) {
    const duplicates = db.exec(`
      SELECT 
        REPLACE(REPLACE(telefono, '-', ''), ' ', '') as telefono_norm,
        COUNT(*) as count
      FROM clientes 
      GROUP BY REPLACE(REPLACE(telefono, '-', ''), ' ', '')
      HAVING COUNT(*) > 1
    `);
    if (duplicates[0]) {
      console.log('\nDuplicates found:', duplicates[0].values.length);
    }
  }

  // Save
  const buffer = db.export();
  fs.writeFileSync(dbPath, Buffer.from(buffer));
  console.log('\nDone!');
}

main().catch(console.error);
