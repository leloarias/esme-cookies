const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pedidosCsv, clientesCsv } = require('../services/reports');

const router = express.Router();

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

router.get('/api/reportes/pedidos.csv', verifyToken, async (req, res) => {
  try {
    const csv = await pedidosCsv();
    sendCsv(res, `pedidos_${today()}.csv`, csv);
  } catch (err) {
    console.error('Error generando reporte de pedidos:', err);
    res.status(500).json({ error: 'Error generando reporte de pedidos' });
  }
});

router.get('/api/reportes/clientes.csv', verifyToken, async (req, res) => {
  try {
    const csv = await clientesCsv();
    sendCsv(res, `clientes_${today()}.csv`, csv);
  } catch (err) {
    console.error('Error generando reporte de clientes:', err);
    res.status(500).json({ error: 'Error generando reporte de clientes' });
  }
});

module.exports = router;
