var API_URL = window.location.protocol + '//' + window.location.host;

function enableNotifications() {
  if (!("Notification" in window)) {
    showToast("Este navegador no soporta notificaciones de escritorio", "error");
    return;
  }
  Notification.requestPermission().then(function (permission) {
    if (permission === "granted") {
      showToast("Â¡Alertas activadas! ðŸ””", "success");
      document.getElementById('btn-notifications').style.display = 'none';
      // Uncloking audio playback
      var audio = new Audio('https://www.soundjay.com/buttons/sounds/button-09a.mp3');
      audio.volume = 0;
      audio.play().catch(function(e){ console.log("Audio unlock failed", e); });
    }
  });
}

var socket = io();
var pendingOrders = [];

socket.on('nuevo_pedido', function(pedido) {
  // AÃ±adir a lista de pedidos pendientes
  pendingOrders.push(pedido);
  
  // Mostrar notificaciÃ³n flotante grande
  showFloatingNotification(pedido);
  
  // Pulse animation for tabs
  var pedidosTab = document.querySelectorAll('.tab')[1];
  var dashTab = document.querySelectorAll('.tab')[0];
  if (pedidosTab) {
    pedidosTab.classList.add('pulse');
    updatePedidosCounters();
  }
  if (dashTab) dashTab.classList.add('pulse');

  // Sonido de campana
  playNotificationSound();

  // NotificaciÃ³n de escritorio
  if (Notification.permission === "granted") {
    var n = new Notification("ðŸª Â¡Nuevo Pedido!", {
      body: "#" + String(pedido.numero).padStart(4, '0') + " - " + pedido.cliente + "\n" + pedido.productos,
      icon: "/favicon.ico",
      tag: 'pedido-' + pedido.numero,
      requireInteraction: true
    });
    n.onclick = function() { window.focus(); showTab('pedidos'); };
  }
  
  // Cargar datos en segundo plano
  loadDataSilently();
});

