const express = require('express');
const cloudinary = require('../config/cloudinary');
const { verifyToken } = require('../auth');

const router = express.Router();

router.post('/api/upload-image', verifyToken, async (req, res) => {
  try {
    const { imagen, filename } = req.body;
    if (!imagen || !filename) return res.status(400).json({ error: 'Faltan datos' });

    // Subir a Cloudinary
    const result = await cloudinary.uploader.upload(imagen, {
      folder: 'esme-cookies',
      public_id: `product_${Date.now()}`,
      overwrite: true,
      resource_type: 'image'
    });

    res.json({ success: true, url: result.secure_url });
  } catch (err) {
    console.error('Error subiendo imagen a Cloudinary:', err.message);
    res.status(500).json({ error: 'Error subiendo imagen: ' + err.message });
  }
});

module.exports = router;
