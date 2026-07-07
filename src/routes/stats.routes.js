const express = require('express');
const { prepare } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/api/stats', verifyToken, async (req, res) => {
  try {
    const orders = await prepare('SELECT * FROM pedidos').all();
    const porTipoEntrega = { pickup: 0, delivery: 0, envio: 0 };
    const productosCount = {};

    let ventas = 0, pendientes = 0, confirmados = 0, listos = 0, cancelados = 0, prodVendidos = 0;

    orders.forEach(o => {
      ventas += (o.total || 0);
      prodVendidos += (o.cantidad || 0);

      if (porTipoEntrega[o.tipo_entrega] !== undefined) porTipoEntrega[o.tipo_entrega]++;

      if (o.estado === 'Pendiente') pendientes++;
      else if (o.estado === 'Confirmado') confirmados++;
      else if (o.estado === 'Entregado') listos++;
      else if (o.estado === 'Cancelado') cancelados++;

      if (o.productos) {
        o.productos.split(',').forEach(p => {
          const match = p.trim().match(/^(.+?)\s*x\d+$/);
          const name = match ? match[1].trim() : p.trim();
          productosCount[name] = (productosCount[name] || 0) + 1;
        });
      }
    });

    const topProductos = Object.entries(productosCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const ticketPromedio = orders.length > 0 ? Math.round(ventas / orders.length) : 0;

    res.json({
      total: orders.length, ventas, pendientes, confirmados, listos, cancelados,
      productosVendidos: prodVendidos, ticketPromedio, porTipoEntrega, topProductos
    });
  } catch (err) {
    res.status(500).json({ error: 'Error calculando estadisticas' });
  }
});

module.exports = router;