function showFloatingNotification(pedido) {
  // Crear elemento de notificaciÃ³n flotante
  var notif = document.createElement('div');
  notif.style.cssText = 'position:fixed;top:80px;right:20px;background:linear-gradient(135deg, #2ecc71, #27ae60);color:white;padding:20px 24px;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.3);z-index:10000;max-width:350px;animation:slideInRight 0.5s cubic-bezier(0.68,-0.55,0.265,1.55) forwards;';
  notif.innerHTML = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;"><span style="font-size:2rem;">ðŸª</span><div><strong style="font-size:1.1rem;">Â¡Nuevo Pedido!</strong><br><span style="opacity:0.9;">#' + String(pedido.numero).padStart(4, '0') + '</span></div></div><div style="font-size:0.95rem;margin-bottom:8px;"><strong>' + pedido.cliente + '</strong></div><div style="font-size:0.85rem;opacity:0.9;margin-bottom:12px;">' + pedido.productos.substring(0, 80) + (pedido.productos.length > 80 ? '...' : '') + '</div><div style="font-size:1.2rem;font-weight:700;">RD$ ' + Number(pedido.total || 0).toLocaleString() + '</div><button onclick="this.parentElement.remove();showTab(\'pedidos\');" style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.2);border:none;color:white;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:14px;line-height:1;">Ã—</button>';
  document.body.appendChild(notif);
  
  // Auto-remover despuÃ©s de 8 segundos
  setTimeout(function() {
    if (notif.parentElement) {
      notif.style.animation = 'slideOutRight 0.3s ease forwards';
      setTimeout(function() { if (notif.parentElement) notif.remove(); }, 300);
    }
  }, 8000);
}

function playNotificationSound() {
  try {
    // Usar un sonido inline con Web Audio API para mejor compatibilidad
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var oscillator = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch(e) {
    // Fallback a audio tradicional
    var audio = new Audio('https://www.soundjay.com/buttons/sounds/button-09a.mp3');
    audio.volume = 0.5;
    audio.play().catch(function(err){ console.warn("Audio blocked", err); });
  }
}

async function loadDataSilently() {
  try {
    var res = await apiFetch(API_URL + '/api/orders');
    if (res.ok) orders = await res.json();
    var pres = await apiFetch(API_URL + '/api/products');
    if (pres.ok) products = await pres.json();
    renderDashboard();
    renderOrders();
    renderPreparacion();
    updatePedidosCounters();
  } catch (err) { console.warn('Error silencioso:', err); }
}

if (Notification.permission === "granted") {
  setTimeout(function() { 
    if(document.getElementById('btn-notifications')) document.getElementById('btn-notifications').style.display = 'none'; 
  }, 500);
}

async function apiFetch(url, options = {}) {
  var token = sessionStorage.getItem('admin_token');
  if (!options.headers) options.headers = {};
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  
  var res = await window.fetch(url, options);
  if (res.status === 401) {
    logout();
  }
  return res;
}

async function login() {
  var user = document.getElementById('username').value;
  var pass = document.getElementById('password').value;
  
  try {
    var res = await fetch(API_URL + '/api/admin/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: user, password: pass})
    });
    var data = await res.json();
    
    if (data.success) {
      sessionStorage.setItem('admin_logged', 'true');
      sessionStorage.setItem('admin_token', data.token);
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('admin-panel').classList.remove('hidden');
      loadData();
    } else {
      document.getElementById('login-error').style.display = 'block';
      document.getElementById('login-error').textContent = data.error || 'Error al iniciar sesiÃ³n';
    }
  } catch(err) {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('login-error').textContent = 'Error de conexiÃ³n';
  }
}

function logout() {
  sessionStorage.removeItem('admin_logged');
  sessionStorage.removeItem('admin_token');
  location.reload();
}


var orders = [];
var products = [];
var editingOrder = null;
var editingProduct = null;
var currentConfig = { pickupAddress: "Calle Principal #1, San Juan", deliveryPrice: 50, envioPrice: 100 };

async function loadConfig() {
  try {
    var res = await apiFetch(API_URL + '/api/config');
    if (res.ok) {
      currentConfig = await res.json();
      // Logistics
      document.getElementById('cfg-delivery').value = currentConfig.deliveryPrice || 0;
      document.getElementById('cfg-envio').value = currentConfig.envioPrice || 0;
      document.getElementById('cfg-pickup').value = currentConfig.pickupAddress || '';
      
      // Shop Info
      document.getElementById('cfg-shop-name').value = currentConfig.shopName || 'Esme Cookies';
      document.getElementById('cfg-shop-phone').value = currentConfig.shopPhone || '';
      document.getElementById('cfg-currency').value = currentConfig.currency || 'RD$';
      document.getElementById('cfg-is-open').checked = currentConfig.isOpen == 1;
      updateStoreStatusUI();

      // Appearance
      document.getElementById('cfg-color-primary').value = currentConfig.primaryColor || '#2C1810';
      document.getElementById('cfg-color-primary-text').value = currentConfig.primaryColor || '#2C1810';
      document.getElementById('cfg-color-accent').value = currentConfig.accentColor || '#C9883A';
      document.getElementById('cfg-color-accent-text').value = currentConfig.accentColor || '#C9883A';
      syncColor('primary', true);
      syncColor('accent', true);

      // Email
      document.getElementById('cfg-email-user').value = currentConfig.emailUser || '';
      document.getElementById('cfg-admin-email').value = currentConfig.adminEmail || '';
      document.getElementById('cfg-email-host').value = currentConfig.emailHost || 'smtp.gmail.com';
      document.getElementById('cfg-email-port').value = currentConfig.emailPort || 465;
      document.getElementById('cfg-email-secure').value = currentConfig.emailSecure !== undefined ? currentConfig.emailSecure : 1;
      document.getElementById('cfg-email-template').value = currentConfig.emailTemplate || '';
      document.getElementById('cfg-email-notif').checked = currentConfig.emailNotifications == 1;
      updateEmailNotifUI();
    }
  } catch (err) { console.error('Error load config'); }
  loadAdmins();
}

function syncColor(type, updatePicker) {
  var picker = document.getElementById('cfg-color-' + type);
  var text = document.getElementById('cfg-color-' + type + '-text');
  if (updatePicker) picker.value = text.value;
  else text.value = picker.value;
  
  document.documentElement.style.setProperty('--' + type, picker.value);
}

// Listeners for color pickers
document.addEventListener('input', function(e) {
  if (e.target.id === 'cfg-color-primary') syncColor('primary');
  if (e.target.id === 'cfg-color-accent') syncColor('accent');
});

function updateStoreStatusUI() {
  var isOpen = document.getElementById('cfg-is-open').checked;
  var label = document.getElementById('store-status-label');
  label.textContent = isOpen ? 'TIENDA ABIERTA âœ…' : 'TIENDA CERRADA âŒ';
  label.style.color = isOpen ? 'var(--success)' : 'var(--danger)';
}

async function saveGeneralConfig() {
  var data = {
    shopName: document.getElementById('cfg-shop-name').value.trim(),
    shopPhone: document.getElementById('cfg-shop-phone').value.trim(),
    currency: document.getElementById('cfg-currency').value.trim(),
    pickupAddress: document.getElementById('cfg-pickup').value.trim(),
    deliveryPrice: parseFloat(document.getElementById('cfg-delivery').value) || 0,
    envioPrice: parseFloat(document.getElementById('cfg-envio').value) || 0,
    primaryColor: document.getElementById('cfg-color-primary').value,
    accentColor: document.getElementById('cfg-color-accent').value,
    isOpen: document.getElementById('cfg-is-open').checked ? 1 : 0
  };
  
  try {
    var res = await apiFetch(API_URL + '/api/config', { 
      method: 'POST', 
      headers: {'Content-Type':'application/json'}, 
      body: JSON.stringify(data) 
    });
    if (res.ok) { 
      showToast('ConfiguraciÃ³n general guardada âœ…', 'success'); 
      currentConfig = Object.assign(currentConfig, data);
    }
    else { showToast('Error al guardar', 'error'); }
  } catch(err) { showToast('Error de conexiÃ³n', 'error'); }
}

async function saveEmailConfig() {
  var data = {
    emailUser: document.getElementById('cfg-email-user').value.trim(),
    emailPass: document.getElementById('cfg-email-pass').value,
    adminEmail: document.getElementById('cfg-admin-email').value.trim(),
    emailHost: document.getElementById('cfg-email-host').value.trim(),
    emailPort: parseInt(document.getElementById('cfg-email-port').value),
    emailSecure: parseInt(document.getElementById('cfg-email-secure').value),
    emailTemplate: document.getElementById('cfg-email-template').value.trim(),
    emailNotifications: document.getElementById('cfg-email-notif').checked ? 1 : 0
  };
  if (!data.emailUser || !data.adminEmail) { showToast('Ingresa el correo remitente y destinatario', 'error'); return; }
  try {
    var res = await apiFetch(API_URL + '/api/config', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    if (res.ok) { showToast('ConfiguraciÃ³n de correo guardada âœ…', 'success'); document.getElementById('cfg-email-pass').value = ''; }
    else { showToast('Error al guardar', 'error'); }
  } catch(err) { showToast('Error de conexiÃ³n', 'error'); }
}

function updateEmailNotifUI() {
  var enabled = document.getElementById('cfg-email-notif').checked;
  document.getElementById('email-notif-label').textContent = enabled ? 'âœ… ACTIVADO' : 'âŒ DESACTIVADO';
  document.getElementById('email-notif-label').style.color = enabled ? 'var(--success)' : 'var(--danger)';
}

async function loadAdmins() {
  try {
    var res = await apiFetch(API_URL + '/api/administradores');
    if (res.ok) {
      var admins = await res.json();
      var html = '';
      admins.forEach(function(a) {
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--cream);border-radius:10px;margin-bottom:8px;">'
              + '<span style="font-weight:600;">ðŸ‘¤ ' + a.username + '</span>'
              + '<div style="display:flex;gap:8px;">'
              + '<button onclick="promptChangePassword(' + a.id + ')" style="padding:6px 12px;background:var(--warning-light);color:var(--warning);border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">ðŸ”‘</button>'
              + '<button onclick="deleteAdmin(' + a.id + ')" style="padding:6px 12px;background:var(--danger-light);color:var(--danger);border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">ðŸ—‘ï¸</button>'
              + '</div></div>';
      });
      document.getElementById('admins-list').innerHTML = html || '<p style="color:var(--text-muted);">No hay administradores.</p>';
    }
  } catch(err) { console.error('Error loading admins'); }
}

// ==================== CLIENTES ====================
let allClientes = [];
let clienteHistorial = [];

async function loadClientes() {
  try {
    var res = await apiFetch(API_URL + '/api/clientes');
    if (res.ok) {
      allClientes = await res.json();
      renderClientes(allClientes);
      updateClientesStats();
    }
  } catch(err) { console.error('Error loading clientes'); }
}

function updateClientesStats() {
  document.getElementById('clientes-total').textContent = allClientes.length;
  const total = allClientes.reduce((sum, c) => sum + (c.total_gastado || 0), 0);
  document.getElementById('clientes-ventas').textContent = 'RD$' + total.toLocaleString();
  const top = allClientes.sort((a, b) => (b.total_gastado || 0) - (a.total_gastado || 0))[0];
  document.getElementById('clientes-top').textContent = top ? top.nombre.substring(0, 12) : '-';
}

function renderClientes(clientes) {
  if (!clientes.length) {
    document.getElementById('clientes-list').innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">No hay clientes registrados aÃºn.</p>';
    return;
  }
  document.getElementById('clientes-list').innerHTML = clientes.map(c => {
    var ultimoPedido = c.ultimo_pedido ? new Date(c.ultimo_pedido).toLocaleDateString('es-DO') : 'Nunca';
    return `
    <div style="background:white; border-radius:16px; padding:20px; box-shadow:0 4px 15px rgba(44,24,16,0.08); cursor:pointer; transition: all 0.2s;" onclick="verHistorialCliente(${c.id})">
      <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
        <div>
          <div style="font-weight:700; font-size:1.1rem; color:var(--primary);">${c.nombre}</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">ðŸ“± ${c.telefono}</div>
          ${c.email ? `<div style="font-size:0.8rem; color:var(--text-muted);">âœ‰ï¸ ${c.email}</div>` : ''}
        </div>
        <div style="display:flex; gap:6px;">
          <button onclick="event.stopPropagation(); editCliente(${c.id})" style="padding:6px 10px; background:var(--accent); color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.8rem;">âœï¸</button>
          <button onclick="event.stopPropagation(); deleteCliente(${c.id})" style="padding:6px 10px; background:var(--warm); color:var(--text-muted); border:none; border-radius:6px; cursor:pointer; font-size:0.8rem;" title="Los clientes no se eliminan">ðŸ‘ï¸</button>
        </div>
      </div>
      ${c.direccion || c.sector ? `<div style="font-size:0.85rem; color:#666; margin-bottom:8px;">ðŸ“ ${c.direccion || ''} ${c.sector ? '(' + c.sector + ')' : ''}</div>` : ''}
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid var(--warm); text-align:center;">
        <div>
          <div style="font-weight:700; color:var(--accent);">${c.total_pedidos || 0}</div>
          <div style="font-size:0.7rem; color:var(--text-muted);">Pedidos</div>
        </div>
        <div>
          <div style="font-weight:700; color:var(--success);">RD$${(c.total_gastado || 0).toLocaleString()}</div>
          <div style="font-size:0.7rem; color:var(--text-muted);">Total Pagado</div>
        </div>
        <div>
          <div style="font-weight:700; color:#28a745; font-size:0.9rem;">RD$${(c.total_descuentos || 0).toLocaleString()}</div>
          <div style="font-size:0.7rem; color:var(--text-muted);">Ahorrado</div>
        </div>
      </div>
      <div style="margin-top:8px; text-align:center; font-size:0.75rem; color:var(--primary);">
        Ãšltimo pedido: ${ultimoPedido}
      </div>
      ${c.notas ? `<div style="margin-top:10px; font-size:0.8rem; color:#888; font-style:italic; padding:8px; background:var(--cream); border-radius:6px;">ðŸ“ ${c.notas}</div>` : ''}
      <div style="margin-top:10px; text-align:center;">
        <span style="font-size:0.75rem; color:var(--accent);">ðŸ‘† Clic para ver historial de pedidos</span>
      </div>
    </div>
  `}).join('');
}

async function verHistorialCliente(id) {
  const c = allClientes.find(x => x.id == id);
  if (!c) return;
  
  try {
    var res = await apiFetch(API_URL + '/api/orders/cliente/' + encodeURIComponent(c.telefono));
    if (res.ok) {
      clienteHistorial = await res.json();
    } else {
      clienteHistorial = [];
    }
  } catch(err) { clienteHistorial = []; }
  
  var historialHtml = '';
  if (clienteHistorial.length === 0) {
    historialHtml = '<p style="text-align:center; color:var(--text-muted); padding:20px;">Este cliente aÃºn no tiene pedidos registrados.</p>';
  } else {
    historialHtml = clienteHistorial.map(o => {
      var badgeClass = o.estado === 'Pendiente' ? 'background:#fff3cd;color:#856404;' : o.estado === 'Confirmado' ? 'background:#cce5ff;color:#004085;' : o.estado === 'Entregado' ? 'background:#d4edda;color:#155724;' : 'background:#f8d7da;color:#721c24;';
      
      var promosHtml = '';
      if (o.promociones_aplicadas) {
        try {
          var promos = JSON.parse(o.promociones_aplicadas);
          if (Array.isArray(promos) && promos.length > 0) {
            promosHtml = '<div style="margin-top:8px; padding:8px; background:#d4edda; border-radius:6px; font-size:0.75rem;">';
            promos.forEach(function(p) {
              promosHtml += '<div style="color:#155724;">ðŸŽ ' + p.titulo + ': -RD$' + p.descuento.toLocaleString() + '</div>';
            });
            promosHtml += '</div>';
          }
        } catch(e) {}
      }
      
      return `
      <div style="padding:14px; border-bottom:1px solid var(--warm);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:700;">#${String(o.numero).padStart(4, '0')}</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">${o.fecha || ''}</span>
        </div>
        <div style="font-size:0.85rem; color:#666; margin:4px 0;">${o.productos || ''}</div>
        ${promosHtml}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
          <span style="padding:3px 8px; border-radius:20px; font-size:0.75rem; font-weight:600; ${badgeClass}">${o.estado || 'Sin estado'}</span>
          <div style="text-align:right;">
            <div style="font-size:0.8rem; color:#999; text-decoration:line-through;">RD$${(o.subtotal || 0).toLocaleString()}</div>
            <div style="font-weight:700; color:var(--accent);">RD$${(o.total || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>
    `}).join('');
  }
  
  document.getElementById('historial-cliente-nombre').textContent = c.nombre;
  document.getElementById('historial-cliente-info').innerHTML = `ðŸ“± ${c.telefono} | ${c.total_pedidos || 0} pedidos | RD$${(c.total_gastado || 0).toLocaleString()} gastado`;
  document.getElementById('historial-cliente-content').innerHTML = historialHtml;
  document.getElementById('historial-modal').style.display = 'flex';
}

function searchClientes() {
  const q = document.getElementById('cliente-search').value.toLowerCase();
  if (!q) { renderClientes(allClientes); return; }
  const filtered = allClientes.filter(c => 
    c.nombre.toLowerCase().includes(q) || c.telefono.includes(q)
  );
  renderClientes(filtered);
}

function editCliente(id) {
  const c = allClientes.find(x => x.id == id);
  if (!c) return;
  const nombre = prompt('Nombre:', c.nombre);
  if (nombre === null) return;
  const telefono = prompt('TelÃ©fono:', c.telefono);
  if (telefono === null) return;
  const email = prompt('Email:', c.email || '');
  const direccion = prompt('DirecciÃ³n:', c.direccion || '');
  const sector = prompt('Sector:', c.sector || '');
  const notas = prompt('Notas (para regalos/promociones):', c.notas || '');
  saveCliente(id, { nombre, telefono, email, direccion, sector, notas });
}

function openNewClienteModal() {
  const nombre = prompt('Nombre del cliente:');
  if (!nombre) return;
  const telefono = prompt('TelÃ©fono:');
  if (!telefono) return;
  const email = prompt('Email (opcional):');
  saveCliente(null, { nombre, telefono, email, direccion: '', sector: '', notas: '' });
}

async function saveCliente(id, data) {
  try {
    const url = id ? API_URL + '/api/clientes/' + id : API_URL + '/api/clientes';
    const method = id ? 'PUT' : 'POST';
    var res = await apiFetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    if (res.ok) { showToast(id ? 'Cliente actualizado âœ…' : 'Cliente creado âœ…', 'success'); loadClientes(); }
    else { showToast('Error al guardar', 'error'); }
  } catch(err) { showToast('Error de conexiÃ³n', 'error'); }
}

async function deleteCliente(id) {
  const c = allClientes.find(x => x.id == id);
  if (!c) return;
  
  showToast('âš ï¸ Los clientes no se pueden eliminar para proteger el historial de ventas', 'error');
}

async function openAdminModal() {
  var user = prompt('Nombre de usuario para el nuevo administrador:');
  if (!user) return;
  var pass = prompt('ContraseÃ±a (mÃ­nimo 6 caracteres):');
  if (!pass) return;
  if (pass.length < 6) { showToast('ContraseÃ±a muy corta', 'error'); return; }
  
  try {
    var res = await apiFetch(API_URL + '/api/administradores', { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({username: user, password: pass}) 
    });
    if (res.ok) { showToast('Administrador creado âœ…', 'success'); loadAdmins(); }
    else { var data = await res.json(); showToast(data.error || 'Error', 'error'); }
  } catch(err) { showToast('Error de conexiÃ³n', 'error'); }
}

async function deleteAdmin(id) {
  if (!confirm('Â¿Eliminar este administrador?')) return;
  try {
    var res = await apiFetch(API_URL + '/api/administradores/' + id, { method: 'DELETE' });
    if (res.ok) { showToast('Eliminado', 'success'); loadAdmins(); }
    else { showToast('Error', 'error'); }
  } catch(err) { showToast('Error de conexiÃ³n', 'error'); }
}

async function promptChangePassword(id) {
  var newPass = prompt('Nueva contraseÃ±a (mÃ­nimo 6 caracteres):');
  if (!newPass || newPass.length < 6) { showToast('ContraseÃ±a no vÃ¡lida', 'error'); return; }
  try {
    var res = await apiFetch(API_URL + '/api/administradores/' + id, { 
        method: 'PUT', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({password: newPass}) 
    });
    if (res.ok) { showToast('ContraseÃ±a actualizada âœ…', 'success'); }
    else { showToast('Error', 'error'); }
  } catch(err) { showToast('Error de conexiÃ³n', 'error'); }
}

async function testEmail() {
  showToast('Enviando correo de prueba...', 'info');
  try {
    var res = await apiFetch(API_URL + '/api/test-email', { method: 'POST' });
    var data = await res.json();
    if (res.ok) { showToast('Â¡Email enviado! Revisa tu bandeja de entrada ðŸ“§', 'success'); }
    else { showToast(data.error || 'Error al enviar', 'error'); }
  } catch(err) { showToast('Error de conexiÃ³n', 'error'); }
}

async function saveConfig() {
  var data = {
    deliveryPrice: parseFloat(document.getElementById('cfg-delivery').value) || 0,
    envioPrice: parseFloat(document.getElementById('cfg-envio').value) || 0,
    pickupAddress: document.getElementById('cfg-pickup').value.trim(),
    emailUser: document.getElementById('cfg-email-user').value.trim(),
    emailPass: '', // leave empty so server keeps existing
    adminEmail: document.getElementById('cfg-admin-email').value.trim()
  };
  try {
    var res = await apiFetch(API_URL + '/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) {
      currentConfig = data;
      showToast('Precios guardados âœ…', 'success');
    }
  } catch (err) { showToast('Error al guardar', 'error'); }
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === 'number') {
    if (dateStr > 20000 && dateStr < 60000) {
      return new Date((dateStr - 25569) * 86400 * 1000);
    }
    return null;
  }
  var parts = dateStr.split('/');
  if (parts.length === 3) {
    var d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (!isNaN(d.getTime())) return d;
  }
  var d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return null;
}

