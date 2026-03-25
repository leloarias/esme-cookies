const nodemailer = require('nodemailer');
const db = require('./database');

async function sendNewOrderEmail(orderData) {
  try {
    const config = db.prepare('SELECT * FROM config WHERE id = 1').get() || {};
    
    // Verificar si las notificaciones por email están activadas
    if (config.emailNotifications != 1) {
      console.log('[Email] Notificaciones de email desactivadas. Saltando envío.');
      return { success: false, reason: 'notifications_disabled' };
    }
    
    // Validar configuración de email
    if (!config.adminEmail) {
      console.log('[Email] No se configuró email de administrador. Saltando envío.');
      return { success: false, reason: 'no_admin_email' };
    }
    
    if (!config.emailUser || !config.emailPass) {
      console.log('[Email] Credenciales SMTP no configuradas. Saltando envío.');
      return { success: false, reason: 'no_smtp_credentials' };
    }

    // Crear transporter con reintentos
    const transporter = nodemailer.createTransport({
      host: config.emailHost || 'smtp.gmail.com',
      port: config.emailPort || 465,
      secure: !!config.emailSecure,
      auth: {
        user: config.emailUser,
        pass: config.emailPass
      },
      pool: true,
      maxConnections: 1,
      maxMessages: 1,
      rateLimit: 1
    });

    // Tipos de entrega en texto legible
    const tipoEntregaTexto = {
      'pickup': 'Pasar a buscar',
      'delivery': 'Delivery local',
      'envio': 'Envío nacional',
      'test': 'Prueba'
    }[orderData.tipo_entrega] || orderData.tipo_entrega;

    // Plantilla HTML profesional del email
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f5f5f5;">
        <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#2C1810 0%,#5D3A1A 100%);padding:35px 20px;text-align:center;">
            <div style="font-size:3.5rem;margin-bottom:12px;">🍪</div>
            <h1 style="color:#FAEDCD;margin:0;font-size:1.9rem;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,0.5);">${config.shopName || 'Esme Cookies'}</h1>
            <p style="color:#FFFFFF;margin:15px 0 0;font-size:1.2rem;font-weight:600;text-shadow:0 2px 6px rgba(0,0,0,0.5);">¡Nuevo Pedido Recibido!</p>
          </div>
          
          <!-- Order Number -->
          <div style="background:#FFF8E6;padding:20px;text-align:center;border-bottom:3px solid #C9883A;">
            <div style="font-size:0.85rem;color:#8B6914;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Número de Pedido</div>
            <div style="font-size:2.8rem;font-weight:bold;color:#2C1810;text-shadow:0 1px 2px rgba(0,0,0,0.1);">#${String(orderData.numero).padStart(4, '0')}</div>
          </div>
          
          <!-- Details -->
          <div style="padding:25px 30px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid #eee;color:#555;font-size:0.95rem;">📋 Cliente</td>
                <td style="padding:14px 0;border-bottom:1px solid #eee;font-weight:bold;text-align:right;font-size:1rem;color:#2C1810;">${orderData.cliente}</td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid #eee;color:#555;font-size:0.95rem;">📱 Teléfono</td>
                <td style="padding:14px 0;border-bottom:1px solid #eee;font-weight:bold;text-align:right;font-size:1rem;">
                  <a href="https://wa.me/${orderData.telefono.replace(/\D/g,'')}" style="color:#25D366;text-decoration:none;font-weight:600;">
                    ${orderData.telefono}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid #eee;color:#555;font-size:0.95rem;">🚚 Entrega</td>
                <td style="padding:14px 0;border-bottom:1px solid #eee;font-weight:bold;text-align:right;font-size:1rem;color:#2C1810;">${tipoEntregaTexto}</td>
              </tr>
            </table>
            
            ${orderData.descuento > 0 ? `
            <!-- Promociones Aplicadas -->
            <div style="background:#d4edda;padding:16px;border-radius:12px;margin:20px 0;border:2px solid #28a745;">
              <div style="font-size:0.9rem;color:#155724;margin-bottom:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🎉 Promociones Aplicadas</div>
              ${orderData.promos_aplicadas && orderData.promos_aplicadas.length > 0 ? orderData.promos_aplicadas.map(p => 
                `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #155724;font-size:0.9rem;color:#155724;">` +
                `<span>${p.titulo}</span>` +
                `<span style="font-weight:700;">-RD$ ${(p.ahorro || p.descuento || 0).toLocaleString()}</span>` +
                `</div>`
              ).join('') : ''}
              <div style="display:flex;justify-content:space-between;padding-top:10px;margin-top:6px;font-weight:700;font-size:1rem;color:#155724;border-top:2px solid #28a745;">
                <span>Total Descuento:</span>
                <span>-RD$ ${(orderData.descuento || 0).toLocaleString()}</span>
              </div>
            </div>
            ` : ''}
            
            <!-- Products -->
            <div style="background:#FEF9F3;padding:20px;border-radius:12px;margin:20px 0;border:1px solid #E8DCC8;">
              <div style="font-size:0.9rem;color:#5D3A1A;margin-bottom:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🍪 Productos</div>
              <div style="font-size:1rem;line-height:1.8;color:#2C1810;font-weight:500;">${orderData.productos.replace(/,/g, '<br>')}</div>
            </div>
            
            <!-- Totals -->
            <div style="background:#FEF9F3;padding:20px;border-radius:12px;margin:20px 0;border:1px solid #E8DCC8;">
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E8DCC8;font-size:0.95rem;color:#555;">
                <span>Subtotal:</span><span>RD$ ${(orderData.subtotal || 0).toLocaleString()}</span>
              </div>
              ${orderData.descuento > 0 ? `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E8DCC8;font-size:0.95rem;color:#28a745;">
                <span>🎉 Descuento:</span><span>-RD$ ${(orderData.descuento || 0).toLocaleString()}</span>
              </div>
              ` : ''}
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E8DCC8;font-size:0.95rem;color:#555;">
                <span>Envío:</span><span>RD$ ${(orderData.envio || 0).toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:12px 0;margin-top:8px;font-size:1.3rem;font-weight:700;color:#2C1810;border-top:2px solid #2C1810;">
                <span>TOTAL A PAGAR:</span><span style="color:#C9883A;">RD$ ${Number(orderData.total || 0).toLocaleString()}</span>
              </div>
            </div>
            
            ${orderData.observaciones ? `
            <!-- Observations -->
            <div style="margin-top:20px;padding:16px;background:#FFF;border-radius:10px;border:1px solid #E8DCC8;border-left:5px solid #C9883A;">
              <div style="font-size:0.85rem;color:#5D3A1A;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📝 Observaciones</div>
              <div style="color:#2C1810;font-size:0.95rem;line-height:1.5;">${orderData.observaciones}</div>
            </div>
            ` : ''}
          </div>
          
          <!-- Footer -->
          <div style="background:#F5EDE4;padding:28px 20px;text-align:center;border-top:1px solid #E8DCC8;">
            <a href="http://localhost:${process.env.PORT || 3000}/admin" style="display:inline-block;background:linear-gradient(135deg,#2C1810,#5D3A1A);color:white;padding:16px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:1rem;box-shadow:0 4px 15px rgba(44,24,16,0.3);">
              Ver en Panel de Administración →
            </a>
            <p style="color:#8B7355;font-size:0.8rem;margin-top:22px;line-height:1.6;">
              Este es un mensaje automático de <strong>${config.shopName || 'Esme Cookies'}</strong><br>
              Generado: ${new Date().toLocaleString('es-DO')}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Usar plantilla personalizada si existe
    if (config.emailTemplate) {
      htmlContent = config.emailTemplate
        .replace(/\{\{numero\}\}/g, String(orderData.numero).padStart(4, '0'))
        .replace(/\{\{cliente\}\}/g, orderData.cliente)
        .replace(/\{\{telefono\}\}/g, orderData.telefono)
        .replace(/\{\{productos\}\}/g, orderData.productos.replace(/,/g, '<br>'))
        .replace(/\{\{total\}\}/g, Number(orderData.total || 0).toLocaleString())
        .replace(/\{\{tipo_entrega\}\}/g, tipoEntregaTexto)
        .replace(/\{\{observaciones\}\}/g, orderData.observaciones || '');
    }

    const mailOptions = {
      from: `"${config.shopName || 'Esme Cookies'} 🍪" <${config.emailUser}>`,
      to: config.adminEmail,
      subject: `🍪 ¡Nuevo Pedido #${String(orderData.numero).padStart(4, '0')}! - ${orderData.cliente}`,
      html: htmlContent,
      priority: 'high'
    };

    // Enviar con reintentos
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await transporter.sendMail(mailOptions);
        console.log(`[${new Date().toISOString()}] ✅ Email enviado exitosamente - Pedido #${orderData.numero}`);
        return { success: true };
      } catch (error) {
        lastError = error;
        console.warn(`[Email] Intento ${attempt} fallido:`, error.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    console.error(`[Email] ❌ Error al enviar email después de 2 intentos - Pedido #${orderData.numero}:`, lastError?.message);
    return { success: false, error: lastError?.message };
    
  } catch (error) {
    console.error('[Email] Error general:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendNewOrderEmail
};
