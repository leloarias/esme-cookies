// Singleton de Socket.io: server.js lo inicializa al arrancar y los
// handlers de las rutas obtienen la instancia con getIO() para emitir eventos.

let io = null;

function setIO(instance) {
  io = instance;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io no inicializado. Llamá a setIO() al arrancar el servidor.');
  }
  return io;
}

module.exports = { setIO, getIO };