async function loadData() {
  try {
    var btn = document.querySelector('button[onclick="loadData()"]');
    if (btn) btn.textContent = '...';

    var res = await apiFetch(API_URL + '/api/orders');
    if (!res.ok) throw new Error('Error en respuesta');
    orders = await res.json();

    var pres = await apiFetch(API_URL + '/api/products');
    if (!pres.ok) throw new Error('Error en productos');
    products = await pres.json();

    await loadConfig();
    populateDateFilters();
    populateDashDateFilters();
    renderDashboard();
    updatePedidosCounters();
    renderOrders();
    renderProducts();
    loadPromos();

    if (btn) btn.textContent = 'Actualizar';
    showToast('Actualizado: ' + orders.length + ' pedidos', 'success');
  } catch (err) {
    console.error(err);
    if (btn) btn.textContent = 'Actualizar';
    showToast('Error al actualizar', 'error');
  }
}

function populateDateFilters() {
  var validDates = orders.map(function (o) { return parseDate(o.fecha); }).filter(function (d) { return d && !isNaN(d.getTime()); });
  var years = [...new Set(validDates.map(function (d) { return d.getFullYear(); }))].sort(function (a, b) { return b - a; });
  var yearSelect = document.getElementById('filter-year');
  yearSelect.innerHTML = '<option value="">Ano</option>';
  years.forEach(function (y) { yearSelect.innerHTML += '<option value="' + y + '">' + y + '</option>'; });

  var months = [...new Set(validDates.map(function (d) { return d.getMonth() + 1; }))].sort(function (a, b) { return a - b; });
  var monthSelect = document.getElementById('filter-month');
  var currentMonth = monthSelect.value;
  var monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  monthSelect.innerHTML = '<option value="">Mes</option>';
  monthNames.forEach(function (m, i) {
    if (months.indexOf(i + 1) >= 0) monthSelect.innerHTML += '<option value="' + (i + 1) + '">' + m + '</option>';
  });
  monthSelect.value = currentMonth;

  updateDayFilter();
}

function updateDayFilter() {
  var year = document.getElementById('filter-year').value;
  var month = document.getElementById('filter-month').value;
  var daySelect = document.getElementById('filter-day');
  daySelect.innerHTML = '<option value="">Dia</option>';
  if (!year || !month) return;

  var days = orders
    .map(function (o) { return { fecha: parseDate(o.fecha), fechaStr: o.fecha }; })
    .filter(function (o) { return o.fecha && !isNaN(o.fecha.getTime()); })
    .filter(function (o) { return o.fecha.getFullYear() == year && o.fecha.getMonth() + 1 == month; })
    .map(function (o) { return o.fecha.getDate(); })
    .filter(function (d, i, a) { return a.indexOf(d) === i; })
    .sort(function (a, b) { return a - b; });
  days.forEach(function (d) { daySelect.innerHTML += '<option value="' + d + '">' + d + '</option>'; });
}

function populateDashDateFilters() {
  var validDates = orders.map(function (o) { return parseDate(o.fecha); }).filter(function (d) { return d && !isNaN(d.getTime()); });
  var years = [...new Set(validDates.map(function (d) { return d.getFullYear(); }))].sort(function (a, b) { return b - a; });
  var yearSelect = document.getElementById('dash-filter-year');
  if (!yearSelect) return;
  var currentYear = yearSelect.value;
  yearSelect.innerHTML = '<option value="">AÃ±o</option>';
  years.forEach(function (y) { yearSelect.innerHTML += '<option value="' + y + '">' + y + '</option>'; });
  yearSelect.value = currentYear;

  var months = [...new Set(validDates.map(function (d) { return d.getMonth() + 1; }))].sort(function (a, b) { return a - b; });
  var monthSelect = document.getElementById('dash-filter-month');
  var currentMonth = monthSelect.value;
  var monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  monthSelect.innerHTML = '<option value="">Mes</option>';
  monthNames.forEach(function (m, i) {
    if (months.indexOf(i + 1) >= 0) monthSelect.innerHTML += '<option value="' + (i + 1) + '">' + m + '</option>';
  });
  monthSelect.value = currentMonth;
  updateDashDayFilter();
}

function updateDashDayFilter() {
  var year = document.getElementById('dash-filter-year').value;
  var month = document.getElementById('dash-filter-month').value;
  var daySelect = document.getElementById('dash-filter-day');
  if (!daySelect) return;
  var currentDay = daySelect.value;
  daySelect.innerHTML = '<option value="">DÃ­a</option>';
  if (!year || !month) return;
  var days = orders
    .map(function (o) { return parseDate(o.fecha); })
    .filter(function (d) { return d && !isNaN(d.getTime()) && d.getFullYear() == year && d.getMonth() + 1 == month; })
    .map(function (d) { return d.getDate(); })
    .filter(function (d, i, a) { return a.indexOf(d) === i; })
    .sort(function (a, b) { return a - b; });
  days.forEach(function (d) { daySelect.innerHTML += '<option value="' + d + '">' + d + '</option>'; });
  daySelect.value = currentDay;
}

function clearDashFilters() {
  document.getElementById('dash-filter-year').value = '';
  document.getElementById('dash-filter-month').value = '';
  document.getElementById('dash-filter-day').value = '';
  updateDashDayFilter();
  renderDashboard();
}

