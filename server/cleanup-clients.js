const initSqlJs = require('sql.js');
const fs = require('fs');

initSqlJs().then(SQL => {
  const data = fs.readFileSync('../esme_cookies.db');
  const db = new SQL.Database(data);
  
  // Obtener clientes duplicados
  const dupes = db.exec("SELECT telefono, COUNT(*) as cnt FROM clientes GROUP BY telefono HAVING cnt > 1");
  console.log('Duplicados encontrados:', dupes[0]?.values?.length || 0);
  
  if (dupes[0]?.values) {
    dupes[0].values.forEach(row => {
      const telefono = row[0];
      console.log('Procesando telefono:', telefono);
      
      // Obtener todos los registros de este telefono
      const stmt = db.prepare("SELECT id, total_pedidos, total_gastado, ultimo_pedido FROM clientes WHERE telefono = ?");
      stmt.bind([telefono]);
      
      let rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      
      if (rows.length > 1) {
        let totalPedidos = 0;
        let totalGastado = 0;
        let ultimoPedido = '';
        
        rows.forEach(r => {
          totalPedidos += r.total_pedidos || 0;
          totalGastado += r.total_gastado || 0;
          if (!ultimoPedido || (r.ultimo_pedido && r.ultimo_pedido > ultimoPedido)) {
            ultimoPedido = r.ultimo_pedido;
          }
        });
        
        console.log('  Consolidando:', totalPedidos, 'pedidos, RD$', totalGastado);
        
        // Mantener el primero, eliminar los demás
        const keepId = rows[0].id;
        
        // Actualizar el que mantenemos
        db.run("UPDATE clientes SET total_pedidos = ?, total_gastado = ?, ultimo_pedido = ? WHERE id = ?", 
          [totalPedidos, totalGastado, ultimoPedido, keepId]);
        
        // Eliminar duplicados
        for (let i = 1; i < rows.length; i++) {
          db.run("DELETE FROM clientes WHERE id = ?", [rows[i].id]);
        }
        console.log('  Eliminado duplicados, ahora tiene', rows.length, 'registros');
      }
    });
  }
  
  // Guardar
  const newData = db.export();
  fs.writeFileSync('../esme_cookies.db', Buffer.from(newData));
  console.log('Base de datos actualizada');
  
  // Contar clientes únicos
  const count = db.exec("SELECT COUNT(*) as cnt FROM clientes");
  console.log('Total clientes:', count[0]?.values[0][0]);
  
  db.close();
});
