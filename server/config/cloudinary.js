// Configuración de Cloudinary (subida de imágenes de productos).
// Requiere que dotenv ya esté cargado (se hace en server.js antes de importar rutas).
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = cloudinary;