function exportToExcel() {
  var year = (document.getElementById('dash-filter-year') || {}).value;
  var month = (document.getElementById('dash-filter-month') || {}).value;
  var day = (document.getElementById('dash-filter-day') || {}).value;
  
  var filteredOrders = orders.filter(function (o) {
    if (year || month || day) {
      var d = parseDate(o.fecha);
      if (!d || isNaN(d.getTime())) return false;
      if (year && d.getFullYear() !== parseInt(year)) return false;
      if (month && d.getMonth() + 1 !== parseInt(month)) return false;
      if (day && d.getDate() !== parseInt(day)) return false;
    }
    return true;
  });

  if (filteredOrders.length === 0) {
    showToast('No hay pedidos para exportar', 'error');
    return;
  }

  // Agrupar pedidos por mes
  var ordersByMonth = {};
  filteredOrders.forEach(function(o) {
    var d = parseDate(o.fecha);
    if (!d || isNaN(d.getTime())) return;
    var mesKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    var mesNombre = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    if (!ordersByMonth[mesKey]) {
      ordersByMonth[mesKey] = { nombre: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1), orders: [] };
    }
    ordersByMonth[mesKey].orders.push(o);
  });

  // Crear libro de Excel
  var wb = XLSX.utils.book_new();
  
  // FunciÃ³n para crear tabla de resumen
  function crearResumenMensual(monthOrders, mesNombre) {
    var wsData = [];
    
    // TÃ­tulo
    wsData.push([{ t: 's', v: 'ESME COOKIES - REPORTE DE VENTAS' }]);
    wsData.push([{ t: 's', v: 'Mes: ' + mesNombre }]);
    wsData.push([{ t: 's', v: 'Fecha de GeneraciÃ³n: ' + new Date().toLocaleDateString('es-DO') }]);
    wsData.push([]);
    
    // Resumen Ejecutivo
    wsData.push([{ t: 's', v: 'RESUMEN EJECUTIVO' }]);
    
    var totalVentasNetas = monthOrders.reduce(function(s, o) { return s + (o.estado !== 'Cancelado' ? (o.total || 0) : 0); }, 0);
    var totalDescuentos = monthOrders.reduce(function(s, o) { return s + (o.descuento || 0); }, 0);
    var totalEnvios = monthOrders.reduce(function(s, o) { return s + (o.envio || 0); }, 0);
    var totalSubtotal = monthOrders.reduce(function(s, o) { return s + (o.subtotal || 0); }, 0);
    var pedidosActivos = monthOrders.filter(function(o) { return o.estado !== 'Cancelado'; }).length;
    var ticketsPromedio = pedidosActivos > 0 ? Math.round(totalVentasNetas / pedidosActivos) : 0;
    
    wsData.push(['Ventas Brutas:', totalSubtotal, 'RD$']);
    wsData.push(['Total Descuentos:', totalDescuentos, 'RD$']);
    wsData.push(['Total EnvÃ­os:', totalEnvios, 'RD$']);
    wsData.push(['VENTAS NETAS:', totalVentasNetas, 'RD$']);
    wsData.push(['Ticket Promedio:', ticketsPromedio, 'RD$']);
    wsData.push(['Total Pedidos:', monthOrders.length, '']);
    wsData.push([]);
    
    // Por Estado
    wsData.push([{ t: 's', v: 'POR ESTADO' }]);
    wsData.push(['Estado', 'Cantidad', '%']);
    wsData.push(['Pendientes', monthOrders.filter(function(o) { return o.estado === 'Pendiente'; }).length, Math.round(monthOrders.filter(function(o) { return o.estado === 'Pendiente'; }).length / monthOrders.length * 100) + '%']);
    wsData.push(['Confirmados', monthOrders.filter(function(o) { return o.estado === 'Confirmado'; }).length, Math.round(monthOrders.filter(function(o) { return o.estado === 'Confirmado'; }).length / monthOrders.length * 100) + '%']);
    wsData.push(['Entregados', monthOrders.filter(function(o) { return o.estado === 'Entregado'; }).length, Math.round(monthOrders.filter(function(o) { return o.estado === 'Entregado'; }).length / monthOrders.length * 100) + '%']);
    wsData.push(['Cancelados', monthOrders.filter(function(o) { return o.estado === 'Cancelado'; }).length, Math.round(monthOrders.filter(function(o) { return o.estado === 'Cancelado'; }).length / monthOrders.length * 100) + '%']);
    wsData.push([]);
    
    // Por MÃ©todo de Pago
    wsData.push([{ t: 's', v: 'POR MÃ‰TODO DE PAGO' }]);
    wsData.push(['MÃ©todo', 'Total', 'RD$']);
    var pagos = {};
    monthOrders.forEach(function(o) {
      if (o.estado !== 'Cancelado') {
        var metodo = o.pago || 'No especificado';
        pagos[metodo] = (pagos[metodo] || 0) + (o.total || 0);
      }
    });
    for (var metodo in pagos) {
      wsData.push([metodo, pagos[metodo], 'RD$']);
    }
    wsData.push([]);
    
    // Por Tipo de Entrega
    wsData.push([{ t: 's', v: 'POR TIPO DE ENTREGA' }]);
    wsData.push(['Tipo', 'Pedidos']);
    var entregas = {};
    monthOrders.forEach(function(o) {
      if (o.estado !== 'Cancelado') {
        var tipo = o.tipo_entrega === 'pickup' ? 'Pasar a buscar' : o.tipo_entrega === 'delivery' ? 'Delivery' : o.tipo_entrega === 'envio' ? 'EnvÃ­o Nacional' : 'No especificado';
        entregas[tipo] = (entregas[tipo] || 0) + 1;
      }
    });
    for (var tipo in entregas) {
      wsData.push([tipo, entregas[tipo]]);
    }
    
    return wsData;
  }
  
  // FunciÃ³n para crear detalle de pedidos
  function crearDetallePedidos(monthOrders) {
    var wsData = [];
    
    // Encabezados
    wsData.push(['#', 'Fecha', 'Cliente', 'TelÃ©fono', 'Tipo Entrega', 'Productos', 'Subtotal', 'Descuento', 'EnvÃ­o', 'Total', 'Pago', 'Estado', 'Promociones']);
    
    monthOrders.forEach(function(o) {
      var promos = [];
      try {
        if (o.promociones_aplicadas) {
          promos = JSON.parse(o.promociones_aplicadas);
        }
      } catch(e) { promos = []; }
      var promosTexto = promos.map(function(p) { return p.titulo + ' (-RD$' + p.descuento + ')'; }).join('; ');
      
      var productos = (o.productos || '').replace(/\n/g, ', ');
      var tipoTxt = o.tipo_entrega === 'pickup' ? 'Pasar a buscar' : o.tipo_entrega === 'delivery' ? 'Delivery' : o.tipo_entrega === 'envio' ? 'EnvÃ­o Nacional' : '';
      
      wsData.push([
        '#' + (o.numero || ''),
        o.fecha || '',
        o.cliente || '',
        o.telefono || '',
        tipoTxt,
        productos,
        o.subtotal || 0,
        o.descuento || 0,
        o.envio || 0,
        o.total || 0,
        o.pago || '',
        o.estado || '',
        promosTexto
      ]);
    });
    
    return wsData;
  }
  
  // Crear hojas por mes
  for (var mesKey in ordersByMonth) {
    var mesData = ordersByMonth[mesKey];
    var mesNombre = mesData.nombre;
    var monthOrders = mesData.orders;
    
    // Hoja de Resumen
    var wsResumen = XLSX.utils.aoa_to_sheet(crearResumenMensual(monthOrders, mesNombre));
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen ' + mesNombre.substring(0, 3));
    
    // Hoja de Detalle
    var wsDetalle = XLSX.utils.aoa_to_sheet(crearDetallePedidos(monthOrders));
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Pedidos ' + mesNombre.substring(0, 3));
  }
  
  // Hoja General (si hay mÃ¡s de un mes)
  if (Object.keys(ordersByMonth).length > 1) {
    var wsGeneral = XLSX.utils.aoa_to_sheet(crearResumenMensual(filteredOrders, 'Todos'));
    XLSX.utils.book_append_sheet(wb, wsGeneral, 'General');
    
    var wsDetalleGeneral = XLSX.utils.aoa_to_sheet(crearDetallePedidos(filteredOrders));
    XLSX.utils.book_append_sheet(wb, wsDetalleGeneral, 'Todos los Pedidos');
  }
  
  // Descargar
  XLSX.writeFile(wb, 'ESME_Reporte_Ventas_' + (new Date().toISOString().split('T')[0]) + '.xlsx');
  
  showToast('Reporte exportado exitosamente', 'success');
}

function renderDashboard() {
  var year = (document.getElementById('dash-filter-year') || {}).value;
  var month = (document.getElementById('dash-filter-month') || {}).value;
  var day = (document.getElementById('dash-filter-day') || {}).value;

  var dashOrders = orders.filter(function (o) {
    if (year || month || day) {
      var d = parseDate(o.fecha);
      if (!d || isNaN(d.getTime())) return false;
      if (year && d.getFullYear() !== parseInt(year)) return false;
      if (month && d.getMonth() + 1 !== parseInt(month)) return false;
      if (day && d.getDate() !== parseInt(day)) return false;
    }
    return true;
  });

  document.getElementById('stat-total').textContent = dashOrders.length;
  var ventas = dashOrders.reduce(function (s, o) { return s + ((o.estado !== 'Cancelado' ? o.total : 0) || 0); }, 0);
  document.getElementById('stat-sales').textContent = 'RD$' + ventas.toLocaleString();

  var nonCancelledOrders = dashOrders.filter(function (o) { return o.estado !== 'Cancelado'; });
  var ticketPromedio = nonCancelledOrders.length > 0 ? (ventas / nonCancelledOrders.length) : 0;
  if (document.getElementById('stat-avg')) document.getElementById('stat-avg').textContent = 'RD$' + Math.round(ticketPromedio).toLocaleString();

  var clientesUnicos = [...new Set(nonCancelledOrders.map(function (o) { return (o.cliente || '').toLowerCase().trim(); }).filter(Boolean))].length;
  if (document.getElementById('stat-clients')) document.getElementById('stat-clients').textContent = clientesUnicos;

  var pendientes = dashOrders.filter(function (o) { return o.estado === 'Pendiente'; }).length;
  document.getElementById('stat-pending').textContent = pendientes;
  var entregados = dashOrders.filter(function (o) { return o.estado === 'Entregado'; }).length;
  document.getElementById('stat-delivered').textContent = entregados;
  var cancelados = dashOrders.filter(function (o) { return o.estado === 'Cancelado'; }).length;
  if (document.getElementById('stat-cancelled')) document.getElementById('stat-cancelled').textContent = cancelados;

  var totalUnits = 0;
  var prodCounts = {};
  nonCancelledOrders.forEach(function (o) {
    if (o.productos) {
      var lines = o.productos.split(/[,\n]/).filter(function (l) { return l.trim(); });
      lines.forEach(function (line) {
        var name = line.trim();
        var qty = 1;
        var qtyMatch = line.match(/^(\d+)\s*[xX]\s*(.+)/);
        if (qtyMatch) {
          qty = parseInt(qtyMatch[1]) || 1;
          name = qtyMatch[2].trim();
        }
        name = name.replace(/\s*[-]\s*RD?\$?[\d,.]+$/gi, '').trim();
        if (name.length > 2) {
          prodCounts[name] = (prodCounts[name] || 0) + qty;
          totalUnits += qty;
        }
      });
    }
  });
  if (document.getElementById('stat-units')) document.getElementById('stat-units').textContent = totalUnits;

  // Actualizar contadores de pedidos
  if (document.getElementById('stat-total-pedidos')) document.getElementById('stat-total-pedidos').textContent = orders.length;
  if (document.getElementById('stat-pendientes')) document.getElementById('stat-pendientes').textContent = orders.filter(function (o) { return o.estado === 'Pendiente'; }).length;
  if (document.getElementById('stat-confirmados')) document.getElementById('stat-confirmados').textContent = orders.filter(function (o) { return o.estado === 'Confirmado'; }).length;
  if (document.getElementById('stat-entregados')) document.getElementById('stat-entregados').textContent = orders.filter(function (o) { return o.estado === 'Entregado'; }).length;

  var counts = {
    Pendiente: dashOrders.filter(function (o) { return o.estado === 'Pendiente'; }).length,
    Confirmado: dashOrders.filter(function (o) { return o.estado === 'Confirmado'; }).length,
    Entregado: dashOrders.filter(function (o) { return o.estado === 'Entregado'; }).length,
    Cancelado: dashOrders.filter(function (o) { return o.estado === 'Cancelado'; }).length
  };
  var colors = { Pendiente: 'pending', Confirmado: 'confirmed', Entregado: 'delivered', Cancelado: 'cancelled' };
  var total = dashOrders.length || 1;
  var chartHtml = '';
  for (var estado in counts) {
    var count = counts[estado];
    var pct = Math.round((count / total) * 100);
    var label = estado === 'Entregado' ? 'Entregado' : estado;
    chartHtml += '<div class="bar-item"><span class="bar-label">' + label + '</span><div class="bar-track"><div class="bar-fill ' + colors[estado] + '" style="width:' + Math.max(pct, 5) + '%">' + count + '</div></div></div>';
  }
  document.getElementById('status-chart').innerHTML = chartHtml;

  var prodCounts = {};
  dashOrders.forEach(function (o) {
    if (o.productos) {
      var lines = o.productos.split(/[,\n]/).filter(function (l) { return l.trim(); });
      lines.forEach(function (line) {
        var name = line.trim();
        var qty = 1;
        var qtyMatch = line.match(/^(\d+)\s*[xX]\s*(.+)/);
        if (qtyMatch) {
          qty = parseInt(qtyMatch[1]) || 1;
          name = qtyMatch[2].trim();
        }
        name = name.replace(/\s*[-]\s*RD?\$?[\d,.]+$/gi, '').trim();
        if (name.length > 3) {
          prodCounts[name] = (prodCounts[name] || 0) + qty;
        }
      });
    }
  });
  // Actualizar contadores globales de Pedidos (usando 'orders', no 'dashOrders')
  if (document.getElementById('stat-total-pedidos')) document.getElementById('stat-total-pedidos').textContent = orders.length;
  if (document.getElementById('stat-pendientes')) document.getElementById('stat-pendientes').textContent = orders.filter(function (o) { return o.estado === 'Pendiente'; }).length;
  if (document.getElementById('stat-confirmados')) document.getElementById('stat-confirmados').textContent = orders.filter(function (o) { return o.estado === 'Confirmado'; }).length;
  if (document.getElementById('stat-entregados')) document.getElementById('stat-entregados').textContent = orders.filter(function (o) { return o.estado === 'Entregado'; }).length;

  var counts = {
    Pendiente: dashOrders.filter(function (o) { return o.estado === 'Pendiente'; }).length,
    Confirmado: dashOrders.filter(function (o) { return o.estado === 'Confirmado'; }).length,
    Entregado: dashOrders.filter(function (o) { return o.estado === 'Entregado'; }).length,
    Cancelado: dashOrders.filter(function (o) { return o.estado === 'Cancelado'; }).length
  };
  var colors = { Pendiente: 'pending', Confirmado: 'confirmed', Entregado: 'delivered', Cancelado: 'cancelled' };
  var total = dashOrders.length || 1;
  var chartHtml = '';
  for (var estado in counts) {
    var count = counts[estado];
    var pct = Math.round((count / total) * 100);
    var label = estado === 'Entregado' ? 'Entregado' : estado;
    chartHtml += '<div class="bar-item"><span class="bar-label">' + label + '</span><div class="bar-track"><div class="bar-fill ' + colors[estado] + '" style="width:' + Math.max(pct, 5) + '%">' + count + '</div></div></div>';
  }
  document.getElementById('status-chart').innerHTML = chartHtml;

  var sortedProds = Object.entries(prodCounts).sort(function (a, b) { return b[1] - a[1]; });

  // Top 5 Mas vendidos
  var topProds = sortedProds.slice(0, 5);
  var prodHtml = '';
  if (topProds.length === 0) {
    prodHtml = '<p style="color:var(--text-muted)">Sin datos</p>';
  } else {
    var max = topProds[0][1];
    topProds.forEach(function (item) {
      var name = item[0], count = item[1];
      var pct = Math.round((count / max) * 100);
      prodHtml += '<div class="bar-item"><span class="bar-label" title="' + name + '">' + name.substring(0, 20) + '</span><div class="bar-track"><div class="bar-fill confirmed" style="width:' + Math.max(pct, 5) + '%">' + count + ' ud</div></div></div>';
    });
  }
  document.getElementById('products-chart').innerHTML = prodHtml;

  // Bottom 5 Menos vendidos
  var worstProds = sortedProds.filter(function (i) { return i[1] > 0; }).reverse().slice(0, 5);
  var worstHtml = '';
  if (worstProds.length === 0) {
    worstHtml = '<p style="color:var(--text-muted)">Sin datos</p>';
  } else {
    var wmax = worstProds[worstProds.length - 1][1] || 1; // Highest of the worst block
    if (wmax < 5) wmax = 5;
    worstProds.forEach(function (item) {
      var name = item[0], count = item[1];
      var pct = Math.round((count / wmax) * 100);
      worstHtml += '<div class="bar-item"><span class="bar-label" title="' + name + '">' + name.substring(0, 20) + '</span><div class="bar-track"><div class="bar-fill pending" style="width:' + Math.max(pct, 5) + '%">' + count + ' ud</div></div></div>';
    });
  }
  if (document.getElementById('worst-products-chart')) {
    document.getElementById('worst-products-chart').innerHTML = worstHtml;
  }
  
  // EstadÃ­sticas de Promociones
  var promosActivas = promos.filter(function(p) { return p.activa == 1; }).length;
  if (document.getElementById('stat-promos-activas')) document.getElementById('stat-promos-activas').textContent = promosActivas;
  
  var totalDescuentos = dashOrders.reduce(function(s, o) { return s + (o.descuento || 0); }, 0);
  if (document.getElementById('stat-descuentos')) document.getElementById('stat-descuentos').textContent = 'RD$' + totalDescuentos.toLocaleString();
  
  var pedidosConPromo = dashOrders.filter(function(o) { return o.promociones_aplicadas && o.promociones_aplicadas.length > 2; }).length;
  if (document.getElementById('stat-pedidos-promo')) document.getElementById('stat-pedidos-promo').textContent = pedidosConPromo;
  
  // Lista de promociones mÃ¡s usadas
  var promoUsage = {};
  dashOrders.forEach(function(o) {
    if (o.promociones_aplicadas) {
      try {
        var applied = JSON.parse(o.promociones_aplicadas);
        if (Array.isArray(applied)) {
          applied.forEach(function(p) {
            if (p.titulo) {
              promoUsage[p.titulo] = (promoUsage[p.titulo] || 0) + 1;
            }
          });
        }
      } catch(e) {}
    }
  });
  
  var promosHtml = '';
  var sortedPromos = Object.entries(promoUsage).sort(function(a, b) { return b[1] - a[1]; });
  if (sortedPromos.length === 0) {
    promosHtml = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No hay promociones aplicadas en este perÃ­odo.</p>';
  } else {
    sortedPromos.slice(0, 10).forEach(function(item) {
      promosHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--warm);">';
      promosHtml += '<span style="font-weight:600;">' + item[0] + '</span>';
      promosHtml += '<span style="background:var(--accent); color:white; padding:4px 12px; border-radius:20px; font-size:0.85rem; font-weight:700;">' + item[1] + ' usado(s)</span>';
      promosHtml += '</div>';
    });
  }
  if (document.getElementById('promos-usage-list')) document.getElementById('promos-usage-list').innerHTML = promosHtml;
}

