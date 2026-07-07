const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function test() {
  console.log('=== DIAGNOSTIC TEST ===\n');
  
  // Check if DB file exists
  const dbPath = path.join(__dirname, '..', 'esme_cookies.db');
  console.log('DB Path:', dbPath);
  console.log('DB Exists:', fs.existsSync(dbPath));
  
  if (!fs.existsSync(dbPath)) {
    console.log('\n*** DATABASE FILE NOT FOUND ***');
    console.log('Creating new database...');
  }
  
  // Initialize sql.js
  console.log('\n1. Loading sql.js...');
  const SQL = await initSqlJs();
  console.log('   sql.js loaded successfully');
  
  // Load or create database
  let data = null;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
    console.log('2. Loaded existing DB, size:', data.length, 'bytes');
  } else {
    console.log('2. No existing DB, will create new one');
  }
  
  const db = new SQL.Database(data);
  console.log('3. Database instance created');
  
  // Create tables
  console.log('\n4. Creating tables...');
  db.run(`
    CREATE TABLE IF NOT EXISTS administradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);
  console.log('   Administrators table created');
  
  // Check for existing admin
  const adminResult = db.exec('SELECT * FROM administradores');
  console.log('\n5. Admin records:', adminResult);
  
  if (adminResult.length === 0 || adminResult[0].values.length === 0) {
    console.log('\n*** NO ADMIN FOUND - CREATING DEFAULT ***');
    const hash = bcrypt.hashSync('admin123', 10);
    console.log('   Password hash:', hash);
    db.run('INSERT INTO administrators (username, password_hash) VALUES (?, ?)', ['admin', hash]);
    
    // Save to file
    const saveData = db.export();
    fs.writeFileSync(dbPath, Buffer.from(saveData));
    console.log('   Admin created and saved');
  } else {
    const admin = adminResult[0].values[0];
    console.log('   Admin found:', admin);
    
    // Test password
    const storedHash = admin[2];
    console.log('   Stored hash:', storedHash);
    const isValid = bcrypt.compareSync('admin123', storedHash);
    console.log('   Password "admin123" valid:', isValid);
    
    if (!isValid) {
      console.log('\n*** PASSWORD MISMATCH - FIXING ***');
      const newHash = bcrypt.hashSync('admin123', 10);
      db.run('UPDATE administradores SET password_hash = ? WHERE id = ?', [newHash, admin[0]]);
      const saveData = db.export();
      fs.writeFileSync(dbPath, Buffer.from(saveData));
      console.log('   Password updated and saved');
    }
  }
  
  console.log('\n=== TEST COMPLETE ===');
}

test().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
