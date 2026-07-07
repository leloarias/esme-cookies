const initSqlJs = require('sql.js');
const fs = require('fs');

async function test() {
  const SQL = await initSqlJs();
  const data = fs.readFileSync('../esme_cookies.db');
  const db = new SQL.Database(data);
  
  console.log('=== Checking Database ===');
  
  // Check columns in config table
  const columns = db.exec("PRAGMA table_info(config)");
  console.log('Config columns:', JSON.stringify(columns, null, 2));
  
  // Get current config
  const cfg = db.exec('SELECT * FROM config WHERE id=1');
  console.log('Current config:', cfg);
  
  // Try update
  console.log('\n=== Testing Update ===');
  try {
    db.run('UPDATE config SET isOpen=? WHERE id=1', [0]);
    const updated = db.exec('SELECT isOpen FROM config WHERE id=1');
    console.log('After update:', updated);
    console.log('SUCCESS - Update worked!');
  } catch(e) {
    console.log('ERROR:', e);
  }
}

test().catch(console.error);