function renderOrders() {
  var search = (document.getElementById('search') || { value: '' }).value.toLowerCase();
  var status = (document.getElementById('filter-status') || { value: '' }).value;
  var entrega = (document.getElementById('filter-entrega') || { value: '' }).value;
  var year = (document.getElementById('filter-year') || { value: '' }).value;
  var month = (document.getElementById('filter-month') || { value: '' }).value;
  var day = (document.getElementById('filter-day') || { value: '' }).value;

  var filtered = orders.filter(function (o) {
    if (search) {
      var s = search;
      if (!(o.cliente && o.cliente.toLowerCase().includes(s)) &&
        !(String(o.numero).includes(s)) &&
        !(o.telefono && o.telefono.includes(s)) &&
        !(o.productos && o.productos.toLowerCase().includes(s))) return false;
    }
    if (status && o.estado !== status) return false;
    if (entrega && o.tipo_entrega !== entrega) return false;

    if (year || month || day) {
      var d = parseDate(o.fecha);
      if (!d || isNaN(d.getTime())) return false;
      if (year && d.getFullYear() !== parseInt(year)) return false;
      if (month && d.getMonth() + 1 !== parseInt(month)) return false;
      if (day && d.getDate() !== parseInt(day)) return false;
    }
    return true;
  });

  filtered.sort(function (a, b) { return b.numero - a.numero; });

  var container = document.getElementById('orders-container');

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty"><div class="icon">ðŸ“‹</div><h3>No hay pedidos</h3></div>';
    return;
  }

  var html = '<table><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Entrega</th><th>Estado</th><th>Subtotal</th><th>Descuento</th><th>Total</th><th>Acciones</th></tr></thead><tbody>';
  filtered.forEach(function (o) {
    var badgeClass = o.estado === 'Pendiente' ? 'pending' : o.estado === 'Confirmado' ? 'confirmed' : o.estado === 'Entregado' ? 'delivered' : 'cancelled';
    var tipoEntrega = o.tipo_entrega === 'pickup' ? 'Pasar' : o.tipo_entrega === 'delivery' ? 'Delivery' : o.tipo_entrega === 'envio' ? 'Envio' : '-';
    var nextState = getNextState(o.estado);
    var btnLabel = nextState ? (nextState === 'Confirmado' ? 'Confirmar' : 'Entregar') : 'Entregado';
    var btnBg = o.estado === 'Pendiente' ? 'var(--warning)' : 'var(--success)';
    
    var descuentoHtml = '';
    if (o.descuento && o.descuento > 0) {
      var promos = [];
      try { promos = JSON.parse(o.promociones_aplicadas || '[]'); } catch(e) {}
      var promoNames = promos.map(function(p) { return p.titulo; }).join(', ');
      descuentoHtml = '<span style="color:#28a745;font-size:0.8rem;" title="' + promoNames + '">-' + (o.descuento || 0).toLocaleString() + '</span>';
    } else {
      descuentoHtml = '<span style="color:#999;">-</span>';
    }
    
    html += '<tr onclick="openEditModal(' + o.numero + ')" style="cursor:pointer"><td><span class="order-num">#' + String(o.numero).padStart(4, '0') + '</span></td><td>' + (o.fecha || '-') + '</td><td><strong>' + (o.cliente || '-') + '</strong><br><small style="color:var(--text-muted)">' + (o.telefono || '-') + '</small></td><td><span style="font-size:0.85rem">' + tipoEntrega + '</span></td><td><span class="badge badge-' + badgeClass + '">' + (o.estado || 'Pendiente') + '</span></td><td style="text-align:right;"><span style="font-size:0.85rem;color:#666;">' + (o.subtotal || 0).toLocaleString() + '</span></td><td style="text-align:right;">' + descuentoHtml + '</td><td style="text-align:right;"><strong>RD$ ' + (o.total || 0).toLocaleString() + '</strong></td><td onclick="event.stopPropagation()"><div class="actions"><button class="action-btn" onclick="sendConfirmation(' + o.numero + ')" style="background:' + btnBg + ';color:white;padding:6px 12px;">' + btnLabel + '</button><button class="action-btn" onclick="sendWhatsApp(' + o.numero + ')">WhatsApp</button><button class="action-btn edit" onclick="openEditModal(' + o.numero + ')">Editar</button><button class="action-btn delete" onclick="confirmDelete(' + o.numero + ')">Eliminar</button></div></td></tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function clearFilters() {
  document.getElementById('search').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-entrega').value = '';
  document.getElementById('filter-year').value = '';
  document.getElementById('filter-month').value = '';
  document.getElementById('filter-day').value = '';
  updateDayFilter();
  renderOrders();
}

function renderProducts() {
  var grid = document.getElementById('products-grid');
  var html = '';
  products.forEach(function (p) {
    var imageUrl = p.imagen ? (p.imagen.startsWith('http') ? p.imagen : API_URL + p.imagen) : null;
    var imageHtml = imageUrl 
      ? '<img src="' + imageUrl + '" class="product-image" alt="' + p.nombre + '" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">'
      : '';
    var placeholderHtml = '<div class="product-image-placeholder" style="' + (imageUrl ? 'display:none;' : '') + '">ðŸª</div>';
    html += '<div class="product-card">'
      + imageHtml + placeholderHtml
      + '<div class="product-header">'
      + '<h3>' + p.nombre + '</h3>'
      + '<div class="product-price">RD$ ' + p.precio.toLocaleString() + '</div>'
      + '</div>'
      + '<div class="product-body"><p class="product-desc">' + (p.descripcion || 'Sin descripcion') + '</p><div class="product-actions"><button class="btn-edit" onclick="editProduct(' + p.id + ')">Editar</button><button class="btn-delete" onclick="confirmDeleteProduct(' + p.id + ')">Eliminar</button></div></div>'
      + '</div>';
  });
  html += '<div class="add-product-card" onclick="openProductModal()"><div class="icon">+</div><span>Agregar</span></div>';
  grid.innerHTML = html;
}

function showTab(tab) {
  document.querySelectorAll('[id^="tab-"]').forEach(function (el) { el.classList.add('hidden'); });
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
  document.getElementById('tab-' + tab).classList.remove('hidden');
  
  var tabs = ['dashboard', 'pedidos', 'productos', 'preparacion', 'promociones', 'clientes', 'config'];
  var tabIndex = tabs.indexOf(tab);
  if (tabIndex >= 0) {
    var tabBtn = document.querySelectorAll('.tab')[tabIndex];
    tabBtn.classList.add('active');
    tabBtn.classList.remove('pulse'); // Quitar efecto de nuevo pedido al entrar
  }
  if (tab === 'pedidos') {
    populateDateFilters();
    updatePedidosCounters();
    renderOrders();
  }
  if (tab === 'preparacion') renderPreparacion();
  if (tab === 'promociones') loadPromos();
  if (tab === 'clientes') loadClientes();
}

function updatePedidosCounters() {
  if (document.getElementById('stat-total-pedidos')) document.getElementById('stat-total-pedidos').textContent = orders.length;
  if (document.getElementById('stat-pendientes')) document.getElementById('stat-pendientes').textContent = orders.filter(function (o) { return o.estado === 'Pendiente'; }).length;
  if (document.getElementById('stat-confirmados')) document.getElementById('stat-confirmados').textContent = orders.filter(function (o) { return o.estado === 'Confirmado'; }).length;
  if (document.getElementById('stat-entregados')) document.getElementById('stat-entregados').textContent = orders.filter(function (o) { return o.estado === 'Entregado'; }).length;
}

function openEditModal(numero) {
  editingOrder = orders.find(function (o) { return o.numero === numero; });
  if (!editingOrder) return;
  document.getElementById('edit-num').textContent = String(numero).padStart(4, '0');

  var tipoTexto = editingOrder.tipo_entrega === 'pickup' ? 'Pasar a buscar' : editingOrder.tipo_entrega === 'delivery' ? 'Delivery' : editingOrder.tipo_entrega === 'envio' ? 'Envio' : 'No especificado';
  var badgeClass = editingOrder.estado === 'Pendiente' ? 'pending' : editingOrder.estado === 'Confirmado' ? 'confirmed' : editingOrder.estado === 'Entregado' ? 'delivered' : 'cancelled';
  var nextState = getNextState(editingOrder.estado);

  var promosHtml = '';
  if (editingOrder.promociones_aplicadas) {
    try {
      var promos = JSON.parse(editingOrder.promociones_aplicadas);
      if (Array.isArray(promos) && promos.length > 0) {
        promosHtml = '<div style="background:#d4edda;padding:12px;border-radius:8px;margin:10px 0;"><div style="font-weight:700;color:#155724;margin-bottom:8px;">ðŸŽ‰ Promociones Aplicadas:</div>';
        promos.forEach(function(p) {
          promosHtml += '<div style="display:flex;justify-content:space-between;color:#155724;padding:4px 0;border-bottom:1px dashed #28a745;">';
          promosHtml += '<span>' + p.titulo + '</span>';
          promosHtml += '<span style="font-weight:700;">-RD$ ' + p.descuento.toLocaleString() + '</span>';
          promosHtml += '</div>';
        });
        promosHtml += '</div>';
      }
    } catch(e) {}
  }

  var totalesHtml = '<div style="background:var(--cream);padding:12px;border-radius:8px;margin:10px 0;">';
  totalesHtml += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--warm);"><span>Subtotal:</span><span>RD$ ' + (editingOrder.subtotal || 0).toLocaleString() + '</span></div>';
  if (editingOrder.descuento && editingOrder.descuento > 0) {
    totalesHtml += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--warm);color:#28a745;"><span>ðŸŽ‰ Descuento:</span><span>-RD$ ' + (editingOrder.descuento || 0).toLocaleString() + '</span></div>';
  }
  totalesHtml += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--warm);"><span>EnvÃ­o:</span><span>RD$ ' + (editingOrder.envio || 0).toLocaleString() + '</span></div>';
  totalesHtml += '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:1.2rem;font-weight:700;color:var(--accent);"><span>TOTAL:</span><span>RD$ ' + (editingOrder.total || 0).toLocaleString() + '</span></div>';
  totalesHtml += '</div>';

  document.getElementById('modal-detalles').innerHTML = '<div style="margin-bottom:16px;"><span class="badge badge-' + badgeClass + '" style="font-size:1rem;padding:6px 12px;">' + editingOrder.estado + '</span>' + (nextState ? ' <button onclick="sendConfirmation(' + numero + ')" class="btn-save" style="padding:6px 12px;font-size:0.85rem;">Avanzar a ' + nextState + '</button>' : ' <span style="color:var(--success);font-weight:600;">Pedido Completado</span>') + '</div><div style="display:grid;gap:10px;"><div><strong>Fecha:</strong> ' + (editingOrder.fecha || '-') + '</div><div><strong>Cliente:</strong> ' + (editingOrder.cliente || '-') + '</div><div><strong>Telefono:</strong> ' + (editingOrder.telefono || '-') + '</div><div><strong>Entrega:</strong> ' + tipoTexto + '</div>' + (editingOrder.direccion ? '<div><strong>Direccion:</strong> ' + editingOrder.direccion + '</div>' : '') + (editingOrder.nota ? '<div><strong>Nota:</strong> ' + editingOrder.nota + '</div>' : '') + promosHtml + '<div><strong>Productos:</strong></div><div style="background:var(--cream);padding:12px;border-radius:8px;white-space:pre-wrap;font-size:0.9rem;">' + (editingOrder.productos || 'Sin productos') + '</div><div><strong>Pago:</strong> ' + (editingOrder.pago || 'Por definir') + '</div>' + totalesHtml + '</div>';

  document.getElementById('edit-form-num').textContent = String(numero).padStart(4, '0');
  document.getElementById('edit-cliente').value = editingOrder.cliente || '';
  document.getElementById('edit-telefono').value = editingOrder.telefono || '';
  document.getElementById('edit-productos').value = editingOrder.productos || '';
  document.getElementById('edit-total').value = editingOrder.total || 0;
  document.getElementById('edit-estado').value = editingOrder.estado || 'Pendiente';

  document.getElementById('edit-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('edit-modal').classList.remove('open');
  editingOrder = null;
}

