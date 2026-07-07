const express = require('express');
const path = require('path');
const { verifyToken } = require('../middleware/auth');
const { sendNewOrderEmail } = require('../services/email');

const router = express.Router();

// Health check para monitoreo (UptimeRobot, etc.)
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

router.post('/api/test-email', verifyToken, async (req, res) => {
  try {
    await sendNewOrderEmail({
      numero: 'TEST',
      cliente: 'Prueba del Sistema',
      telefono: 'N/A',
      productos: 'Email de prueba',
      total: 0,
      tipo_entrega: 'test',
      observaciones: 'Este es un email de prueba enviado desde el panel de administración.'
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error enviando email: ' + err.message });
  }
});

router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin.html'));
});

router.get('/seguimiento', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'seguimiento.html'));
});

module.exports = router;
