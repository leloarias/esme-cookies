// Punto de arranque: crea el servidor HTTP + Socket.io, inicializa la base de
// datos y programa las tareas periódicas. La configuración de Express está en app.js.
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const { initDatabase, prepare } = require('./database');
const { setIO } = require('./services/realtime');
const { setOrderCounter } = require('./services/orderNumber');
const { getDominicanDateTime } = require('./utils/helpers');

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

    const maxOrder = await prepare('SELECT MAX(numero) as maxNum FROM pedidos').get();
    const initialCounter = maxOrder?.maxNum || parseInt(new Date().getFullYear() + '0100000');
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
            "SELECT numero, cliente, telefono, created_at FROM pedidos WHERE estado IN ('Pendiente', 'Esperando Pago')"
          ).all();

          for (const o of allPending) {
            if (o.created_at) {
              const createdDate = new Date(o.created_at);
              if (!isNaN(createdDate.getTime()) && createdDate < cutoffTime) {
                console.log(`[Order] Cancelando pedido sin confirmar: #${o.numero} (creado: ${o.created_at})`);
                await prepare('UPDATE pedidos SET estado = ? WHERE numero = ?').run('Cancelado', o.numero);
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