function enableEdit() {
  closeModal();
  document.getElementById('edit-modal-form').style.display = 'flex';
}

function closeEditForm() {
  document.getElementById('edit-modal-form').style.display = 'none';
}

async function saveOrder() {
  if (!editingOrder) return;
  closeEditForm();
  var data = {
    cliente: document.getElementById('edit-cliente').value.trim(),
    telefono: document.getElementById('edit-telefono').value.trim(),
    productos: document.getElementById('edit-productos').value.trim(),
    total: parseFloat(document.getElementById('edit-total').value) || 0,
    estado: document.getElementById('edit-estado').value,
    rowId: editingOrder.id
  };

  try {
    var res = await apiFetch(API_URL + '/api/orders/' + editingOrder.numero, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      closeModal();
      loadData();
      showToast('Pedido actualizado', 'success');
    }
  } catch (err) {
    showToast('Error de conexion', 'error');
  }
}

async function deleteOrder() {
  if (!editingOrder) return;
  if (!confirm('Eliminar pedido #' + String(editingOrder.numero).padStart(4, '0') + '?')) return;
  try {
    var res = await apiFetch(API_URL + '/api/orders/' + editingOrder.numero, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId: editingOrder.id })
    });
    if (res.ok) {
      closeModal();
      loadData();
      showToast('Pedido eliminado', 'success');
    }
  } catch (err) {
    showToast('Error', 'error');
  }
}

function confirmDelete(numero) {
  editingOrder = orders.find(function (o) { return o.numero === numero; });
  if (!editingOrder) return;
  document.getElementById('confirm-title').textContent = 'Eliminar pedido?';
  document.getElementById('confirm-message').textContent = 'Eliminar #' + String(numero).padStart(4, '0') + '?';
  document.getElementById('confirm-btn').onclick = function () {
    fetch(API_URL + '/api/orders/' + numero, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId: editingOrder.id })
    })
      .then(function (r) { if (r.ok) { closeConfirm(); loadData(); showToast('Eliminado', 'success'); } });
  };
  document.getElementById('confirm-overlay').classList.add('open');
}

function confirmDeleteProduct(id) {
  editingProduct = id;
  document.getElementById('confirm-title').textContent = 'Eliminar producto?';
  document.getElementById('confirm-message').textContent = 'Eliminar este producto?';
  document.getElementById('confirm-btn').onclick = function () {
    fetch(API_URL + '/api/products/' + id, { method: 'DELETE' })
      .then(function (r) { if (r.ok) { closeConfirm(); loadData(); showToast('Eliminado', 'success'); } });
  };
  document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
}

function sendWhatsApp(numero) {
  var order = orders.find(function (o) { return o.numero === numero; });
  if (!order || !order.telefono) { showToast('Sin telefono', 'error'); return; }
  var msg = 'ESME COOKIES\nPedido #' + String(order.numero).padStart(4, '0') + '\nCliente: ' + order.cliente + '\nTotal: RD$' + order.total + '\nEstado: ' + order.estado;
  window.open('https://wa.me/' + order.telefono + '?text=' + encodeURIComponent(msg), '_blank');
}

var ORDER_STATES = {
  Pendiente: { next: 'Confirmado', icon: 'â³', color: 'warning' },
  Confirmado: { next: 'Entregado', icon: 'âœ…', color: 'confirmed' },
  Entregado: { next: null, icon: 'ðŸŽ‰', color: 'delivered' },
  Cancelado: { next: null, icon: 'âŒ', color: 'cancelled' }
};

function getNextState(current) {
  return ORDER_STATES[current] ? ORDER_STATES[current].next : null;
}

function getConfirmationMessage(order, nuevoEstado) {
  var tipoEntrega = order.tipo_entrega || 'pickup';
  var tipoTexto = tipoEntrega === 'pickup' ? 'Pasar a buscar' : tipoEntrega === 'delivery' ? 'Delivery' : tipoEntrega === 'envio' ? 'Envio' : 'No especificado';

  if (nuevoEstado === 'Confirmado') {
    return 'ðŸª *ESME COOKIES*\n\n' +
      '*PEDIDO CONFIRMADO*\n' +
      'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n' +
      'Pedido: #' + String(order.numero).padStart(4, '0') + '\n' +
      'Cliente: ' + order.cliente + '\n' +
      'Telefono: ' + order.telefono + '\n' +
      'Entrega: ' + tipoTexto + '\n' +
      'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n' +
      '*PRODUCTOS*\n' + order.productos + '\n' +
      'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n' +
      'Total: RD$ ' + (order.total || 0).toLocaleString() + '\n' +
      'Pago: ' + (order.pago || 'Por definir') + '\n' +
      'Fecha: ' + order.fecha + '\n' +
      'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n\n' +
      'Tu pedido ha sido confirmado. Comenzaremos a prepararlo pronto.\n\n' +
      'Para cualquier consulta, responde este mensaje.';
  }

  if (nuevoEstado === 'Entregado') {
    var listoMsg = '';
    if (tipoEntrega === 'pickup') {
      listoMsg = 'Tu pedido esta listo para recoger. Pasa a buscarlo por: ' + (currentConfig.pickupAddress || 'nuestra ubicacion') + '.';
    } else if (tipoEntrega === 'delivery') {
      listoMsg = 'Tu pedido esta listo y sale pronto. El delivery passara por tu direccion en las proximas horas.';
    } else {
      listoMsg = 'Tu pedido ha sido enviado. Te llegara en los proximos dias.';
    }

    return 'ðŸª *ESME COOKIES*\n\n' +
      '*PEDIDO ENTREGADO*\n' +
      'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n' +
      'Pedido: #' + String(order.numero).padStart(4, '0') + '\n' +
      'Cliente: ' + order.cliente + '\n' +
      'Entrega: ' + tipoTexto + '\n' +
      'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n' +
      '*PRODUCTOS*\n' + order.productos + '\n' +
      'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n' +
      'Total: RD$ ' + (order.total || 0).toLocaleString() + '\n' +
      'Pago: ' + (order.pago || 'Por definir') + '\n' +
      'Fecha: ' + order.fecha + '\n' +
      'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n\n' +
      listoMsg + '\n\n' +
      'Gracias por tu pedido!';
  }

  return 'ðŸª *ESME COOKIES*\n\n' +
    'Pedido: #' + String(order.numero).padStart(4, '0') + '\n' +
    'Cliente: ' + order.cliente + '\n' +
    'Estado: ' + (nuevoEstado || order.estado) + '\n' +
    'Total: RD$ ' + (order.total || 0).toLocaleString();
}

