process.chdir('C:/Users/Ezequiel Morillo/OneDrive - Instituto Superior de Formación Docente Salomé Ureña/Escritorio/esme-cookies-main');
require('./src/db').initDatabase().then(async () => {
  const { prepare } = require('./src/db');
  const all = await prepare("SELECT id, nombre, tipo, activo, box_config FROM productos ORDER BY id").all();
  console.log('Todos los productos:');
  all.forEach(c => console.log(' id:', c.id, 'nombre:', c.nombre, 'tipo:', c.tipo, 'activo:', c.activo));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });