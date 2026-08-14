// Punto de arranque: crea el servidor HTTP + Socket.io, inicializa la base de
// datos y programa las tareas periódicas. La configuración de Express está en app.js.
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const { initDatabase, prepare } = require('./db');
const { setIO } = require('./services/realtime');
const { setOrderCounter } = require('./services/orderNumber');
const { getDominicanDateTime, normalizePhone } = require('./utils/helpers');
const { restoreStockForOrder } = require('./services/inventory');
const { restoreForOrder: restoreIngredientsForOrder } = require('./services/ingredients');
const { ensureClientExists } = require('./services/clients');

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});
setIO(io);

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log('Cliente conectado a WebSocket:', socket.id);
});

async function startServer() {
  try {
    await initDatabase();
    console.log('Base de datos inicializada correctamente');

    // El contador nunca debe retroceder: si el pedido más alto se borra
    // permanentemente, MAX(numero) por sí solo bajaría y reemitiría un número
    // ya usado. Se toma el mayor entre lo que hay en pedidos y lo último
    // persistido en config.
    const maxOrder = await prepare('SELECT MAX(numero) as maxNum FROM pedidos').get();
    const lastPersisted = await prepare('SELECT lastOrderNumber FROM config WHERE id = 1').get();
    const initialCounter = Math.max(
      Number(maxOrder?.maxNum) || 0,
      Number(lastPersisted?.lastOrderNumber) || 0
    ) || parseInt(new Date().getFullYear() + '0100000');
    setOrderCounter(initialCounter);
    console.log('Order counter initialized:', initialCounter);

    server.listen(PORT, '0.0.0.0', () => {
      console.log('═══════════════════════════════════════════════');
      console.log('   🍪 ESME COOKIES - Servidor Online');
      console.log('═══════════════════════════════════════════════');
      console.log(`   Puerto: ${PORT}`);
      console.log('═══════════════════════════════════════════════');
    });

    // Verificador periódico (cada minuto): expira promos vencidas y cancela
    // pedidos sin confirmar con más de 24 horas.
    setInterval(async () => {
      try {
        const now = new Date();
        const { date: currentDate } = getDominicanDateTime(now);

        try {
          const expiredPromos = await prepare(
            'SELECT id, titulo FROM promociones WHERE activa = 1 AND fecha_fin < ?'
          ).all(currentDate);

          if (expiredPromos.length > 0) {
            for (const p of expiredPromos) {
              console.log(`[Promo] Expirando automaticamente: ${p.titulo}`);
              await prepare('UPDATE promociones SET activa = 0 WHERE id = ?').run(p.id);
              io.emit('promo_expirada', { id: p.id, titulo: p.titulo });
            }
            io.emit('ofertas_update');
          }
        } catch (promoErr) {
          console.error('Error verificando promos:', promoErr.message);
        }

        // Cancelar pedidos pendientes después de 24 horas
        try {
          const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const allPending = await prepare(
            "SELECT numero, cliente, telefono, total, descuento, created_at, estado_timestamps FROM pedidos WHERE estado IN ('Pendiente', 'Esperando Pago')"
          ).all();

          for (const o of allPending) {
            if (o.created_at) {
              const createdDate = new Date(o.created_at);
              if (!isNaN(createdDate.getTime()) && createdDate < cutoffTime) {
                console.log(`[Order] Cancelando pedido sin confirmar: #${o.numero} (creado: ${o.created_at})`);
                let timestamps = {};
                try { timestamps = o.estado_timestamps ? JSON.parse(o.estado_timestamps) : {}; } catch (e) {}
                timestamps['Cancelado'] = new Date().toISOString();
                await prepare('UPDATE pedidos SET estado = ?, estado_timestamps = ? WHERE numero = ?').run('Cancelado', JSON.stringify(timestamps), o.numero);

                // Misma reversión que aplica un cancelado manual: devolver el
                // stock reservado y restar del historial del cliente.
                if (o.telefono) {
                  const telNorm = normalizePhone(o.telefono);
                  await ensureClientExists(telNorm, o.cliente);
                  await prepare('UPDATE clientes SET total_gastado = MAX(0, total_gastado - ?), total_descuentos = MAX(0, total_descuentos - ?) WHERE telefono = ?')
                    .run(parseFloat(o.total) || 0, parseFloat(o.descuento) || 0, telNorm);
                }
                await restoreStockForOrder(o.numero);
                await restoreIngredientsForOrder(o.numero);

                io.emit('pedido_cancelado', { numero: o.numero, cliente: o.cliente });
              }
            }
          }
        } catch (orderErr) {
          console.error('Error verificando pedidos viejos:', orderErr.message);
        }
      } catch (err) {
        console.error('Error verificando promos expiradas:', err);
      }
    }, 60000);
  } catch (err) {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  }
}

startServer();
