const nodemailer = require('nodemailer');
const { prepare } = require('./database');

function getTransporter(config) {
  return nodemailer.createTransport({
    host: config.emailHost || 'smtp.gmail.com',
    port: config.emailPort || 465,
    secure: !!config.emailSecure,
    auth: {
      user: config.emailUser,
      pass: config.emailPass
    },
    pool: true,
    maxConnections: 1,
    maxMessages: 5
  });
}

// Email al ADMIN cuando llega pedido nuevo
async function sendNewOrderEmail(orderData) {
  try {
    const config = await prepare('SELECT * FROM config WHERE id = 1').get() || {};
    
    if (config.emailNotifications != 1) {
      console.log('[Email] Notificaciones desactivadas.');
      return { success: false, reason: 'disabled' };
    }
    if (!config.adminEmail || !config.emailUser || !config.emailPass) {
      console.log('[Email] Credenciales SMTP no configuradas.');
      return { success: false, reason: 'no_config' };
    }

    const transporter = getTransporter(config);
    const tipoEntrega = { 'pickup': 'Pasar a buscar', 'delivery': 'Delivery', 'envio': 'Envío Nacional' }[orderData.tipo_entrega] || orderData.tipo_entrega;

    const htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background:#f5f5f5;">
        <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <div style="background:linear-gradient(135deg,#2C1810,#5D3A1A);padding:35px 20px;text-align:center;">
            <div style="font-size:3.5rem;">🍪</div>
            <h1 style="color:#FAEDCD;margin:0;font-size:1.9rem;">${config.shopName || 'Esme Cookies'}</h1>
            <p style="color:#fff;margin:15px 0 0;font-size:1.2rem;font-weight:600;">¡Nuevo Pedido Recibido!</p>
          </div>
          <div style="background:#FFF8E6;padding:20px;text-align:center;border-bottom:3px solid #C9883A;">
            <div style="font-size:0.85rem;color:#8B6914;margin-bottom:6px;">NÚMERO DE PEDIDO</div>
            <div style="font-size:2.8rem;font-weight:bold;color:#2C1810;">#${String(orderData.numero).padStart(4, '0')}</div>
          </div>
          <div style="padding:25px 30px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:14px 0;border-bottom:1px solid #eee;color:#555;">📋 Cliente</td><td style="padding:14px 0;border-bottom:1px solid #eee;font-weight:bold;text-align:right;color:#2C1810;">${orderData.cliente}</td></tr>
              <tr><td style="padding:14px 0;border-bottom:1px solid #eee;color:#555;">📱 Teléfono</td><td style="padding:14px 0;border-bottom:1px solid #eee;font-weight:bold;text-align:right;"><a href="https://wa.me/${orderData.telefono.replace(/\D/g,'')}" style="color:#25D366;">${orderData.telefono}</a></td></tr>
              <tr><td style="padding:14px 0;border-bottom:1px solid #eee;color:#555;">🚚 Entrega</td><td style="padding:14px 0;border-bottom:1px solid #eee;font-weight:bold;text-align:right;color:#2C1810;">${tipoEntrega}</td></tr>
            </table>
            <div style="background:#FEF9F3;padding:20px;border-radius:12px;margin:20px 0;border:1px solid #E8DCC8;">
              <div style="font-size:0.9rem;color:#5D3A1A;margin-bottom:12px;font-weight:700;">🍪 PRODUCTOS</div>
              <div style="font-size:1rem;line-height:1.8;color:#2C1810;">${(orderData.productos || '').replace(/,/g, '<br>')}</div>
            </div>
            <div style="background:#FEF9F3;padding:20px;border-radius:12px;border:1px solid #E8DCC8;">
              <div style="display:flex;justify-content:space-between;padding:8px 0;color:#555;"><span>Subtotal:</span><span>RD$ ${(orderData.subtotal || 0).toLocaleString()}</span></div>
              ${orderData.descuento > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;color:#28a745;"><span>Descuento:</span><span>-RD$ ${(orderData.descuento || 0).toLocaleString()}</span></div>` : ''}
              <div style="display:flex;justify-content:space-between;padding:8px 0;color:#555;"><span>Envío:</span><span>RD$ ${(orderData.envio || 0).toLocaleString()}</span></div>
              <div style="display:flex;justify-content:space-between;padding:12px 0;margin-top:8px;font-size:1.3rem;font-weight:700;color:#2C1810;border-top:2px solid #2C1810;">
                <span>TOTAL:</span><span style="color:#C9883A;">RD$ ${Number(orderData.total || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div style="background:#F5EDE4;padding:28px 20px;text-align:center;">
            <a href="${process.env.RENDER_URL || 'https://esme-cookies.onrender.com'}/admin" style="display:inline-block;background:#2C1810;color:white;padding:16px 32px;border-radius:10px;text-decoration:none;font-weight:700;">Ver Panel de Admin →</a>
          </div>
        </div>
      </body></html>`;

    await transporter.sendMail({
      from: `"${config.shopName || 'Esme Cookies'} 🍪" <${config.emailUser}>`,
      to: config.adminEmail,
      subject: `🍪 Nuevo Pedido #${String(orderData.numero).padStart(4, '0')} - ${orderData.cliente}`,
      html: htmlContent,
      priority: 'high'
    });

    console.log(`[Email] ✅ Email enviado al admin - Pedido #${orderData.numero}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Email al CLIENTE confirmando su pedido
async function sendCustomerConfirmationEmail(orderData) {
  try {
    const config = await prepare('SELECT * FROM config WHERE id = 1').get() || {};
    
    if (!config.emailUser || !config.emailPass) {
      console.log('[Email] SMTP no configurado, saltando email al cliente.');
      return { success: false, reason: 'no_config' };
    }

    // Buscar email del cliente
    const cliente = await prepare('SELECT email FROM clientes WHERE telefono = ?').get(orderData.telefono);
    if (!cliente || !cliente.email) {
      console.log('[Email] Cliente sin email registrado.');
      return { success: false, reason: 'no_email' };
    }

    const transporter = getTransporter(config);
    const bankAccountsArr = config.bankAccounts ? JSON.parse(config.bankAccounts || '[]') : [];
    
    // Verificar si todas las cédulas son iguales
    const cedulas = bankAccountsArr.map(c => (c.cedula || '').trim()).filter(Boolean);
    const todasIguales = cedulas.length > 1 && cedulas.every(c => c === cedulas[0]);
    const cedulaUnica = todasIguales ? cedulas[0] : '';

    const cuentasHtml = (cedulaUnica ? `<div style="background:#e8f5e9;padding:12px;border-radius:10px;margin:10px 0;font-weight:600;">📌 Cédula: ${cedulaUnica}</div>` : '') +
      bankAccountsArr.map((c, i) => `
      <div style="background:#FEF9F3;padding:16px;border-radius:10px;margin:10px 0;border:1px solid #E8DCC8;">
        <div style="font-weight:700;color:#2C1810;margin-bottom:8px;">🏦 Cuenta ${i + 1}: ${c.banco}</div>
        <div style="color:#555;line-height:1.8;">
          ${c.tipo}: ${c.numero}<br>
          👤 Titular: ${c.titular}
          ${!cedulaUnica && c.cedula ? `<br>📌 Cédula: ${c.cedula}` : ''}
        </div>
      </div>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background:#f5f5f5;">
        <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <div style="background:linear-gradient(135deg,#2C1810,#5D3A1A);padding:35px 20px;text-align:center;">
            <div style="font-size:3.5rem;">🍪</div>
            <h1 style="color:#FAEDCD;margin:0;font-size:1.9rem;">${config.shopName || 'Esme Cookies'}</h1>
            <p style="color:#fff;margin:15px 0 0;font-size:1.1rem;">¡Hola ${orderData.cliente}!</p>
          </div>
          <div style="padding:30px;">
            <p style="font-size:1.1rem;color:#2C1810;">Recibimos tu pedido <strong>#${String(orderData.numero).padStart(4, '0')}</strong> 🎉</p>
            <div style="background:#FEF9F3;padding:20px;border-radius:12px;margin:20px 0;border:1px solid #E8DCC8;">
              <div style="font-size:0.9rem;color:#5D3A1A;margin-bottom:12px;font-weight:700;">🍪 TU PEDIDO</div>
              <div style="font-size:1rem;line-height:1.8;color:#2C1810;">${(orderData.productos || '').replace(/,/g, '<br>')}</div>
            </div>
            <div style="background:#FEF9F3;padding:20px;border-radius:12px;margin:20px 0;border:2px solid #C9883A;">
              <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:1.3rem;font-weight:700;color:#2C1810;">
                <span>TOTAL A PAGAR:</span><span style="color:#C9883A;">RD$ ${Number(orderData.total || 0).toLocaleString()}</span>
              </div>
            </div>
            ${cuentasHtml ? `
            <div style="margin:20px 0;">
              <h3 style="color:#2C1810;">💳 Cuentas para Transferencia</h3>
              ${cuentasHtml}
            </div>` : ''}
            <div style="background:#FFF8E6;padding:20px;border-radius:12px;text-align:center;margin:20px 0;">
              <p style="color:#8B6914;font-weight:600;margin:0;">Por favor realiza la transferencia y envíanos el comprobante.</p>
              <p style="color:#555;margin:10px 0 0;">Una vez confirmado el pago, prepararemos tu pedido.</p>
            </div>
          </div>
          <div style="background:#F5EDE4;padding:20px;text-align:center;">
            <p style="color:#8B7355;font-size:0.8rem;margin:0;">${config.shopName || 'Esme Cookies'} 🍪</p>
          </div>
        </div>
      </body></html>`;

    await transporter.sendMail({
      from: `"${config.shopName || 'Esme Cookies'} 🍪" <${config.emailUser}>`,
      to: cliente.email,
      subject: `🍪 Tu Pedido #${String(orderData.numero).padStart(4, '0')} ha sido recibido`,
      html: htmlContent
    });

    console.log(`[Email] ✅ Email de confirmación enviado al cliente: ${cliente.email}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error enviando al cliente:', error.message);
    return { success: false, error: error.message };
  }
}

// Email al CLIENTE cuando cambia el estado
async function sendStatusChangeEmail(orderData, newStatus) {
  try {
    const config = await prepare('SELECT * FROM config WHERE id = 1').get() || {};
    
    if (!config.emailUser || !config.emailPass) return { success: false };

    const cliente = await prepare('SELECT email FROM clientes WHERE telefono = ?').get(orderData.telefono);
    if (!cliente || !cliente.email) return { success: false };

    const statusMessages = {
      'Confirmado': { emoji: '✅', titulo: 'Pedido Confirmado', msg: 'Tu pedido ha sido confirmado. Estamos preparándolo.' },
      'Preparando': { emoji: '👨‍🍳', titulo: 'En Preparación', msg: 'Tu pedido está siendo preparado con mucho cariño.' },
      'Listo': { emoji: '📦', titulo: 'Pedido Listo', msg: 'Tu pedido está listo para recoger/enviar.' },
      'Entregado': { emoji: '🎉', titulo: 'Pedido Entregado', msg: 'Tu pedido ha sido entregado. ¡Gracias por tu compra!' },
      'Cancelado': { emoji: '❌', titulo: 'Pedido Cancelado', msg: 'Tu pedido ha sido cancelado. Si tienes dudas, contáctanos.' }
    };

    const info = statusMessages[newStatus];
    if (!info) return { success: false };

    const transporter = getTransporter(config);

    const htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background:#f5f5f5;">
        <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#2C1810,#5D3A1A);padding:30px;text-align:center;">
            <div style="font-size:3rem;">${info.emoji}</div>
            <h1 style="color:#FAEDCD;margin:10px 0 0;">${info.titulo}</h1>
          </div>
          <div style="padding:30px;text-align:center;">
            <p style="font-size:1.2rem;color:#2C1810;">¡Hola ${orderData.cliente}!</p>
            <p style="font-size:1rem;color:#555;">${info.msg}</p>
            <div style="background:#FEF9F3;padding:20px;border-radius:12px;margin:20px 0;">
              <div style="font-size:0.85rem;color:#8B6914;">PEDIDO</div>
              <div style="font-size:2rem;font-weight:bold;color:#2C1810;">#${String(orderData.numero).padStart(4, '0')}</div>
            </div>
            <div style="background:#FEF9F3;padding:15px;border-radius:12px;margin:10px 0;">
              <div style="font-size:0.85rem;color:#555;">Total: RD$ ${Number(orderData.total || 0).toLocaleString()}</div>
            </div>
          </div>
          <div style="background:#F5EDE4;padding:20px;text-align:center;">
            <p style="color:#8B7355;font-size:0.8rem;margin:0;">${config.shopName || 'Esme Cookies'} 🍪</p>
          </div>
        </div>
      </body></html>`;

    await transporter.sendMail({
      from: `"${config.shopName || 'Esme Cookies'} 🍪" <${config.emailUser}>`,
      to: cliente.email,
      subject: `${info.emoji} Pedido #${String(orderData.numero).padStart(4, '0')} - ${info.titulo}`,
      html: htmlContent
    });

    console.log(`[Email] ✅ Email de estado '${newStatus}' enviado al cliente`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error:', error.message);
    return { success: false };
  }
}

module.exports = {
  sendNewOrderEmail,
  sendCustomerConfirmationEmail,
  sendStatusChangeEmail
};