async function sendConfirmation(numero) {
  var order = orders.find(function (o) { return o.numero === numero; });
  if (!order || !order.telefono) { showToast('Sin telefono', 'error'); return; }

  var currentState = order.estado || 'Pendiente';
  var nextState = getNextState(currentState);

  if (!nextState) {
    showToast('Este pedido ya esta completo', 'info');
    return;
  }

  var mensaje = getConfirmationMessage(order, nextState);
  var url = 'https://wa.me/' + order.telefono.replace(/\D/g, '') + '?text=' + encodeURIComponent(mensaje);
  window.open(url, '_blank');

  setTimeout(async function () {
    try {
      var res = await apiFetch(API_URL + '/api/orders/' + numero, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: nextState,
          estado_timestamp: new Date().toISOString(),
          estado_anterior: currentState,
          rowId: order.id
        })
      });
      if (res.ok) {
        order.estado = nextState;
        updatePedidosCounters();
        renderOrders();
        showToast(nextState, 'success');
        renderPreparacion();
      }
    } catch (err) {
      console.error('Error actualizando estado:', err);
      showToast('Mensaje enviado, error al actualizar', 'error');
    }
  }, 1500);
}

function renderPreparacion() {
  if (!products || products.length === 0) {
    document.getElementById('prep-by-product').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">Cargando productos...</div>';
    loadData();
    return;
  }

  var activeOrders = orders.filter(function (o) { return ['Pendiente', 'Confirmado'].indexOf(o.estado) >= 0; });

  var byDelivery = { pickup: [], delivery: [], envio: [] };
  var productCounts = {};
  var validProducts = products.map(function (p) { return p.nombre.toLowerCase(); });

  activeOrders.forEach(function (o) {
    var tipo = o.tipo_entrega || 'pickup';
    if (!byDelivery[tipo]) byDelivery[tipo] = [];
    byDelivery[tipo].push(o);

    var lines = (o.productos || '').split(/[,\n]/).filter(function (l) { return l.trim(); });
    lines.forEach(function (line) {
      var name = line.trim();
      var qty = 1;
      var qtyMatch = line.match(/^(\d+)\s*[xX]\s*(.+)/);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1]) || 1;
        name = qtyMatch[2].trim();
      }
      name = name.replace(/\s*[-]\s*RD?\$?[\d,.]+$/gi, '').trim();

      var matchedProduct = validProducts.find(function (vp) {
        return vp === name.toLowerCase() || name.toLowerCase().indexOf(vp) >= 0 || vp.indexOf(name.toLowerCase()) >= 0;
      });

      if (matchedProduct && qty > 0) {
        var productName = products.find(function (p) { return p.nombre.toLowerCase() === matchedProduct; });
        if (productName) {
          productCounts[productName.nombre] = (productCounts[productName.nombre] || 0) + qty;
        }
      }
    });
  });

  document.getElementById('count-pickup').textContent = byDelivery.pickup.length;
  document.getElementById('count-delivery').textContent = byDelivery.delivery.length;
  document.getElementById('count-envio').textContent = byDelivery.envio.length;

  var sortedProducts = Object.entries(productCounts).sort(function (a, b) { return b[1] - a[1]; });
  var productsHtml = '';
  if (sortedProducts.length > 0) {
    sortedProducts.forEach(function (item) {
      productsHtml += '<div style="background:var(--cream);border-radius:10px;padding:16px;text-align:center;border:2px solid var(--warm);"><div style="font-size:2rem;font-weight:700;color:var(--primary);">' + item[1] + '</div><div style="font-size:0.85rem;color:var(--text);margin-top:4px;">' + item[0] + '</div></div>';
    });
  } else {
    productsHtml = '<div style="color:var(--text-muted);text-align:center;padding:20px;">No hay productos pendientes</div>';
  }
  document.getElementById('prep-by-product').innerHTML = productsHtml;

  document.getElementById('prep-pickup').innerHTML = renderPrepOrders(byDelivery.pickup);
  document.getElementById('prep-delivery').innerHTML = renderPrepOrders(byDelivery.delivery);
  document.getElementById('prep-envio').innerHTML = renderPrepOrders(byDelivery.envio);
}

function renderPrepOrders(list) {
  if (!list || !list.length) return '<div style="color:var(--text-muted);text-align:center;padding:10px;font-size:0.85rem;">No hay pedidos</div>';

  list.sort(function (a, b) {
    var order = { Pendiente: 0, Confirmado: 1 };
    return (order[a.estado] || 0) - (order[b.estado] || 0);
  });

  var html = '';
  list.forEach(function (o) {
    var tipoIcon = o.tipo_entrega === 'pickup' ? 'ðŸª' : o.tipo_entrega === 'delivery' ? 'ðŸšš' : 'ðŸ“®';
    var btnLabel = o.estado === 'Pendiente' ? 'Confirmar' : 'Entregar';
    var btnBg = o.estado === 'Pendiente' ? 'var(--warning)' : 'var(--success)';
    var borderColor = o.estado === 'Pendiente' ? 'var(--warning)' : 'var(--success)';
    html += '<div style="background:white;margin-bottom:8px;padding:10px;border-radius:8px;border-left:4px solid ' + borderColor + ';"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><strong style="color:var(--primary);">' + tipoIcon + ' #' + String(o.numero).padStart(4, '0') + '</strong><span class="badge badge-' + (o.estado === 'Pendiente' ? 'pending' : 'confirmed') + '" style="font-size:0.65rem;">' + o.estado + '</span></div><div style="font-size:0.85rem;margin-bottom:4px;">' + o.cliente + '</div><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">' + (o.telefono || '') + '</div><div style="font-size:0.7rem;background:var(--cream);padding:6px;border-radius:4px;margin-bottom:6px;white-space:pre-wrap;">' + (o.productos || 'Sin productos') + '</div><div style="font-size:0.8rem;font-weight:600;color:var(--primary);">RD$ ' + (o.total || 0).toLocaleString() + '</div><div style="display:flex;gap:4px;margin-top:8px;"><button onclick="sendConfirmation(' + o.numero + ')" style="flex:1;padding:6px;background:' + btnBg + ';color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:600;">' + btnLabel + '</button><button onclick="openEditModal(' + o.numero + ')" style="padding:6px 10px;background:var(--warm);border:none;border-radius:4px;cursor:pointer;font-size:0.75rem;">Editar</button></div></div>';
  });
  return html;
}

function openProductModal(id) {
  editingProduct = id;
  document.getElementById('product-modal-title').textContent = id ? 'Editar' : 'Nuevo Producto';
  document.getElementById('product-name').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-desc').value = '';
  document.getElementById('product-image').value = '';
  document.getElementById('product-image-preview').style.display = 'none';
  document.getElementById('preview-img').src = '';

  if (id) {
    var p = products.find(function (prod) { return prod.id === id; });
    if (p) {
      document.getElementById('product-name').value = p.nombre;
      document.getElementById('product-price').value = p.precio;
      document.getElementById('product-desc').value = p.descripcion || '';
      if (p.imagen) {
        document.getElementById('product-image').value = p.imagen;
        var imgUrl = p.imagen.startsWith('http') ? p.imagen : API_URL + p.imagen;
        document.getElementById('preview-img').src = imgUrl;
        document.getElementById('product-image-preview').style.display = 'block';
      }
    }
  }
  document.getElementById('product-modal').classList.add('open');
}

function handleImageUpload(input) {
  if (input.files && input.files[0]) {
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById('preview-img').src = e.target.result;
      document.getElementById('product-image').value = e.target.result;
      document.getElementById('product-image-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

function removeProductImage() {
  document.getElementById('product-image').value = '';
  document.getElementById('product-image-preview').style.display = 'none';
  document.getElementById('preview-img').src = '';
  document.getElementById('product-image-input').value = '';
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('open');
  editingProduct = null;
}

function editProduct(id) { openProductModal(id); }

async function saveProduct() {
  var nombre = document.getElementById('product-name').value.trim();
  var precio = parseFloat(document.getElementById('product-price').value);
  var descripcion = document.getElementById('product-desc').value.trim();
  var imagenData = document.getElementById('product-image').value;

  if (!nombre || !precio) { showToast('Completa campos requeridos', 'error'); return; }

  try {
    var imagen = null;
    if (imagenData && imagenData.startsWith('data:')) {
      var res = await apiFetch(API_URL + '/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen: imagenData, filename: nombre.replace(/\s+/g, '_') + '.jpg' })
      });
      if (res.ok) {
        var data = await res.json();
        imagen = data.url;
      }
    } else if (imagenData && !imagenData.startsWith('data:')) {
      imagen = imagenData;
    }

    var productData = { nombre: nombre, precio: precio, descripcion: descripcion };
    if (imagen) productData.imagen = imagen;

    var url = editingProduct ? API_URL + '/api/products/' + editingProduct : API_URL + '/api/products';
    var method = editingProduct ? 'PUT' : 'POST';

    var res = await apiFetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productData) });
    if (res.ok) { closeProductModal(); loadData(); showToast('Producto guardado', 'success'); }
    else { showToast('Error al guardar', 'error'); }
  } catch (err) {
    console.error(err);
    showToast('Error de conexion', 'error');
  }
}

function showToast(msg, type) {
  var toast = document.getElementById('toast');
  var icon = 'ðŸ””';
  if (type === 'success') icon = 'âœ…';
  if (type === 'error') icon = 'âŒ';
  if (type === 'info') icon = 'â„¹ï¸';
  if (type === 'warning') icon = 'âš ï¸';
  
  toast.innerHTML = '<span style="font-size:1.5rem;">' + icon + '</span> <span>' + msg + '</span>';
  toast.className = 'toast ' + type + ' show';
  setTimeout(function () { toast.classList.remove('show'); }, 4000);
}

