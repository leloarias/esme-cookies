const express = require('express');
const { prepare } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { getIO } = require('../services/realtime');

const router = express.Router();

router.get('/api/config', verifyToken, async (req, res) => {
  try {
    const config = await prepare('SELECT * FROM config WHERE id = 1').get() || { pickupAddress: '', deliveryPrice: 0, envioPrice: 0 };
    delete config.emailPass;
    if (config.customBoxConfig && typeof config.customBoxConfig === 'string') {
      try { config.customBoxConfig = JSON.parse(config.customBoxConfig); } catch (e) { config.customBoxConfig = null; }
    }
    if (!config.customBoxConfig || typeof config.customBoxConfig !== 'object') {
      config.customBoxConfig = { enabled: true, sizes: [6, 12, 24], packagingPrice: 0, discountPct: 0, excludedProducts: [] };
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al leer config' });
  }
});

router.post('/api/config', verifyToken, async (req, res) => {
  try {
    const currentConfig = await prepare('SELECT * FROM config WHERE id=1').get() || {};
    const wasOpen = currentConfig.isOpen;

    const body = req.body;

    if (body.isOpen !== undefined) {
      await prepare('UPDATE config SET isOpen=? WHERE id=1').run(body.isOpen);
    }
    if (body.deliveryPrice !== undefined) {
      await prepare('UPDATE config SET deliveryPrice=? WHERE id=1').run(body.deliveryPrice);
    }
    if (body.envioPrice !== undefined) {
      await prepare('UPDATE config SET envioPrice=? WHERE id=1').run(body.envioPrice);
    }
    if (body.shopName !== undefined) {
      await prepare('UPDATE config SET shopName=? WHERE id=1').run(body.shopName);
    }
    if (body.shopPhone !== undefined) {
      await prepare('UPDATE config SET shopPhone=? WHERE id=1').run(body.shopPhone);
    }
    if (body.pickupAddress !== undefined) {
      await prepare('UPDATE config SET pickupAddress=? WHERE id=1').run(body.pickupAddress);
    }
    if (body.currency !== undefined) {
      await prepare('UPDATE config SET currency=? WHERE id=1').run(body.currency);
    }
    if (body.primaryColor !== undefined) {
      await prepare('UPDATE config SET primaryColor=? WHERE id=1').run(body.primaryColor);
    }
    if (body.accentColor !== undefined) {
      await prepare('UPDATE config SET accentColor=? WHERE id=1').run(body.accentColor);
    }
    if (body.emailUser !== undefined) {
      await prepare('UPDATE config SET emailUser=? WHERE id=1').run(body.emailUser);
    }
    if (body.emailPass) {
      await prepare('UPDATE config SET emailPass=? WHERE id=1').run(body.emailPass);
    }
    if (body.adminEmail !== undefined) {
      await prepare('UPDATE config SET adminEmail=? WHERE id=1').run(body.adminEmail);
    }
    if (body.emailHost !== undefined) {
      await prepare('UPDATE config SET emailHost=? WHERE id=1').run(body.emailHost);
    }
    if (body.emailPort !== undefined) {
      await prepare('UPDATE config SET emailPort=? WHERE id=1').run(body.emailPort);
    }
    if (body.emailSecure !== undefined) {
      await prepare('UPDATE config SET emailSecure=? WHERE id=1').run(body.emailSecure);
    }
    if (body.emailTemplate !== undefined) {
      await prepare('UPDATE config SET emailTemplate=? WHERE id=1').run(body.emailTemplate);
    }
    if (body.emailNotifications !== undefined) {
      await prepare('UPDATE config SET emailNotifications=? WHERE id=1').run(body.emailNotifications);
    }
    if (body.bankAccounts !== undefined) {
      let value = body.bankAccounts;
      if (typeof value !== 'string') {
        value = JSON.stringify(value);
      }
      await prepare('UPDATE config SET bankAccounts=? WHERE id=1').run(value);
    }
    if (body.msgEsperandoPago !== undefined) {
      await prepare('UPDATE config SET msgEsperandoPago=? WHERE id=1').run(body.msgEsperandoPago);
    }
    if (body.msgPagoConfirmado !== undefined) {
      await prepare('UPDATE config SET msgPagoConfirmado=? WHERE id=1').run(body.msgPagoConfirmado);
    }
    if (body.msgPreparando !== undefined) {
      await prepare('UPDATE config SET msgPreparando=? WHERE id=1').run(body.msgPreparando);
    }
    if (body.msgListo !== undefined) {
      await prepare('UPDATE config SET msgListo=? WHERE id=1').run(body.msgListo);
    }
    if (body.msgEntregado !== undefined) {
      await prepare('UPDATE config SET msgEntregado=? WHERE id=1').run(body.msgEntregado);
    }
    if (body.customBoxConfig !== undefined) {
      let value = body.customBoxConfig;
      if (typeof value !== 'string') {
        value = JSON.stringify(value);
      }
      await prepare('UPDATE config SET customBoxConfig=? WHERE id=1').run(value);
    }

    const newIsOpen = body.isOpen !== undefined ? body.isOpen : wasOpen;

    if (wasOpen != newIsOpen) {
      if (newIsOpen == 0) {
        getIO().emit('tienda_cerrada');
        console.log('[CONFIG] Tienda CERRADA');
      } else {
        getIO().emit('tienda_abierta');
        console.log('[CONFIG] Tienda ABIERTA');
      }
    }

    getIO().emit('config_update', {
      isOpen: newIsOpen,
      deliveryPrice: body.deliveryPrice,
      envioPrice: body.envioPrice,
      shopPhone: body.shopPhone,
      shopName: body.shopName
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error al guardar config:', err);
    res.status(500).json({ error: 'Error al guardar config: ' + err.message });
  }
});

router.get('/api/public-config', async (req, res) => {
  try {
    const config = await prepare(`SELECT shopName, shopPhone, currency, primaryColor, accentColor, isOpen, pickupAddress, deliveryPrice, envioPrice, bankAccounts, customBoxConfig,
      msgEsperandoPago, msgPagoConfirmado, msgPreparando, msgListo, msgEntregado FROM config WHERE id = 1`).get();
    if (config) {
      if (config.customBoxConfig) {
        try {
          config.customBoxConfig = JSON.parse(config.customBoxConfig);
        } catch (e) {
          config.customBoxConfig = null;
        }
      }
      if (!config.customBoxConfig || typeof config.customBoxConfig !== 'object') {
        config.customBoxConfig = { enabled: true, sizes: [6, 12, 24], packagingPrice: 0, discountPct: 0, excludedProducts: [] };
      }
    }
    if (config && config.bankAccounts) {
      try {
        let parsed = JSON.parse(config.bankAccounts);
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        config.bankAccounts = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        config.bankAccounts = [];
      }
    } else if (config) {
      config.bankAccounts = [];
    }
    res.json(config || {});
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener config pública' });
  }
});

module.exports = router;
