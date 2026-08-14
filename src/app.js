// Configuración de la aplicación Express: middlewares, archivos estáticos y rutas.
// El arranque del servidor (HTTP + Socket.io) vive en server.js.
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { securityHeaders } = require('./middleware/security');

const app = express();

// Detrás de un túnel (Cloudflare Tunnel, Tailscale Funnel, nginx...) todas las
// conexiones llegan del proxy local; sin esto req.ip siempre da la IP del
// túnel y el límite de intentos de login (por IP) deja de servir para nada.
app.set('trust proxy', 1);

// Cabeceras de seguridad en todas las respuestas
app.use(securityHeaders);

// Middlewares base
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Sin caché para HTML/JS/CSS: evita que el navegador use versiones viejas
// (era la causa de los emojis rotos '?' en WhatsApp tras corregir los archivos).
const noStore = {
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store')
};
app.use(express.static(path.join(__dirname, '..', 'public'), noStore));
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));

// Asegurar que existan las carpetas de imágenes/uploads
['images', 'uploads'].forEach(dir => {
  const dirPath = path.join(__dirname, '..', 'public', dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Rutas (cada router usa las rutas completas /api/... y se monta en la raíz)
app.use(require('./routes/misc.routes'));
app.use(require('./routes/auth.routes'));
app.use(require('./routes/config.routes'));
app.use(require('./routes/clients.routes'));
app.use(require('./routes/admins.routes'));
app.use(require('./routes/promotions.routes'));
app.use(require('./routes/products.routes'));
app.use(require('./routes/orders.routes'));
app.use(require('./routes/inventory.routes'));
app.use(require('./routes/ingredients.routes'));
app.use(require('./routes/stats.routes'));
app.use(require('./routes/reports.routes'));
app.use(require('./routes/upload.routes'));

module.exports = app;
