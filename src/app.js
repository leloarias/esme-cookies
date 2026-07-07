// Configuración de la aplicación Express: middlewares, archivos estáticos y rutas.
// El arranque del servidor (HTTP + Socket.io) vive en server.js.
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { securityHeaders } = require('./middleware/security');

const app = express();

// Cabeceras de seguridad en todas las respuestas
app.use(securityHeaders);

// Middlewares base
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
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
app.use(require('./routes/stats.routes'));
app.use(require('./routes/reports.routes'));
app.use(require('./routes/upload.routes'));

module.exports = app;