// ===== PROMOCIONES =====
var editingPromo = null;
var promos = [];

document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'promo-tipo') {
    document.getElementById('promo-pct-group').style.display = e.target.value === 'descuento' ? 'block' : 'none';
  }
});

async function loadPromos() {
  try {
    var res = await apiFetch(API_URL + '/api/promociones/all');
    if (res.ok) {
      promos = await res.json();
      renderPromos();
    }
  } catch(err) { console.error('Error loading promos'); }
}

function renderPromos() {
  var container = document.getElementById('promos-list');
  if (!container) return;
  if (!promos.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);background:white;border-radius:12px;"><div style="font-size:3rem;margin-bottom:12px;">ðŸŽ‰</div><p>No hay ofertas creadas aÃºn</p><p style="font-size:0.85rem;margin-top:8px;">Crea tu primera oferta con el botÃ³n de arriba</p></div>';
    return;
  }
  var tipoLabels = {
    banner: 'ðŸ·ï¸ Banner',
    free_delivery: 'ðŸšš Delivery',
    free_envio: 'ðŸ“¦ EnvÃ­o',
    free_all: 'ðŸŽ Todo Gratis',
    descuento_pct: '% Descuento',
    descuento_fijo: 'ðŸ’µ Desc Fijo',
    bogo: 'ðŸ›’ 2x1',
    cliente_nuevo: 'â­ Nuevo',
    pedido_minimo: 'ðŸ›ï¸ MÃ­n. Pedido',
    cantidad_minima: 'ðŸŽ¯ MÃ­n. Cantidad',
    whatsapp_only: 'ðŸ“± WhatsApp'
  };
  var html = promos.map(function(p) {
    var fechaInfo = '';
    if (p.fecha_inicio || p.fecha_fin) {
      var ini = p.fecha_inicio ? p.fecha_inicio : '...';
      var fin = p.fecha_fin ? p.fecha_fin : '...';
      fechaInfo = '<span style="font-size:0.7rem;color:#888;">ðŸ“… ' + ini + ' al ' + fin + '</span>';
    }
    var descuento = '';
    if (p.descuento_pct > 0) descuento = '<span style="padding:3px 8px;background:#d4edda;color:#155724;border-radius:20px;font-size:0.75rem;font-weight:600;">-' + p.descuento_pct + '%</span>';
    if (p.descuento_fijo > 0) descuento = '<span style="padding:3px 8px;background:#d4edda;color:#155724;border-radius:20px;font-size:0.75rem;font-weight:600;">-RD$' + p.descuento_fijo + '</span>';
    if (p.compra_minima > 0) descuento = '<span style="padding:3px 8px;background:#cce5ff;color:#004085;border-radius:20px;font-size:0.75rem;font-weight:600;">Min RD$' + p.compra_minima + '</span>';
    if (p.cantidad_minima > 0) descuento = '<span style="padding:3px 8px;background:#fff3cd;color:#856404;border-radius:20px;font-size:0.75rem;font-weight:600;">x' + p.cantidad_minima + '</span>';
    
    return '<div style="background:white;border-radius:12px;padding:18px;margin-bottom:12px;box-shadow:0 2px 8px rgba(44,24,16,0.08);border-left:5px solid ' + p.color + ';">'
      + '<div style="display:flex;align-items:flex-start;gap:15px;">'
      + '<div style="font-size:2.2rem;">' + (p.emoji || 'ðŸŽ‰') + '</div>'
      + '<div style="flex:1;">'
      + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
      + '<span style="font-weight:700;color:var(--primary);font-size:1.05rem;">' + p.titulo + '</span>'
      + '<span style="padding:2px 8px;background:' + p.color + '20;color:' + p.color + ';border-radius:20px;font-size:0.7rem;font-weight:600;">' + (tipoLabels[p.tipo] || p.tipo) + '</span>'
      + (p.activa ? '<span style="padding:2px 8px;background:#d4edda;color:#155724;border-radius:20px;font-size:0.7rem;font-weight:600;">âœ… Activa</span>' : '<span style="padding:2px 8px;background:#f8d7da;color:#721c24;border-radius:20px;font-size:0.7rem;font-weight:600;">âŒ Inactiva</span>')
      + '</div>'
      + (p.descripcion ? '<div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">' + p.descripcion + '</div>' : '')
      + '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + descuento + fechaInfo + '</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">'
      + '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.8rem;font-weight:600;color:var(--text-muted);">'
      + '<input type="checkbox" onchange="togglePromo(' + p.id + ',this.checked)" ' + (p.activa ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;"> Activar</label>'
      + '<button onclick="openPromoModal(' + p.id + ')" style="padding:5px 10px;background:var(--accent);color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">âœï¸</button>'
      + '<button onclick="deletePromo(' + p.id + ')" style="padding:5px 10px;background:var(--danger-light);color:var(--danger);border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">ðŸ—‘ï¸</button>'
      + '</div></div></div>';
  }).join('');
  container.innerHTML = html;
}

function togglePromoFields() {
  var tipo = document.getElementById('promo-tipo').value;
  document.getElementById('promo-field-pct').style.display = (tipo === 'descuento_pct') ? 'block' : 'none';
  document.getElementById('promo-field-fijo').style.display = (tipo === 'descuento_fijo') ? 'block' : 'none';
  document.getElementById('promo-field-minimo').style.display = (tipo === 'pedido_minimo') ? 'block' : 'none';
  document.getElementById('promo-field-cantidad').style.display = (tipo === 'cantidad_minima') ? 'block' : 'none';
}

function openPromoModal(id) {
  editingPromo = id || null;
  document.getElementById('promo-modal-title').textContent = id ? 'Editar Oferta' : 'Nueva Oferta';
  
  // Limpiar campos
  ['promo-titulo','promo-desc','promo-pct','promo-fijo','promo-minimo','promo-cantidad','promo-limite','promo-inicio','promo-fin'].forEach(function(el) {
    document.getElementById(el).value = '';
  });
  document.getElementById('promo-tipo').value = 'banner';
  document.getElementById('promo-aplica').value = 'todos';
  document.getElementById('promo-emoji').value = 'ðŸŽ‰';
  document.getElementById('promo-color').value = '#C9883A';
  document.getElementById('promo-orden').value = '0';
  document.getElementById('promo-activa').checked = true;
  togglePromoFields();
  
  // Si es ediciÃ³n, cargar datos existentes
  if (id) {
    var promo = promos.find(function(p) { return p.id === id; });
    if (promo) {
      document.getElementById('promo-titulo').value = promo.titulo || '';
      document.getElementById('promo-desc').value = promo.descripcion || '';
      document.getElementById('promo-tipo').value = promo.tipo || 'banner';
      document.getElementById('promo-aplica').value = promo.aplica_a || 'todos';
      document.getElementById('promo-pct').value = promo.descuento_pct || '';
      document.getElementById('promo-fijo').value = promo.descuento_fijo || '';
      document.getElementById('promo-minimo').value = promo.compra_minima || '';
      document.getElementById('promo-cantidad').value = promo.cantidad_minima || '';
      document.getElementById('promo-limite').value = promo.limite_usos || '';
      document.getElementById('promo-emoji').value = promo.emoji || 'ðŸŽ‰';
      document.getElementById('promo-color').value = promo.color || '#C9883A';
      document.getElementById('promo-orden').value = promo.orden || 0;
      document.getElementById('promo-inicio').value = promo.fecha_inicio || '';
      document.getElementById('promo-fin').value = promo.fecha_fin || '';
      document.getElementById('promo-activa').checked = promo.activa == 1;
      togglePromoFields();
    }
  }
  
  document.getElementById('promo-modal').style.display = 'flex';
}

function closePromoModal() {
  document.getElementById('promo-modal').style.display = 'none';
  editingPromo = null;
}

async function savePromo() {
  var titulo = document.getElementById('promo-titulo').value.trim();
  if (!titulo) { showToast('El tÃ­tulo es requerido', 'error'); return; }
  var tipo = document.getElementById('promo-tipo').value;
  var data = {
    titulo: titulo,
    descripcion: document.getElementById('promo-desc').value.trim(),
    tipo: tipo,
    aplica_a: document.getElementById('promo-aplica').value,
    descuento_pct: tipo === 'descuento_pct' ? (parseFloat(document.getElementById('promo-pct').value) || 0) : 0,
    descuento_fijo: tipo === 'descuento_fijo' ? (parseFloat(document.getElementById('promo-fijo').value) || 0) : 0,
    compra_minima: tipo === 'pedido_minimo' ? (parseFloat(document.getElementById('promo-minimo').value) || 0) : 0,
    cantidad_minima: tipo === 'cantidad_minima' ? (parseInt(document.getElementById('promo-cantidad').value) || 0) : 0,
    limite_usos: parseInt(document.getElementById('promo-limite').value) || null,
    emoji: document.getElementById('promo-emoji').value || 'ðŸŽ‰',
    color: document.getElementById('promo-color').value || '#C9883A',
    orden: parseInt(document.getElementById('promo-orden').value) || 0,
    fecha_inicio: document.getElementById('promo-inicio').value,
    fecha_fin: document.getElementById('promo-fin').value,
    activa: document.getElementById('promo-activa').checked
  };
  try {
    var url = editingPromo ? API_URL + '/api/promociones/' + editingPromo : API_URL + '/api/promociones';
    var method = editingPromo ? 'PUT' : 'POST';
    var res = await apiFetch(url, { method: method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    if (res.ok) {
      showToast('Oferta guardada âœ…', 'success');
      closePromoModal();
      loadPromos();
    } else { showToast('Error al guardar', 'error'); }
  } catch(err) { showToast('Error de conexiÃ³n', 'error'); }
}

async function togglePromo(id, activa) {
  var promo = promos.find(function(p) { return p.id === id; });
  if (!promo) return;
  try {
    await apiFetch(API_URL + '/api/promociones/' + id, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(Object.assign({}, promo, { activa: activa }))
    });
    showToast(activa ? 'Oferta activada âœ…' : 'Oferta desactivada', activa ? 'success' : 'info');
    loadPromos();
  } catch(err) { showToast('Error', 'error'); }
}

async function deletePromo(id) {
  if (!confirm('Â¿Eliminar esta oferta?')) return;
  try {
    var res = await apiFetch(API_URL + '/api/promociones/' + id, { method: 'DELETE' });
    if (res.ok) { showToast('Oferta eliminada', 'success'); loadPromos(); }
    else { showToast('Error al eliminar', 'error'); }
  } catch(err) { showToast('Error de conexiÃ³n', 'error'); }
}
// ===== FIN PROMOCIONES =====

async function generateReport() {
  try {
    showToast('Generando reporte...', 'info');
    var res = await apiFetch(API_URL + '/api/reporte/generate', { method: 'POST' });
    if (res.ok) {
      showToast('Reporte actualizado en Excel', 'success');
    } else {
      showToast('Error al generar reporte', 'error');
    }
  } catch (err) {
    showToast('Error de conexion', 'error');
  }
}

if (sessionStorage.getItem('admin_logged') === 'true') {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
  loadData();
}
