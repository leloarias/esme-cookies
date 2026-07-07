    var API_URL = window.location.protocol + '//' + window.location.host;
    var notificationsEnabled = false;
    
    // Cargar estado guardado de notificaciones
    function loadNotificationState() {
      var saved = localStorage.getItem('notif_enabled');
      if (saved === 'true') {
        notificationsEnabled = true;
      } else if (saved === 'false') {
        notificationsEnabled = false;
      } else {
        // Por defecto, si hay permiso del navegador, activar
        notificationsEnabled = Notification.permission === "granted";
      }
    }
    
    // Guardar estado de notificaciones
    function saveNotificationState() {
      localStorage.setItem('notif_enabled', notificationsEnabled);
    }
    
    // Verificar estado de notificaciones al cargar la página
    function checkNotificationStatus() {
      loadNotificationState();
      updateNotificationUI();
    }
    
    function toggleNotifications() {
      var btn = document.getElementById('btn-notifications');
      var icon = document.getElementById('notif-icon');
      var text = document.getElementById('notif-text');
      
      if (!notificationsEnabled) {
        // Solicitar permisos
        if (!("Notification" in window)) {
          showToast("Este navegador no soporta notificaciones de escritorio", "error");
          return;
        }
        Notification.requestPermission().then(function (permission) {
          if (permission === "granted") {
            notificationsEnabled = true;
            saveNotificationState();
            updateNotificationUI();
            showToast("¡Alertas activadas! 🔔", "success");
            // Unlock audio
            var audio = new Audio('https://www.soundjay.com/buttons/sounds/button-09a.mp3');
            audio.volume = 0;
            audio.play().catch(function(e){});
          } else if (permission === "denied") {
            showToast("Permiso de notificaciones bloqueado. Habilítalo en la configuración del navegador.", "error");
          }
        });
      } else {
        // Desactivar alertas
        notificationsEnabled = false;
        saveNotificationState();
        updateNotificationUI();
        showToast("Alertas desactivadas", "info");
      }
    }
    
    function updateNotificationUI() {
      var btn = document.getElementById('btn-notifications');
      var icon = document.getElementById('notif-icon');
      var text = document.getElementById('notif-text');
      
      if (notificationsEnabled) {
        btn.classList.remove('inactive-notif');
        btn.classList.add('active-notif');
        icon.textContent = '🔔';
        text.textContent = 'Activo';
      } else {
        btn.classList.remove('active-notif');
        btn.classList.add('inactive-notif');
        icon.textContent = '🔕';
        text.textContent = 'Activar';
      }
    }
    
    // Ejecutar cuando cargue la página
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(checkNotificationStatus, 100);
    });
    
    var socket = io();
    var pendingOrders = [];
    
    socket.on('nuevo_pedido', function(pedido) {
      // Añadir a lista de pedidos pendientes
      pendingOrders.push(pedido);
      
      // Mostrar notificación flotante grande
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

      // Notificación de escritorio
      if (Notification.permission === "granted") {
        var n = new Notification("🍪 ¡Nuevo Pedido!", {
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

    socket.on('promo_expirada', function(p) {
      showToast('✨ La oferta "' + p.titulo + '" ha terminado automáticamente.', 'warning');
      loadPromos();
    });
    
    function showFloatingNotification(pedido) {
      // Crear elemento de notificación flotante
      var notif = document.createElement('div');
      notif.style.cssText = 'position:fixed;top:80px;right:20px;background:linear-gradient(135deg, #2ecc71, #27ae60);color:white;padding:20px 24px;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.3);z-index:10000;max-width:350px;animation:slideInRight 0.5s cubic-bezier(0.68,-0.55,0.265,1.55) forwards;';
      notif.innerHTML = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;"><span style="font-size:2rem;">🍪</span><div><strong style="font-size:1.1rem;">¡Nuevo Pedido!</strong><br><span style="opacity:0.9;">#' + String(pedido.numero).padStart(4, '0') + '</span></div></div><div style="font-size:0.95rem;margin-bottom:8px;"><strong>' + pedido.cliente + '</strong></div><div style="font-size:0.85rem;opacity:0.9;margin-bottom:12px;">' + pedido.productos.substring(0, 80) + (pedido.productos.length > 80 ? '...' : '') + '</div><div style="font-size:1.2rem;font-weight:700;">RD$ ' + Number(pedido.total || 0).toLocaleString() + '</div><button onclick="this.parentElement.remove();showTab(\'pedidos\');" style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.2);border:none;color:white;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:14px;line-height:1;">×</button>';
      document.body.appendChild(notif);
      
      // Auto-remover después de 8 segundos
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
        var res = await apiFetch(API_URL + '/api/orders?all=true');
        if (res.ok) orders = await res.json();
        var pres = await apiFetch(API_URL + '/api/products');
        if (pres.ok) products = await pres.json();
        await loadPromos();
        renderDashboard();
        renderOrders();
        renderPreparacion();
        updatePedidosCounters();
      } catch (err) { console.warn('Error silencioso:', err); }
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
          sessionStorage.setItem('admin_id', data.adminId);
          document.getElementById('login-screen').classList.add('hidden');
          document.getElementById('admin-panel').classList.remove('hidden');
          checkNotificationStatus();
          loadData();
        } else {
          document.getElementById('login-error').style.display = 'block';
          document.getElementById('login-error').textContent = data.error || 'Error al iniciar sesión';
        }
      } catch(err) {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('login-error').textContent = 'Error de conexión';
      }
    }

    // ===== CLIENTES =====
    function openNewClienteModal() {
      document.getElementById('new-cliente-nombre').value = '';
      document.getElementById('new-cliente-telefono').value = '';
      document.getElementById('new-cliente-email').value = '';
      document.getElementById('new-cliente-direccion').value = '';
      document.getElementById('new-cliente-sector').value = '';
      document.getElementById('new-cliente-modal').style.display = 'flex';
    }

    async function saveNewCliente() {
      var nombre = document.getElementById('new-cliente-nombre').value.trim();
      var telefono = document.getElementById('new-cliente-telefono').value.trim();
      var email = document.getElementById('new-cliente-email').value.trim();
      var direccion = document.getElementById('new-cliente-direccion').value.trim();
      var sector = document.getElementById('new-cliente-sector').value.trim();
      
      if (!nombre || !telefono) {
        showToast('Nombre y teléfono son obligatorios', 'error');
        return;
      }
      
      try {
        var res = await apiFetch(API_URL + '/api/clientes', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({nombre: nombre, telefono: telefono, email: email, direccion: direccion, sector: sector})
        });
        if (res.ok) {
          showToast('Cliente guardado correctamente ✅', 'success');
          document.getElementById('new-cliente-modal').style.display = 'none';
          loadClientes();
        } else {
          var data = await res.json();
          showToast(data.error || 'Error al guardar', 'error');
        }
      } catch(err) {
        showToast('Error de conexión', 'error');
      }
    }

    // ===== CLIENTES =====
    var clientesCache = [];
    
    async function loadClientes() {
      try {
        var res = await apiFetch(API_URL + '/api/clientes/all?all=true');
        if (res.ok) {
          clientesCache = await res.json();
          renderClientes(clientesCache);
        }
      } catch(err) { 
        console.error('Error loading clientes:', err); 
        document.getElementById('clientes-list').innerHTML = '<p style="color:var(--danger);text-align:center;grid-column:1/-1;">Error al cargar clientes.</p>';
      }
    }
    
    var clientesPage = 1;
    var clientesPerPage = 50;

    function renderClientes(clientes) {
      try {
        // Actualizar contadores
        var totalClientes = clientes.length;
        var totalRecaudado = 0;
        var totalDescuentos = 0;
        var mejorCliente = '-';
        var maxGastado = 0;
        
        clientes.forEach(function(c) {
          totalRecaudado += c.total_gastado || 0;
          totalDescuentos += c.total_descuentos || 0;
          if ((c.total_gastado || 0) > maxGastado) {
            maxGastado = c.total_gastado || 0;
            mejorCliente = c.nombre || 'Sin nombre';
          }
        });
        
        document.getElementById('clientes-total').textContent = totalClientes;
        document.getElementById('clientes-ventas').textContent = 'RD$' + totalRecaudado.toLocaleString();
        document.getElementById('clientes-descuentos').textContent = 'RD$' + totalDescuentos.toLocaleString();
        document.getElementById('clientes-top').textContent = mejorCliente;
        
        if (!clientes || clientes.length === 0) {
          document.getElementById('clientes-list').innerHTML = '<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;">No hay clientes registrados.</p>';
          return;
        }

        var totalPages = Math.ceil(clientes.length / clientesPerPage);
        if (clientesPage > totalPages) clientesPage = totalPages;
        if (clientesPage < 1) clientesPage = 1;
        var start = (clientesPage - 1) * clientesPerPage;
        var pageClientes = clientes.slice(start, start + clientesPerPage);
        
        var html = '';
        pageClientes.forEach(function(c) {
          var ultimo = 'N/A';
          if (c.ultimo_pedido) {
            try {
              var d = new Date(c.ultimo_pedido);
              if (!isNaN(d.getTime())) {
                ultimo = d.toLocaleDateString('es-DO');
              } else {
                // Intentar formato DD/MM/YYYY
                var parts = c.ultimo_pedido.split('/');
                if (parts.length === 3) {
                  var d2 = new Date(parts[2], parts[1] - 1, parts[0]);
                  if (!isNaN(d2.getTime())) ultimo = d2.toLocaleDateString('es-DO');
                }
              }
            } catch(e) {}
          }
          var badgeColor = c.total_pedidos >= 5 ? 'var(--success)' : c.total_pedidos >= 2 ? 'var(--warning)' : 'var(--text-muted)';
          var isInactive = c.activo == 0;
          var cardStyle = isInactive ? 'background:#f5f5f5;opacity:0.7;' : 'background:linear-gradient(135deg, #fff, var(--cream));';
          var descuentos = c.total_descuentos || 0;
          html += '<div style="' + cardStyle + 'padding:20px;border-radius:16px;cursor:pointer;transition:all 0.2s;transform:translateY(0);box-shadow:0 2px 8px rgba(0,0,0,0.08);border:1px solid var(--warm);" onmouseover="this.style.transform=\'translateY(-4px)\';this.style.boxShadow=\'0 8px 20px rgba(0,0,0,0.15)\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.08)\'">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
                + '<div style="display:flex;align-items:center;gap:10px;">'
                + '<div style="width:45px;height:45px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:1.2rem;">' + (c.nombre ? c.nombre.charAt(0).toUpperCase() : '?') + '</div>'
                + '<div><span style="font-weight:700;font-size:1.1rem;color:var(--primary);">' + (c.nombre || 'Sin nombre') + '</span><br><span style="font-size:0.75rem;color:' + badgeColor + ';font-weight:600;">' + (c.total_pedidos || 0) + ' pedidos</span></div></div>'
                + '<div style="text-align:right;"><div style="background:var(--success);color:white;padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;margin-bottom:4px;">RD$ ' + (c.total_gastado || 0).toLocaleString() + '</div>' 
                + (descuentos > 0 ? '<div style="color:#e74c3c;font-size:0.7rem;font-weight:600;">🎟️ -RD$ ' + descuentos.toLocaleString() + '</div>' : '') + '</div></div>'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.8rem;">'
                + '<div style="color:var(--text-muted);"><span style="opacity:0.7;">📱</span> ' + (c.telefono || 'Sin teléfono') + '</div>'
                + '<div style="color:var(--text-muted);text-align:right;"><span style="opacity:0.7;">📅</span> ' + ultimo + '</div>'
                + '</div>'
                + '<div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--warm);" onclick="event.stopPropagation();">'
                + '<button onclick="showClientHistory(' + c.id + ')" style="flex:1;padding:8px;background:var(--primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:600;">📋 Historial</button>'
                + '<button onclick="editCliente(' + c.id + ')" style="padding:8px 12px;background:var(--info);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;" title="Editar">✏️</button>'
                + (isInactive 
                  ? '<button onclick="reactivarCliente(' + c.id + ')" style="padding:8px 12px;background:var(--success);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;" title="Reactivar">✅</button>'
                  : '<button onclick="desactivarCliente(' + c.id + ')" style="padding:8px 12px;background:var(--warning);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;" title="Desactivar">👁️</button>')
                + '<button onclick="eliminarCliente(' + c.id + ', true)" style="padding:8px 12px;background:var(--danger);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;" title="Eliminar completamente">🗑️</button>'
                + '</div>'
                + '</div>';
        });

        if (totalPages > 1) {
          html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;font-size:0.85rem;grid-column:1/-1;">';
          html += '<span style="color:var(--text-muted)">Mostrando ' + (start + 1) + '-' + Math.min(start + clientesPerPage, clientes.length) + ' de ' + clientes.length + ' clientes</span>';
          html += '<div style="display:flex;gap:8px;align-items:center;">';
          html += '<button onclick="clientesPage=' + Math.max(1, clientesPage - 1) + ';renderClientes(clientesCache);" style="padding:6px 14px;background:var(--warm);border:none;border-radius:6px;cursor:pointer;font-weight:600;' + (clientesPage <= 1 ? 'opacity:0.4;pointer-events:none;' : '') + '">◀ Anterior</button>';
          html += '<span style="font-weight:600;color:var(--primary);">Pág ' + clientesPage + ' de ' + totalPages + '</span>';
          html += '<button onclick="clientesPage=' + Math.min(totalPages, clientesPage + 1) + ';renderClientes(clientesCache);" style="padding:6px 14px;background:var(--warm);border:none;border-radius:6px;cursor:pointer;font-weight:600;' + (clientesPage >= totalPages ? 'opacity:0.4;pointer-events:none;' : '') + '">Siguiente ▶</button>';
          html += '</div></div>';
        }

        document.getElementById('clientes-list').innerHTML = html;
      } catch(err) { 
        console.error('Error rendering clientes:', err); 
      }
    }
    
    async function searchClientes() {
      clientesPage = 1;
      var query = document.getElementById('cliente-search').value.trim().toLowerCase();
      if (!query) {
        renderClientes(clientesCache);
        return;
      }
      var filtered = clientesCache.filter(function(c) {
        return (c.nombre && c.nombre.toLowerCase().includes(query)) || 
               (c.telefono && c.telefono.toLowerCase().includes(query));
      });
      renderClientes(filtered);
    }
    
    async function editCliente(id) {
      try {
        var res = await apiFetch(API_URL + '/api/clientes/' + id);
        if (!res.ok) { showToast('Error al cargar cliente', 'error'); return; }
        var c = await res.json();

        document.getElementById('edit-cliente-id').value = c.id;
        document.getElementById('edit-cliente-nombre').value = c.nombre || '';
        document.getElementById('edit-cliente-telefono').value = c.telefono || '';
        document.getElementById('edit-cliente-email').value = c.email || '';
        document.getElementById('edit-cliente-direccion').value = c.direccion || '';
        document.getElementById('edit-cliente-sector').value = c.sector || '';
        document.getElementById('edit-cliente-modal').style.display = 'flex';
      } catch (err) {
        showToast('Error de conexión', 'error');
      }
    }

    async function saveEditCliente() {
      var id = document.getElementById('edit-cliente-id').value;
      var nombre = document.getElementById('edit-cliente-nombre').value.trim();
      var telefono = document.getElementById('edit-cliente-telefono').value.trim();
      var email = document.getElementById('edit-cliente-email').value.trim();
      var direccion = document.getElementById('edit-cliente-direccion').value.trim();
      var sector = document.getElementById('edit-cliente-sector').value.trim();

      if (!nombre || !telefono) {
        showToast('Nombre y teléfono son obligatorios', 'error');
        return;
      }

      try {
        var res = await apiFetch(API_URL + '/api/clientes/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, telefono, email, direccion, sector, activo: 1 })
        });

        if (res.ok) {
          document.getElementById('edit-cliente-modal').style.display = 'none';
          showToast('Cliente actualizado', 'success');
          loadClientes();
        } else {
          showToast('Error al actualizar', 'error');
        }
      } catch (err) {
        showToast('Error de conexión', 'error');
      }
    }

    async function desactivarCliente(id) {
      if (!confirm('¿Desactivar este cliente? Ocultará de la lista pero mantendrá su historial.')) return;
      try {
        var res = await apiFetch(API_URL + '/api/clientes/' + id, { method: 'DELETE' });
        if (res.ok) {
          loadClientes();
        } else {
          alert('Error al desactivar cliente');
        }
      } catch(err) { alert('Error: ' + err); }
    }
    
    async function eliminarCliente(id, hard) {
      var msg = hard 
        ? '¿ELIMINAR DEFINITIVAMENTE este cliente? Se borrarán todos sus datos (pedidos se mantienen).' 
        : '¿Eliminar este cliente?';
      if (!confirm(msg)) return;
      try {
        var url = API_URL + '/api/clientes/' + id + (hard ? '?hard=true' : '');
        var res = await apiFetch(url, { method: 'DELETE' });
        if (res.ok) {
          loadClientes();
        } else {
          alert('Error al eliminar cliente');
        }
      } catch(err) { alert('Error: ' + err); }
    }
    
    async function reactivarCliente(id) {
      try {
        var res = await apiFetch(API_URL + '/api/clientes/' + id + '/reactivar', { method: 'POST' });
        if (res.ok) {
          loadClientes();
        } else {
          alert('Error al reactivarr cliente');
        }
      } catch(err) { alert('Error: ' + err); }
    }
    
    async function showClientHistory(clienteId) {
      try {
        var res = await apiFetch(API_URL + '/api/clientes/' + clienteId);
        if (res.ok) {
          var cliente = await res.json();
          var nombre = cliente.nombre || 'Sin nombre';
          var telefono = cliente.telefono || 'Sin teléfono';
          var email = cliente.email || 'No registrado';
          
          document.getElementById('historial-cliente-nombre').textContent = nombre;
          document.getElementById('historial-cliente-info').textContent = '📱 ' + telefono + ' | 📧 ' + email;
          
          var pedidosRes = await apiFetch(API_URL + '/api/orders/cliente/' + telefono);
          var pedidos = [];
          if (pedidosRes.ok) {
            pedidos = await pedidosRes.json();
          } else {
            showToast('Error al cargar historial del cliente', 'error');
          }
          
          if (!pedidos || pedidos.length === 0) {
            document.getElementById('historial-cliente-content').innerHTML = '<p style="color:var(--text-muted);text-align:center;">Este cliente no tiene pedidos.</p>';
          } else {
            var html = '<div style="display:flex;flex-direction:column;gap:10px;">';
            pedidos.forEach(function(p) {
              var fecha = p.fecha || 'Sin fecha';
              html += '<div style="background:var(--cream);padding:12px;border-radius:8px;">'
                    + '<div style="display:flex;justify-content:space-between;font-weight:600;">'
                    + '<span>Pedido #' + p.numero + '</span>'
                    + '<span style="color:var(--success);">RD$ ' + (p.total || 0).toLocaleString() + '</span>'
                    + '</div>'
                    + '<div style="font-size:0.85rem;color:var(--text-muted);margin-top:5px;">'
                    + '<div>📅 ' + fecha + '</div>'
                    + '<div>📦 Estado: ' + (p.estado || 'Pendiente') + '</div>'
                    + '<div>🛒 ' + (p.productos || 'Sin productos') + '</div>'
                    + '</div></div>';
            });
            html += '</div>';
            document.getElementById('historial-cliente-content').innerHTML = html;
          }
          
          document.getElementById('historial-modal').style.display = 'flex';
        }
      } catch(err) {
        console.error('Error loading client history:', err);
        showToast('Error al cargar historial', 'error');
      }
    }

    function logout() {
      sessionStorage.removeItem('admin_logged');
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_id');
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
          console.log('Config loaded:', currentConfig);
          
          // Parse bankAccounts if it's a string
          if (currentConfig && typeof currentConfig.bankAccounts === 'string') {
            try {
              currentConfig.bankAccounts = JSON.parse(currentConfig.bankAccounts || '[]');
            } catch(e) {
              currentConfig.bankAccounts = [];
            }
          }
          if (!currentConfig.bankAccounts) currentConfig.bankAccounts = [];
          console.log('Bank accounts:', currentConfig.bankAccounts);
          
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
          
          // Notificaciones email - por defecto activar si no está definido
          var emailNotifVal = currentConfig.emailNotifications;
          var emailNotifEnabled = (emailNotifVal == 1) || (emailNotifVal === undefined) || (emailNotifVal === null);
          var checkbox = document.getElementById('cfg-email-notif');
          var slider = document.getElementById('email-notif-slider');
          
          checkbox.checked = emailNotifEnabled;
          slider.style.backgroundColor = emailNotifEnabled ? '#3D8B5F' : '#ccc';
          
          var label = document.getElementById('email-notif-label');
          label.textContent = emailNotifEnabled ? '✅ ACTIVADO' : '❌ DESACTIVADO';
          label.style.color = emailNotifEnabled ? 'var(--success)' : 'var(--danger)';
          
          loadBankAccounts();
          loadMsgTemplates();
        }
      } catch (err) { console.error('Error load config:', err); }
      loadAdmins();
    }

    function syncColor(type, updatePicker) {
      var picker = document.getElementById('cfg-color-' + type);
      var text = document.getElementById('cfg-color-' + type + '-text');
      if (updatePicker) picker.value = text.value;
      else text.value = picker.value;
      
      document.documentElement.style.setProperty('--' + type, picker.value);
    }

    function toggleSection(sectionId) {
      var content = document.getElementById(sectionId + '-content');
      var icon = document.getElementById(sectionId + '-icon');
      var isHidden = content.style.display === 'none' || content.style.display === '';
      content.style.display = isHidden ? 'grid' : 'none';
      icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
    }

    function toggleHelp(id) {
      var panel = document.getElementById('help-' + id);
      if (panel) panel.classList.toggle('show');
    }

    // Listeners for color pickers
    document.addEventListener('input', function(e) {
      if (e.target.id === 'cfg-color-primary') syncColor('primary');
      if (e.target.id === 'cfg-color-accent') syncColor('accent');
    });

    function updateStoreStatusUI() {
      var isOpen = document.getElementById('cfg-is-open').checked;
      var label = document.getElementById('store-status-label');
      label.textContent = isOpen ? 'TIENDA ABIERTA ✅' : 'TIENDA CERRADA ❌';
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
        isOpen: document.getElementById('cfg-is-open').checked ? 1 : 0,
        emailNotifications: document.getElementById('cfg-email-notif').checked ? 1 : 0,
        bankAccounts: bankAccounts // Enviar el array directamente
      };
      
      try {
        var res = await apiFetch(API_URL + '/api/config', { 
          method: 'POST', 
          headers: {'Content-Type':'application/json'}, 
          body: JSON.stringify(data) 
        });
        if (res.ok) { 
          showToast('Configuración general guardada ✅', 'success'); 
          currentConfig = Object.assign(currentConfig, data);
        }
        else { showToast('Error al guardar', 'error'); }
      } catch(err) { showToast('Error de conexión', 'error'); }
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
        if (res.ok) { showToast('Configuración de correo guardada ✅', 'success'); document.getElementById('cfg-email-pass').value = ''; }
        else { showToast('Error al guardar', 'error'); }
      } catch(err) { showToast('Error de conexión', 'error'); }
    }

    function updateEmailNotifUI() {
      var enabled = document.getElementById('cfg-email-notif').checked;
      var slider = document.getElementById('email-notif-slider');
      slider.style.backgroundColor = enabled ? '#3D8B5F' : '#ccc';
      document.getElementById('email-notif-label').textContent = enabled ? '✅ ACTIVADO' : '❌ DESACTIVADO';
      document.getElementById('email-notif-label').style.color = enabled ? 'var(--success)' : 'var(--danger)';
    }
    
    var bankAccounts = [];
    
    function addBankAccount() {
      bankAccounts.push({ id: Date.now(), banco: '', numero: '', titular: '', cedula: '', tipo: 'Ahorros' });
      renderBankAccounts();
    }
    
    function removeBankAccount(id) {
      bankAccounts = bankAccounts.filter(function(b) { return b.id !== id; });
      renderBankAccounts();
    }
    
    function renderBankAccounts() {
      var container = document.getElementById('bank-accounts-list');
      if (bankAccounts.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No hay cuentas bancarias agregadas. Agrega una cuenta para recibir transferencias.</p>';
        return;
      }
      container.innerHTML = bankAccounts.map(function(b, i) {
        return '<div style="background:var(--cream); padding:15px; border-radius:12px; border:1px solid var(--warm-dark);">' +
          '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">' +
            '<div class="form-group" style="margin:0;"><label>Banco</label><input type="text" id="bank-banco-' + b.id + '" value="' + (b.banco || '') + '" placeholder="Ej: Banco Popular"></div>' +
            '<div class="form-group" style="margin:0;"><label>Tipo de Cuenta</label>' +
              '<select id="bank-tipo-' + b.id + '"><option value="Ahorros" ' + (b.tipo === 'Ahorros' ? 'selected' : '') + '>Ahorros</option><option value="Corriente" ' + (b.tipo === 'Corriente' ? 'selected' : '') + '>Corriente</option></select>' +
            '</div>' +
          '</div>' +
          '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">' +
            '<div class="form-group" style="margin:0;"><label>Número de Cuenta</label><input type="text" id="bank-numero-' + b.id + '" value="' + (b.numero || '') + '" placeholder="000-0000000-0"></div>' +
            '<div class="form-group" style="margin:0;"><label>Cédula (opcional)</label><input type="text" id="bank-cedula-' + b.id + '" value="' + (b.cedula || '') + '" placeholder="000-0000000-0"></div>' +
          '</div>' +
          '<div style="display:grid; grid-template-columns:1fr auto; gap:12px; align-items:end;">' +
            '<div class="form-group" style="margin:0;"><label>Nombre del Titular</label><input type="text" id="bank-titular-' + b.id + '" value="' + (b.titular || '') + '" placeholder="Nombre completo"></div>' +
            '<button onclick="removeBankAccount(' + b.id + ')" style="padding:8px 16px; background:var(--danger); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:600; height:fit-content;">🗑️</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    
    async function saveBankAccounts() {
      var accounts = bankAccounts.map(function(b) {
        return {
          id: b.id,
          banco: document.getElementById('bank-banco-' + b.id).value.trim(),
          numero: document.getElementById('bank-numero-' + b.id).value.trim(),
          titular: document.getElementById('bank-titular-' + b.id).value.trim(),
          cedula: (document.getElementById('bank-cedula-' + b.id) || {}).value ? document.getElementById('bank-cedula-' + b.id).value.trim() : '',
          tipo: document.getElementById('bank-tipo-' + b.id).value
        };
      }).filter(function(b) { return b.banco && b.numero && b.titular; });
      
      try {
        var res = await apiFetch(API_URL + '/api/config', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ bankAccounts: accounts })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          bankAccounts = accounts;
          showToast('Cuentas bancarias guardadas ✅', 'success');
          renderBankAccounts();
        } else {
          showToast('Error al guardar: ' + (data.error || 'Desconocido'), 'error');
        }
      } catch(err) {
        showToast('Error de conexión: ' + err.message, 'error');
      }
    }
    
    function loadBankAccounts() {
      try {
        var data = currentConfig.bankAccounts || '[]';
        if (typeof data === 'string') {
          bankAccounts = JSON.parse(data);
        } else {
          bankAccounts = data;
        }
        bankAccounts = bankAccounts.map(function(b) { 
          if (!b.id) b.id = Date.now() + Math.random();
          if (!b.cedula) b.cedula = '';
          return b;
        });
        renderBankAccounts();
      } catch(e) { 
        console.error('Error loading bank accounts:', e);
        bankAccounts = []; 
        renderBankAccounts(); 
      }
    }
    
    // Mensajes predeterminados
    var DEFAULT_MSG = {
      msgEsperandoPago: `*¡HOLA {{cliente}}!*
Recibimos tu pedido #{{numero}} 🎉

📋 *DATOS DEL PEDIDO*
─────────────────
👤 Cliente: {{cliente}}
🚚 Entrega: {{tipo_entrega}}
📦 Productos:
{{productos}}
─────────────────
💰 *TOTAL A PAGAR: RD$ {{total}}*
─────────────────

💳 *CUENTAS PARA TRANSFERENCIA:*
{{cuentas_bancarias}}

⏳ *PRÓXIMO PASO*
Por favor, realiza la transferencia y envíame el comprobante aquí.
Una vez confirmado tu pago, comenzaremos a preparar tu pedido.

¡Gracias por tu compra! 🍪`,
      msgPagoConfirmado: `*¡PAGO CONFIRMADO! ✅*

Pedido #{{numero}}
Cliente: {{cliente}}

Tu pago ha sido confirmado. Comenzaremos a preparar tu pedido pronto.

¡Te avisaremos cuando esté listo! 🍪`,
      msgPreparando: `*¡TU PEDIDO ESTÁ SIENDO PREPARADO! 🍪*

Pedido #{{numero}}
Cliente: {{cliente}}

Estamos preparando tu pedido con mucho cuidado. Te avisamos pronto cuando esté listo para recoger o entregar. 🎉`,
      msgListo: `🎉 *¡TU PEDIDO ESTÁ LISTO!*

Pedido #{{numero}}

{{pickup_direccion}}

¡Gracias por tu compra! 🍪`,
      msgEntregado: `*¡PEDIDO ENTREGADO! 🎉*

Pedido #{{numero}}
Cliente: {{cliente}}

Tu pedido ha sido entregado exitosamente.

¡Gracias por tu compra! Vuelve pronto 🍪`,
      msgCancelado: `*PEDIDO CANCELADO*

Pedido #{{numero}}
Cliente: {{cliente}}

Este pedido ha sido cancelado.

Si tienes alguna pregunta, respóndeme a este mensaje.`
    };
    
    function loadMsgTemplates() {
      document.getElementById('cfg-msg-esperando').value = currentConfig.msgEsperandoPago || DEFAULT_MSG.msgEsperandoPago;
      document.getElementById('cfg-msg-confirmado').value = currentConfig.msgPagoConfirmado || DEFAULT_MSG.msgPagoConfirmado;
      document.getElementById('cfg-msg-preparando').value = currentConfig.msgPreparando || DEFAULT_MSG.msgPreparando;
      document.getElementById('cfg-msg-listo').value = currentConfig.msgListo || DEFAULT_MSG.msgListo;
      document.getElementById('cfg-msg-entregado').value = currentConfig.msgEntregado || DEFAULT_MSG.msgEntregado;
    }
    
    function saveMsgTemplates() {
      var data = {
        msgEsperandoPago: document.getElementById('cfg-msg-esperando').value,
        msgPagoConfirmado: document.getElementById('cfg-msg-confirmado').value,
        msgPreparando: document.getElementById('cfg-msg-preparando').value,
        msgListo: document.getElementById('cfg-msg-listo').value,
        msgEntregado: document.getElementById('cfg-msg-entregado').value
      };
      
      apiFetch(API_URL + '/api/config', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(data)
      }).then(function(res) {
        if (res.ok) {
          showToast('Mensajes guardados correctamente ✅', 'success');
          Object.assign(currentConfig, data);
        } else {
          showToast('Error al guardar', 'error');
        }
      }).catch(function() { showToast('Error de conexión', 'error'); });
    }
    
    function resetMsgTemplates() {
      if (confirm('¿Restaurar los mensajes predeterminados?')) {
        document.getElementById('cfg-msg-esperando').value = DEFAULT_MSG.msgEsperandoPago;
        document.getElementById('cfg-msg-confirmado').value = DEFAULT_MSG.msgPagoConfirmado;
        document.getElementById('cfg-msg-preparando').value = DEFAULT_MSG.msgPreparando;
        document.getElementById('cfg-msg-listo').value = DEFAULT_MSG.msgListo;
        document.getElementById('cfg-msg-entregado').value = DEFAULT_MSG.msgEntregado;
        saveMsgTemplates();
      }
    }

    async function loadBoxConfig() {
      try {
        var res = await apiFetch(API_URL + '/api/config');
        if (!res.ok) return;
        var cfg = await res.json();
        var boxCfg = cfg.customBoxConfig || { enabled: true, sizes: [6, 12, 24], excludedProducts: [] };

        document.getElementById('cfg-box-enabled').checked = boxCfg.enabled !== false;

        document.querySelectorAll('.box-size-cb').forEach(function(cb) {
          cb.checked = (boxCfg.sizes || []).indexOf(parseInt(cb.value)) >= 0;
        });

        // Load products for exclusion list
        var pres = await apiFetch(API_URL + '/api/products');
        if (pres.ok) {
          var prods = await pres.json();
          var container = document.getElementById('box-excluded-products');
          container.innerHTML = '';
          var filtered = prods.filter(function(p) { return p.id != 7; });
          if (filtered.length === 0) {
            container.innerHTML = '<p style="color:#999;font-size:0.85rem;text-align:center;">No hay productos disponibles</p>';
          } else {
            filtered.forEach(function(p) {
              var excluded = (boxCfg.excludedProducts || []).indexOf(p.id) >= 0;
              var label = document.createElement('label');
              label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 10px;border-radius:8px;background:' + (excluded ? '#fee' : 'white') + ';border:1px solid ' + (excluded ? '#ecc' : 'var(--warm)') + ';';
              label.innerHTML = '<input type="checkbox" class="box-excl-cb" value="' + p.id + '" ' + (excluded ? 'checked' : '') + ' onchange="saveBoxConfig()"> <span style="flex:1;">' + p.nombre + '</span> <span style="color:var(--text-muted);font-size:0.8rem;">RD$' + p.precio + '</span>';
              container.appendChild(label);
            });
          }
        }
      } catch (e) {
        console.error('Error loading box config:', e);
      }
    }

    async function saveBoxConfig() {
      var enabled = document.getElementById('cfg-box-enabled').checked;
      var sizes = [];
      document.querySelectorAll('.box-size-cb:checked').forEach(function(cb) { sizes.push(parseInt(cb.value)); });
      var excludedProducts = [];
      document.querySelectorAll('.box-excl-cb:checked').forEach(function(cb) { excludedProducts.push(parseInt(cb.value)); });

      var data = {
        customBoxConfig: {
          enabled: enabled,
          sizes: sizes.length > 0 ? sizes : [6],
          excludedProducts: excludedProducts
        }
      };

      try {
        var res = await apiFetch(API_URL + '/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          showToast('Configuración de cajas guardada ✅', 'success');
          loadBoxConfig();
        } else {
          showToast('Error al guardar', 'error');
        }
      } catch (e) {
        showToast('Error de conexión', 'error');
      }
    }

    async function loadAdmins() {
      try {
        var res = await apiFetch(API_URL + '/api/administradores');
        if (res.ok) {
          var admins = await res.json();
          var currentAdminId = parseInt(sessionStorage.getItem('admin_id'));
          if (admins.length === 0) {
            document.getElementById('admins-list').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">No hay administradores.</p>';
            return;
          }
          var html = '';
          admins.forEach(function(a) {
            var isCurrentUser = String(a.id) === String(currentAdminId);
            var deleteBtn = isCurrentUser 
              ? '<button disabled title="No puedes eliminarte a ti mismo" style="padding:8px 12px;background:#ccc;color:#666;border:none;border-radius:6px;font-size:0.8rem;font-weight:600;cursor:not-allowed;">🗑️</button>'
              : '<button onclick="deleteAdmin(' + a.id + ')" style="padding:8px 12px;background:var(--danger);color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">🗑️</button>';
            
            html += '<div style="padding:12px 16px;background:var(--cream);border-radius:10px;margin-bottom:10px;">'
                  + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
                  + '<span style="font-weight:600;font-size:1rem;">👤 ' + a.username + (isCurrentUser ? ' (tú)' : '') + '</span>'
                  + '<div style="display:flex;gap:6px;">'
                  + '<button onclick="toggleAdminEdit(' + a.id + ')" id="btn-edit-' + a.id + '" style="padding:8px 12px;background:var(--accent);color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">✏️ Editar</button>'
                  + deleteBtn
                  + '</div></div>'
                  + '<div id="edit-form-' + a.id + '" style="display:none;padding-top:10px;border-top:1px dashed var(--warm-dark);">'
                  + '<div style="display:flex;gap:10px;align-items:flex-end;">'
                  + '<div style="flex:1;">'
                  + '<label style="font-size:0.75rem;font-weight:600;color:var(--text-muted);">Nueva Contraseña</label>'
                  + '<input type="password" id="pass-' + a.id + '" placeholder="Nueva contraseña (mínimo 6 caracteres)" style="width:100%;padding:8px 10px;border:2px solid var(--warm);border-radius:6px;font-size:0.85rem;">'
                  + '</div>'
                  + '<button onclick="updatePassword(' + a.id + ')" style="padding:8px 16px;background:var(--success);color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;">💾 Guardar</button>'
                  + '</div></div></div>';
          });
          document.getElementById('admins-list').innerHTML = html;
        }
      } catch(err) { console.error('Error loading admins'); }
    }

    async function deleteAdmin(id) {
      var currentAdminId = parseInt(sessionStorage.getItem('admin_id'));
      console.log('Intentando eliminar admin id:', id, 'Mi id:', currentAdminId);
      
      if (parseInt(id) === currentAdminId) {
        showToast('No puedes eliminar tu propio usuario porque tienes la sesión activa', 'error');
        return;
      }
      if (!confirm('¿Estás seguro de que quieres eliminar este administrador?')) return;
      try {
        var res = await apiFetch(API_URL + '/api/administradores/' + id, { method: 'DELETE' });
        if (res.ok) { 
          showToast('Administrador eliminado ✅', 'success'); 
          loadAdmins(); 
        }
        else { showToast('Error al eliminar', 'error'); }
      } catch(err) { showToast('Error de conexión', 'error'); }
    }

    function toggleAdminEdit(id) {
      var form = document.getElementById('edit-form-' + id);
      var btn = document.getElementById('btn-edit-' + id);
      if (form.style.display === 'none') {
        form.style.display = 'block';
        btn.textContent = '❌ Cancelar';
      } else {
        form.style.display = 'none';
        btn.textContent = '✏️ Editar';
      }
    }

    function updatePassword(id) {
      var newPass = document.getElementById('pass-' + id).value;
      if (!newPass || newPass.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
      
      apiFetch(API_URL + '/api/administradores/' + id, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({password: newPass})
      }).then(function(res) { 
        if (res.ok) { 
          showToast('Contraseña actualizada ✅', 'success'); 
          document.getElementById('pass-' + id).value = '';
          toggleAdminEdit(id);
        }
        else showToast('Error al actualizar', 'error');
      }).catch(function() { showToast('Error de conexión', 'error'); });
    }

    async function createAdmin() {
      var user = document.getElementById('new-admin-user').value.trim();
      var pass = document.getElementById('new-admin-pass').value;
      
      if (!user) { showToast('Ingresa un nombre de usuario', 'error'); return; }
      if (!pass) { showToast('Ingresa una contraseña', 'error'); return; }
      if (pass.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
      
      try {
        var res = await apiFetch(API_URL + '/api/administradores', { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({username: user, password: pass}) 
        });
        if (res.ok) { 
          showToast('Administrador creado ✅', 'success'); 
          document.getElementById('new-admin-user').value = '';
          document.getElementById('new-admin-pass').value = '';
          loadAdmins(); 
        }
        else { var data = await res.json(); showToast(data.error || 'Error', 'error'); }
      } catch(err) { showToast('Error de conexión', 'error'); }
    }

    async function testEmail() {
      showToast('Enviando correo de prueba...', 'info');
      try {
        var res = await apiFetch(API_URL + '/api/test-email', { method: 'POST' });
        var data = await res.json();
        if (res.ok) { showToast('¡Email enviado! Revisa tu bandeja de entrada 📧', 'success'); }
        else { showToast(data.error || 'Error al enviar', 'error'); }
      } catch(err) { showToast('Error de conexión', 'error'); }
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
          showToast('Precios guardados ✅', 'success');
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

        var res = await apiFetch(API_URL + '/api/orders?all=true');
        if (!res.ok) throw new Error('Error en respuesta');
        orders = await res.json();

        var pres = await apiFetch(API_URL + '/api/products');
        if (!pres.ok) throw new Error('Error en productos');
        products = await pres.json();

        // Cargar umbral de inventario para el dashboard
        try {
          var invCfg = await apiFetch(API_URL + '/api/inventory/alerts');
          if (invCfg.ok) {
            var invCfgData = await invCfg.json();
            window._invThreshold = invCfgData.umbralMinimo || 5;
          }
        } catch(e) {}

        await loadConfig();
        populateDateFilters();
        populateDashDateFilters();
        await loadPromos();
        renderDashboard();
        updatePedidosCounters();
        renderOrders();
        renderProducts();

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
      yearSelect.innerHTML = '<option value="">Año</option>';
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
      daySelect.innerHTML = '<option value="">Día</option>';
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
      
      // Función para crear tabla de resumen
      function crearResumenMensual(monthOrders, mesNombre) {
        var wsData = [];
        
        // Título
        wsData.push([{ t: 's', v: 'ESME COOKIES - REPORTE DE VENTAS' }]);
        wsData.push([{ t: 's', v: 'Mes: ' + mesNombre }]);
        wsData.push([{ t: 's', v: 'Fecha de Generación: ' + new Date().toLocaleDateString('es-DO') }]);
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
        wsData.push(['Total Envíos:', totalEnvios, 'RD$']);
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
        
        // Por Método de Pago
        wsData.push([{ t: 's', v: 'POR MÉTODO DE PAGO' }]);
        wsData.push(['Método', 'Total', 'RD$']);
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
            var tipo = o.tipo_entrega === 'pickup' ? 'Pasar a buscar' : o.tipo_entrega === 'delivery' ? 'Delivery' : o.tipo_entrega === 'envio' ? 'Envío Nacional' : 'No especificado';
            entregas[tipo] = (entregas[tipo] || 0) + 1;
          }
        });
        for (var tipo in entregas) {
          wsData.push([tipo, entregas[tipo]]);
        }
        
        return wsData;
      }
      
      // Función para crear detalle de pedidos
      function crearDetallePedidos(monthOrders) {
        var wsData = [];
        
        // Encabezados
        wsData.push(['#', 'Fecha', 'Cliente', 'Teléfono', 'Tipo Entrega', 'Productos', 'Subtotal', 'Descuento', 'Envío', 'Total', 'Pago', 'Estado', 'Promociones']);
        
        monthOrders.forEach(function(o) {
          var promos = [];
          try {
            if (o.promociones_aplicadas) {
              promos = JSON.parse(o.promociones_aplicadas);
            }
          } catch(e) { promos = []; }
          var promosTexto = promos.map(function(p) { return p.titulo + ' (-RD$' + p.descuento + ')'; }).join('; ');
          
          var productos = (o.productos || '').replace(/\n/g, ', ');
          var tipoTxt = o.tipo_entrega === 'pickup' ? 'Pasar a buscar' : o.tipo_entrega === 'delivery' ? 'Delivery' : o.tipo_entrega === 'envio' ? 'Envío Nacional' : '';
          
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
      
      // Hoja General (si hay más de un mes)
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
      var ventas = dashOrders.reduce(function (s, o) { return s + (o.estado !== 'Cancelado' ? (parseFloat(o.total) || 0) : 0); }, 0);
      document.getElementById('stat-sales').textContent = 'RD$' + Math.round(ventas).toLocaleString();

      var nonCancelledOrders = dashOrders.filter(function (o) { return o.estado !== 'Cancelado'; });
      var ticketPromedio = nonCancelledOrders.length > 0 ? Math.round(ventas / nonCancelledOrders.length) : 0;
      if (document.getElementById('stat-avg')) document.getElementById('stat-avg').textContent = 'RD$' + ticketPromedio.toLocaleString();

      var clientesUnicos = [...new Set(nonCancelledOrders.map(function (o) { return (o.cliente || '').toLowerCase().trim(); }).filter(Boolean))].length;
      if (document.getElementById('stat-clients')) document.getElementById('stat-clients').textContent = clientesUnicos;

      var pendientes = dashOrders.filter(function (o) { return o.estado === 'Pendiente'; }).length;
      document.getElementById('stat-pending').textContent = pendientes;
      var entregados = dashOrders.filter(function (o) { return o.estado === 'Entregado'; }).length;
      document.getElementById('stat-delivered').textContent = entregados;
      var cancelados = dashOrders.filter(function (o) { return o.estado === 'Cancelado'; }).length;
      if (document.getElementById('stat-cancelled')) document.getElementById('stat-cancelled').textContent = cancelados;

      var totalUnits = dashOrders.reduce(function (s, o) { return s + (parseFloat(o.cantidad) || 0); }, 0);
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

      // Actualizar contadores globales de Pedidos (usando 'orders', no 'dashOrders')
      if (document.getElementById('stat-total-pedidos')) document.getElementById('stat-total-pedidos').textContent = orders.length;
      if (document.getElementById('stat-pendientes')) document.getElementById('stat-pendientes').textContent = orders.filter(function (o) { return o.estado === 'Pendiente'; }).length;
      if (document.getElementById('stat-confirmados')) document.getElementById('stat-confirmados').textContent = orders.filter(function (o) { return ['Confirmado', 'Preparando', 'Listo'].indexOf(o.estado) >= 0; }).length;
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
      
      // Estadísticas de Promociones
      var promosActivas = promos.filter(function(p) { return p.activa == 1; }).length;
      if (document.getElementById('stat-promos-activas')) document.getElementById('stat-promos-activas').textContent = promosActivas;
      
      var totalDescuentos = dashOrders.reduce(function(s, o) { return s + (o.descuento || 0); }, 0);
      if (document.getElementById('stat-descuentos')) document.getElementById('stat-descuentos').textContent = 'RD$' + totalDescuentos.toLocaleString();
      
      var pedidosConPromo = dashOrders.filter(function(o) { return o.promociones_aplicadas && o.promociones_aplicadas.length > 2; }).length;
      if (document.getElementById('stat-pedidos-promo')) document.getElementById('stat-pedidos-promo').textContent = pedidosConPromo;
      
      // Lista de promociones más usadas
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
        promosHtml = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No hay promociones aplicadas en este período.</p>';
      } else {
        sortedPromos.slice(0, 10).forEach(function(item) {
          promosHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--warm);">';
          promosHtml += '<span style="font-weight:600;">' + item[0] + '</span>';
          promosHtml += '<span style="background:var(--accent); color:white; padding:4px 12px; border-radius:20px; font-size:0.85rem; font-weight:700;">' + item[1] + ' usado(s)</span>';
          promosHtml += '</div>';
        });
      }
      if (document.getElementById('promos-usage-list')) document.getElementById('promos-usage-list').innerHTML = promosHtml;

      // Alertas de inventario (usa el stock actual y el umbral configurable)
      renderDashboardInventory();

      // Generar Reporte Contable
      renderAccountingReport(dashOrders);
    }

    function renderAccountingReport(dashOrders) {
      var totalPedidos = dashOrders.length;
      var pedidosCancelados = dashOrders.filter(function(o) { return o.estado === 'Cancelado'; }).length;
      var pedidosExitosos = totalPedidos - pedidosCancelados;
      
      var subtotalTotal = dashOrders.reduce(function(s, o) { return s + (o.estado !== 'Cancelado' ? (parseFloat(o.subtotal) || 0) : 0); }, 0);
      var descuentosTotal = dashOrders.reduce(function(s, o) { return s + (o.estado !== 'Cancelado' ? (parseFloat(o.descuento) || 0) : 0); }, 0);
      var envioTotal = dashOrders.reduce(function(s, o) { return s + (o.estado !== 'Cancelado' ? (parseFloat(o.envio) || 0) : 0); }, 0);
      var ventasNetas = dashOrders.reduce(function(s, o) { return s + (o.estado !== 'Cancelado' ? (parseFloat(o.total) || 0) : 0); }, 0);
      
      var porTipo = { pickup: 0, delivery: 0, envio: 0 };
      var porEstado = { Pendiente: 0, 'Esperando Pago': 0, Confirmado: 0, Preparando: 0, Listo: 0, Entregado: 0, Cancelado: 0 };
      
      dashOrders.forEach(function(o) {
        if (porTipo[o.tipo_entrega] !== undefined) porTipo[o.tipo_entrega]++;
        if (porEstado[o.estado] !== undefined) porEstado[o.estado]++;
      });
      
      var html = '';
      
      // Resumen General
      html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:15px;">';
      html += '<div style="background:linear-gradient(135deg, #2C1810 0%, #4a3728 100%); padding:20px; border-radius:12px; color:white;">';
      html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Ventas Netas</div>';
      html += '<div style="font-size:1.8rem; font-weight:700;">RD$ ' + Math.round(ventasNetas).toLocaleString() + '</div>';
      html += '</div>';
      
      html += '<div style="background:linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); padding:20px; border-radius:12px; color:white;">';
      html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Pedidos Exitosos</div>';
      html += '<div style="font-size:1.8rem; font-weight:700;">' + pedidosExitosos + '</div>';
      html += '</div>';
      
      html += '<div style="background:linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding:20px; border-radius:12px; color:white;">';
      html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Pedidos Cancelados</div>';
      html += '<div style="font-size:1.8rem; font-weight:700;">' + pedidosCancelados + '</div>';
      html += '</div>';
      
      html += '</div>';
      
      // Estado de Resultados
      html += '<div style="background:white; padding:20px; border-radius:12px; border:2px solid var(--warm);">';
      html += '<h4 style="margin:0 0 15px 0; color:var(--primary); font-size:1rem;">📋 Estado de Resultados</h4>';
      html += '<table style="width:100%; border-collapse:collapse; font-size:0.9rem;">';
      html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">Ventas Brutas (Subtotal)</td><td style="text-align:right; font-weight:600;">RD$ ' + Math.round(subtotalTotal).toLocaleString() + '</td></tr>';
      html += '<tr style="border-bottom:1px solid #eee; color:#e74c3c;"><td style="padding:8px 0;">(-) Descuentos Otorgados</td><td style="text-align:right; font-weight:600;">-RD$ ' + Math.round(descuentosTotal).toLocaleString() + '</td></tr>';
      html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">(+) Ingresos por Envío</td><td style="text-align:right; font-weight:600;">RD$ ' + Math.round(envioTotal).toLocaleString() + '</td></tr>';
      html += '<tr style="background:var(--cream); font-weight:700;"><td style="padding:12px 0;">= Ventas Netas</td><td style="text-align:right; font-size:1.1rem; color:var(--primary);">RD$ ' + Math.round(ventasNetas).toLocaleString() + '</td></tr>';
      html += '</table>';
      html += '</div>';
      
      // Por Tipo de Entrega
      html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:15px;">';
      html += '<div style="background:var(--cream); padding:16px; border-radius:10px; text-align:center;">';
      html += '<div style="font-size:2rem;">🏪</div>';
      html += '<div style="font-size:1.5rem; font-weight:700; color:var(--primary);">' + porTipo.pickup + '</div>';
      html += '<div style="font-size:0.8rem; color:var(--text-muted);">Pasar a Buscar</div>';
      html += '</div>';
      html += '<div style="background:var(--cream); padding:16px; border-radius:10px; text-align:center;">';
      html += '<div style="font-size:2rem;">🚚</div>';
      html += '<div style="font-size:1.5rem; font-weight:700; color:var(--primary);">' + porTipo.delivery + '</div>';
      html += '<div style="font-size:0.8rem; color:var(--text-muted);">Delivery</div>';
      html += '</div>';
      html += '<div style="background:var(--cream); padding:16px; border-radius:10px; text-align:center;">';
      html += '<div style="font-size:2rem;">📮</div>';
      html += '<div style="font-size:1.5rem; font-weight:700; color:var(--primary);">' + porTipo.envio + '</div>';
      html += '<div style="font-size:0.8rem; color:var(--text-muted);">Envíos</div>';
      html += '</div>';
      html += '</div>';
      
      // Por Estado
      html += '<div style="background:white; padding:20px; border-radius:12px; border:2px solid var(--warm);">';
      html += '<h4 style="margin:0 0 15px 0; color:var(--primary); font-size:1rem;">📊 Distribución por Estado</h4>';
      html += '<div style="display:flex; flex-wrap:wrap; gap:10px;">';
      for (var estado in porEstado) {
        var color = '#95a5a6';
        if (estado === 'Pendiente') color = '#f39c12';
        else if (estado === 'Esperando Pago') color = '#9b59b6';
        else if (estado === 'Confirmado') color = '#3498db';
        else if (estado === 'Preparando') color = '#0369A1';
        else if (estado === 'Listo') color = '#15803D';
        else if (estado === 'Entregado') color = '#27ae60';
        else if (estado === 'Cancelado') color = '#e74c3c';
        
        html += '<div style="background:' + color + '; color:white; padding:8px 16px; border-radius:20px; font-weight:600;">' + estado + ': ' + porEstado[estado] + '</div>';
      }
      html += '</div>';
      html += '</div>';
      
      // Botón exportar
      html += '<div style="text-align:center; margin-top:10px;">';
      html += '<button onclick="exportAccountingReport()" style="padding:12px 24px; background:var(--accent); color:white; border:none; border-radius:10px; font-weight:600; cursor:pointer; font-size:1rem;">📥 Exportar Reporte Contable</button>';
      html += '</div>';
      
      document.getElementById('accounting-report').innerHTML = html;
    }

    function exportAccountingReport() {
      var year = (document.getElementById('dash-filter-year') || {}).value;
      var month = (document.getElementById('dash-filter-month') || {}).value;
      var day = (document.getElementById('dash-filter-day') || {}).value;
      
      var periodo = 'Período: ';
      if (year) periodo += year;
      if (month) periodo += '-' + month;
      if (day) periodo += '-' + day;
      if (!year && !month && !day) periodo = 'Período: Todos';
      
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
      
      var totalPedidos = dashOrders.length;
      var pedidosCancelados = dashOrders.filter(function(o) { return o.estado === 'Cancelado'; }).length;
      var pedidosExitosos = totalPedidos - pedidosCancelados;
      var subtotalTotal = dashOrders.reduce(function(s, o) { return s + (o.estado !== 'Cancelado' ? (parseFloat(o.subtotal) || 0) : 0); }, 0);
      var descuentosTotal = dashOrders.reduce(function(s, o) { return s + (o.estado !== 'Cancelado' ? (parseFloat(o.descuento) || 0) : 0); }, 0);
      var envioTotal = dashOrders.reduce(function(s, o) { return s + (o.estado !== 'Cancelado' ? (parseFloat(o.envio) || 0) : 0); }, 0);
      var ventasNetas = dashOrders.reduce(function(s, o) { return s + (o.estado !== 'Cancelado' ? (parseFloat(o.total) || 0) : 0); }, 0);
      
      var csv = 'ESME COOKIES - REPORTE CONTABLE\n';
      csv += periodo + '\n\n';
      csv += 'RESUMEN GENERAL\n';
      csv += 'Total Pedidos,' + totalPedidos + '\n';
      csv += 'Pedidos Exitosos,' + pedidosExitosos + '\n';
      csv += 'Pedidos Cancelados,' + pedidosCancelados + '\n';
      csv += 'Ventas Netas,RD$' + ventasNetas + '\n\n';
      csv += 'ESTADO DE RESULTADOS\n';
      csv += 'Ventas Brutas (Subtotal),RD$' + subtotalTotal + '\n';
      csv += 'Descuentos Otorgados,-RD$' + descuentosTotal + '\n';
      csv += 'Ingresos por Envío,RD$' + envioTotal + '\n';
      csv += 'VENTAS NETAS,RD$' + ventasNetas + '\n\n';
      csv += 'DETALLE DE PEDIDOS\n';
      csv += '#,Fecha,Cliente,Estado,Subtotal,Descuento,Envio,Total\n';
      dashOrders.forEach(function(o) {
        csv += o.numero + ',' + (o.fecha || '') + ',' + '"' + (o.cliente || '') + '",' + (o.estado || '') + ',' + (o.subtotal || 0) + ',' + (o.descuento || 0) + ',' + (o.envio || 0) + ',' + (o.total || 0) + '\n';
      });
      
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'reporte_contable_' + new Date().toISOString().split('T')[0] + '.csv';
      link.click();
      
      showToast('Reporte contable exportado', 'success');
    }

    var ordersPage = 1;
    var ordersPerPage = 50;

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
      }).sort(function(a, b) {
        return b.numero - a.numero;
      });

      filtered.sort(function (a, b) { return b.numero - a.numero; });

      var container = document.getElementById('orders-container');

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty"><div class="icon">📋</div><h3>No hay pedidos</h3></div>';
        return;
      }

      var totalPages = Math.ceil(filtered.length / ordersPerPage);
      if (ordersPage > totalPages) ordersPage = totalPages;
      if (ordersPage < 1) ordersPage = 1;
      var start = (ordersPage - 1) * ordersPerPage;
      var pageOrders = filtered.slice(start, start + ordersPerPage);

      var html = '<table><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Entrega</th><th>Estado</th><th>Subtotal</th><th>Descuento</th><th>Total</th><th>Acciones</th></tr></thead><tbody>';
      pageOrders.forEach(function (o) {
        var badgeClass = getStateColor(o.estado);
        var tipoEntrega = o.tipo_entrega === 'pickup' ? 'Pasar' : o.tipo_entrega === 'delivery' ? 'Delivery' : o.tipo_entrega === 'envio' ? 'Envio' : '-';
        var nextState = getNextState(o.estado);
        
        var btnLabel = '';
        var btnBg = '#6c757d';
        if (nextState) {
          switch(nextState) {
            case 'Esperando Pago': btnLabel = 'Enviar Pago'; btnBg = '#D9A036'; break;
            case 'Confirmado': btnLabel = 'Confirmar Pago'; btnBg = '#28A745'; break;
            case 'Preparando': btnLabel = 'Preparar'; btnBg = '#0369A1'; break;
            case 'Listo': btnLabel = 'Marcar Listo'; btnBg = '#15803D'; break;
            case 'Entregado': btnLabel = 'Entregar'; btnBg = '#6f42c1'; break;
            default: btnLabel = nextState; btnBg = '#6c757d';
          }
        } else {
          btnLabel = o.estado === 'Cancelado' ? 'Cancelado' : 'Completado';
          btnBg = '#6c757d';
        }
        
        var descuentoHtml = '';
        if (o.descuento && o.descuento > 0) {
          var promos = [];
          try { promos = JSON.parse(o.promociones_aplicadas || '[]'); } catch(e) {}
          var promoNames = promos.map(function(p) { return p.titulo; }).join(', ');
          descuentoHtml = '<span style="color:#28a745;font-size:0.8rem;" title="' + promoNames + '">-' + (o.descuento || 0).toLocaleString() + '</span>';
        } else {
          descuentoHtml = '<span style="color:#999;">-</span>';
        }
        
        html += '<tr onclick="openEditModal(' + o.numero + ')" style="cursor:pointer"><td><span class="order-num">#' + String(o.numero).padStart(4, '0') + '</span></td><td>' + (o.fecha || '-') + '</td><td><strong>' + (o.cliente || '-') + '</strong><br><small style="color:var(--text-muted)">' + (o.telefono || '-') + '</small></td><td><span style="font-size:0.85rem">' + tipoEntrega + '</span></td><td><span class="badge badge-' + badgeClass + '">' + (o.estado || 'Pendiente') + '</span></td><td style="text-align:right;"><span style="font-size:0.85rem;color:#666;">' + (o.subtotal || 0).toLocaleString() + '</span></td><td style="text-align:right;">' + descuentoHtml + '</td><td style="text-align:right;"><strong>RD$ ' + (o.total || 0).toLocaleString() + '</strong></td><td onclick="event.stopPropagation()"><div class="actions"><button class="action-btn" onclick="sendConfirmation(' + o.numero + ')" style="background:' + btnBg + ';color:white;padding:6px 12px;border-radius:6px;font-weight:600;">' + btnLabel + '</button><button class="action-btn edit" onclick="openEditModal(' + o.numero + ')">Editar</button></div></td></tr>';
      });
      html += '</tbody></table>';

      if (totalPages > 1) {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;font-size:0.85rem;">';
        html += '<span style="color:var(--text-muted)">Mostrando ' + (start + 1) + '-' + Math.min(start + ordersPerPage, filtered.length) + ' de ' + filtered.length + ' pedidos</span>';
        html += '<div style="display:flex;gap:8px;align-items:center;">';
        html += '<button onclick="ordersPage=' + Math.max(1, ordersPage - 1) + ';renderOrders();" style="padding:6px 14px;background:var(--warm);border:none;border-radius:6px;cursor:pointer;font-weight:600;' + (ordersPage <= 1 ? 'opacity:0.4;pointer-events:none;' : '') + '">◀ Anterior</button>';
        html += '<span style="font-weight:600;color:var(--primary);">Pág ' + ordersPage + ' de ' + totalPages + '</span>';
        html += '<button onclick="ordersPage=' + Math.min(totalPages, ordersPage + 1) + ';renderOrders();" style="padding:6px 14px;background:var(--warm);border:none;border-radius:6px;cursor:pointer;font-weight:600;' + (ordersPage >= totalPages ? 'opacity:0.4;pointer-events:none;' : '') + '">Siguiente ▶</button>';
        html += '</div></div>';
      } else {
        html += '<div style="padding:10px 0;font-size:0.85rem;color:var(--text-muted);text-align:center;">' + filtered.length + ' pedido' + (filtered.length !== 1 ? 's' : '') + '</div>';
      }

      container.innerHTML = html;
    }

    function filterOrders() {
      ordersPage = 1;
      renderOrders();
    }

    function clearFilters() {
      document.getElementById('search').value = '';
      document.getElementById('filter-status').value = '';
      document.getElementById('filter-entrega').value = '';
      document.getElementById('filter-year').value = '';
      document.getElementById('filter-month').value = '';
      document.getElementById('filter-day').value = '';
      updateDayFilter();
      ordersPage = 1;
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
        var placeholderHtml = '<div class="product-image-placeholder" style="' + (imageUrl ? 'display:none;' : '') + '">🍪</div>';
        var stockHtml = '';
        if (p.stock !== null && p.stock !== undefined) {
          if (p.stock <= 0) {
            stockHtml = '<div style="padding:4px 12px;font-weight:700;color:#c0392b;">⛔ Agotado</div>';
          } else if (p.stock <= 5) {
            stockHtml = '<div style="padding:4px 12px;font-weight:700;color:#e67e22;">⚠️ Stock: ' + p.stock + '</div>';
          } else {
            stockHtml = '<div style="padding:4px 12px;font-weight:600;color:#27ae60;">📦 Stock: ' + p.stock + '</div>';
          }
        }
        var tipoBadge = '';
        if (p.tipo === 'caja') {
          var bc = p.box_config;
          if (bc && typeof bc === 'string') { try { bc = JSON.parse(bc); } catch(e) { bc = null; } }
          var sizesStr = bc && bc.sizes ? bc.sizes.join(', ') : '6, 12, 24';
          tipoBadge = '<div style="font-size:0.75rem;background:#e8f5e9;color:#2e7d32;padding:3px 10px;border-radius:20px;font-weight:600;margin:4px 0 0;">🎁 Caja (' + sizesStr + ')</div>';
        }
        html += '<div class="product-card">'
          + imageHtml + placeholderHtml
          + '<div class="product-header">'
          + '<h3>' + p.nombre + '</h3>'
          + '<div class="product-price">RD$ ' + p.precio.toLocaleString() + '</div>'
          + tipoBadge
          + '</div>'
          + stockHtml
          + '<div class="product-body"><p class="product-desc">' + (p.descripcion || 'Sin descripcion') + '</p><div class="product-actions"><button class="btn-edit" onclick="editProduct(' + p.id + ')">Editar</button><button class="btn-delete" onclick="confirmDeleteProduct(' + p.id + ')">Eliminar</button></div></div>'
          + '</div>';
      });
      html += '<div class="add-product-card" onclick="openProductModal()"><div class="icon">+</div><span>Agregar</span></div>';
      grid.innerHTML = html;
    }

    function showTab(tab) {
      // Limpiar búsquedas al cambiar de tab
      var searchInputs = ['search', 'cliente-search'];
      searchInputs.forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.value) {
          el.value = '';
        }
      });

      document.querySelectorAll('[id^="tab-"]').forEach(function (el) { el.classList.add('hidden'); });
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      document.getElementById('tab-' + tab).classList.remove('hidden');
      
      var tabs = ['dashboard', 'pedidos', 'productos', 'inventario', 'preparacion', 'promociones', 'clientes', 'config'];
      var tabIndex = tabs.indexOf(tab);
      if (tabIndex >= 0) {
        var tabBtn = document.querySelectorAll('.tab')[tabIndex];
        tabBtn.classList.add('active');
        tabBtn.classList.remove('pulse'); // Quitar efecto de nuevo pedido al entrar
      }
      if (tab === 'pedidos') {
        ordersPage = 1;
        populateDateFilters();
        updatePedidosCounters();
        renderOrders();
      }
      if (tab === 'inventario') renderInventario();
      if (tab === 'preparacion') renderPreparacion();
      if (tab === 'promociones') loadPromos();
      if (tab === 'clientes') { clientesPage = 1; loadClientes(); }
      if (tab === 'config') { loadConfig(); loadBoxConfig(); }
    }

    function updatePedidosCounters() {
      if (document.getElementById('stat-total-pedidos')) document.getElementById('stat-total-pedidos').textContent = orders.length;
      if (document.getElementById('stat-pendientes')) document.getElementById('stat-pendientes').textContent = orders.filter(function (o) { return o.estado === 'Pendiente'; }).length;
      if (document.getElementById('stat-confirmados')) document.getElementById('stat-confirmados').textContent = orders.filter(function (o) { return ['Confirmado', 'Preparando', 'Listo'].indexOf(o.estado) >= 0; }).length;
      if (document.getElementById('stat-entregados')) document.getElementById('stat-entregados').textContent = orders.filter(function (o) { return o.estado === 'Entregado'; }).length;
    }

    function openEditModal(numero) {
      editingOrder = orders.find(function (o) { return o.numero === numero; });
      if (!editingOrder) return;
      document.getElementById('edit-num').textContent = String(numero).padStart(4, '0');

      var tipoTexto = editingOrder.tipo_entrega === 'pickup' ? 'Pasar a buscar' : editingOrder.tipo_entrega === 'delivery' ? 'Delivery' : editingOrder.tipo_entrega === 'envio' ? 'Envio' : 'No especificado';
      var badgeClass = getStateColor(editingOrder.estado);
      var nextState = getNextState(editingOrder.estado);

      var promosHtml = '';
      if (editingOrder.promociones_aplicadas) {
        try {
          var promos = JSON.parse(editingOrder.promociones_aplicadas);
          if (Array.isArray(promos) && promos.length > 0) {
            promosHtml = '<div style="background:#d4edda;padding:12px;border-radius:8px;margin:10px 0;"><div style="font-weight:700;color:#155724;margin-bottom:8px;">🎉 Promociones Aplicadas:</div>';
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

      var totalesHtml = '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--warm);"><span style="color:var(--text-muted);">Subtotal:</span><span>RD$ ' + (editingOrder.subtotal || 0).toLocaleString() + '</span></div>';
      if (editingOrder.descuento && editingOrder.descuento > 0) {
        totalesHtml += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--warm);color:#28a745;"><span>🎉 Descuento:</span><span>-RD$ ' + (editingOrder.descuento || 0).toLocaleString() + '</span></div>';
      }
      totalesHtml += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--warm);"><span style="color:var(--text-muted);">Envío:</span><span>RD$ ' + (editingOrder.envio || 0).toLocaleString() + '</span></div>';
      totalesHtml += '<div style="display:flex;justify-content:space-between;padding:10px 0 0;font-size:1.3rem;font-weight:700;color:var(--accent);"><span>TOTAL:</span><span>RD$ ' + (editingOrder.total || 0).toLocaleString() + '</span></div>';
      
      // Botón de acción según estado
      var actionBtnHtml = '';
      if (nextState) {
        var btnColor = '#6c757d';
        switch(nextState) {
          case 'Esperando Pago': btnColor = '#D9A036'; break;
          case 'Confirmado': btnColor = '#28A745'; break;
          case 'Preparando': btnColor = '#0369A1'; break;
          case 'Listo': btnColor = '#15803D'; break;
          case 'Entregado': btnColor = '#6f42c1'; break;
        }
        actionBtnHtml = '<button onclick="sendConfirmation(' + numero + ')" style="background:' + btnColor + ';color:white;padding:10px 20px;border:none;border-radius:8px;font-size:0.95rem;font-weight:600;cursor:pointer;">' + getStateIcon(nextState) + ' ' + nextState + '</button>';
      } else {
        actionBtnHtml = '<span style="background:#e0e0e0;padding:10px 20px;border-radius:8px;color:#666;font-weight:600;">' + getStateIcon(editingOrder.estado) + ' ' + (editingOrder.estado === 'Cancelado' ? 'Pedido Cancelado' : 'Pedido Completado') + '</span>';
      }

      var detallesHtml = '';

      // Encabezado: estado + acción
      detallesHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid var(--warm);">';
      detallesHtml += '<div><span class="badge badge-' + badgeClass + '" style="font-size:1.2rem;padding:12px 24px;border-radius:12px;">' + getStateIcon(editingOrder.estado) + ' ' + editingOrder.estado + '</span>';
      if (editingOrder.observaciones) {
        detallesHtml += '<div style="margin-top:8px;font-size:0.85rem;color:var(--text-muted);max-width:300px;line-height:1.4;">📌 ' + editingOrder.observaciones + '</div>';
      }
      detallesHtml += '</div>';
      detallesHtml += '<div style="display:flex;gap:10px;align-items:center;">' + actionBtnHtml + '</div>';
      detallesHtml += '</div>';

      // Info del pedido en cards
      detallesHtml += '<div style="margin-bottom:24px;">';
      detallesHtml += '<h4 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px;">📋 Información del pedido</h4>';
      detallesHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
      detallesHtml += '<div style="background:white;padding:14px 16px;border-radius:10px;border:1px solid var(--warm);"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">📅 Fecha</div><div style="font-weight:600;font-size:1rem;">' + (editingOrder.fecha || '-') + '</div></div>';
      detallesHtml += '<div style="background:white;padding:14px 16px;border-radius:10px;border:1px solid var(--warm);"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">👤 Cliente</div><div style="font-weight:600;font-size:1rem;">' + (editingOrder.cliente || '-') + '</div></div>';
      detallesHtml += '<div style="background:white;padding:14px 16px;border-radius:10px;border:1px solid var(--warm);"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">📱 Teléfono</div><div style="font-weight:600;font-size:1rem;">' + (editingOrder.telefono || '-') + '</div></div>';
      detallesHtml += '<div style="background:white;padding:14px 16px;border-radius:10px;border:1px solid var(--warm);"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">🚚 Entrega</div><div style="font-weight:600;font-size:1rem;">' + tipoTexto + '</div></div>';
      if (editingOrder.direccion) {
        detallesHtml += '<div style="background:white;padding:14px 16px;border-radius:10px;border:1px solid var(--warm);grid-column:1/-1;"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">📍 Dirección</div><div style="font-weight:600;font-size:1rem;">' + editingOrder.direccion + '</div></div>';
      }
      if (editingOrder.nota) {
        detallesHtml += '<div style="background:white;padding:14px 16px;border-radius:10px;border:1px solid var(--warm);grid-column:1/-1;"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">📝 Nota del cliente</div><div style="font-weight:600;font-size:1rem;">' + editingOrder.nota + '</div></div>';
      }
      detallesHtml += '</div></div>';

      // Productos
      detallesHtml += '<div style="margin-bottom:24px;">';
      detallesHtml += '<h4 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px;">🍪 Productos</h4>';
      var prodItems = (editingOrder.productos || '').split(',').map(function(p) { return p.trim(); }).filter(Boolean);
      detallesHtml += '<div style="background:white;border:1px solid var(--warm);border-radius:12px;overflow:hidden;">';
      prodItems.forEach(function(p, i) {
        detallesHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;' + (i < prodItems.length - 1 ? 'border-bottom:1px solid var(--warm);' : '') + '"><span style="font-weight:500;">🍪 ' + p + '</span></div>';
      });
      detallesHtml += '</div></div>';

      // Promociones
      if (promosHtml) {
        detallesHtml += '<div style="margin-bottom:24px;">';
        detallesHtml += '<h4 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px;">🎉 Promociones</h4>';
        detallesHtml += promosHtml;
        detallesHtml += '</div>';
      }

      // Pago y Totales
      detallesHtml += '<div style="margin-bottom:24px;">';
      detallesHtml += '<h4 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px;">💳 Pago</h4>';
      detallesHtml += '<div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;">';
      detallesHtml += '<div style="background:white;padding:14px 16px;border-radius:10px;border:1px solid var(--warm);"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Método</div><div style="font-weight:600;font-size:1rem;">' + (editingOrder.pago || 'Por definir') + '</div></div>';
      detallesHtml += '<div style="background:white;padding:16px 20px;border-radius:10px;border:1px solid var(--warm);">' + totalesHtml + '</div>';
      detallesHtml += '</div></div>';

      // Historial de cambios de estado (a partir de estado_timestamps)
      var ts = editingOrder.estado_timestamps || {};
      var eventos = Object.keys(ts)
        .filter(function (k) { return k !== 'anterior' && ts[k]; })
        .map(function (k) { return { estado: k, time: ts[k] }; })
        .sort(function (a, b) { return new Date(a.time) - new Date(b.time); });
      if (eventos.length > 0) {
        detallesHtml += '<div style="margin-bottom:24px;">';
        detallesHtml += '<h4 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px;">🕒 Historial de estados</h4>';
        detallesHtml += '<div style="background:white;border:1px solid var(--warm);border-radius:12px;overflow:hidden;">';
        eventos.forEach(function (ev, i) {
          var d = new Date(ev.time);
          var fecha = isNaN(d.getTime()) ? '' : d.toLocaleString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
          detallesHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;' + (i < eventos.length - 1 ? 'border-bottom:1px solid var(--warm);' : '') + '">';
          detallesHtml += '<span style="font-weight:600;">' + getStateIcon(ev.estado) + ' ' + ev.estado + '</span>';
          detallesHtml += '<span style="font-size:0.85rem;color:var(--text-muted);">' + fecha + '</span>';
          detallesHtml += '</div>';
        });
        detallesHtml += '</div></div>';
      }

      document.getElementById('modal-detalles').innerHTML = detallesHtml;

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
      var currentOrder = editingOrder;
      document.getElementById('edit-modal').classList.remove('open');
      document.getElementById('edit-modal-form').style.display = 'flex';
      setTimeout(function() { 
        editingOrder = currentOrder; 
      }, 100);
    }

    function closeEditForm() {
      document.getElementById('edit-modal-form').style.display = 'none';
    }

    async function saveOrder() {
      if (!editingOrder) { 
        showToast('No hay pedido para guardar', 'error'); 
        return; 
      }
      
      var data = {
        cliente: document.getElementById('edit-cliente').value.trim(),
        telefono: document.getElementById('edit-telefono').value.trim(),
        productos: document.getElementById('edit-productos').value.trim(),
        total: parseFloat(document.getElementById('edit-total').value) || 0,
        estado: document.getElementById('edit-estado').value,
        estado_timestamp: new Date().toISOString()
      };

      try {
        var orderNum = String(editingOrder.numero);
        var res = await apiFetch(API_URL + '/api/orders/' + orderNum, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (res.ok) {
          closeEditForm();
          closeModal();
          loadData();
          showToast('Pedido actualizado', 'success');
        } else {
          var error = await res.json();
          showToast('Error: ' + (error.error || 'Error al guardar'), 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      }
    }

    async function cancelOrder() {
      if (!editingOrder) return;
      if (!confirm('Cancelar pedido #' + String(editingOrder.numero).padStart(4, '0') + '?')) return;
      try {
        var res = await apiFetch(API_URL + '/api/orders/' + editingOrder.numero, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hardDelete: false })
        });
        if (res.ok) {
          closeModal();
          loadData();
          showToast('Pedido cancelado', 'success');
        }
      } catch (err) {
        showToast('Error', 'error');
      }
    }

    async function deleteOrder() {
      if (!editingOrder) return;
      if (!confirm('ELIMINAR PERMANENTEMENTE el pedido #' + String(editingOrder.numero).padStart(4, '0') + '?\n\nEsta acción NO se puede deshacer.')) return;
      try {
        var res = await apiFetch(API_URL + '/api/orders/' + editingOrder.numero, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hardDelete: true })
        });
        if (res.ok) {
          closeModal();
          loadData();
          showToast('Pedido eliminado permanentemente', 'success');
        }
      } catch (err) {
        showToast('Error', 'error');
      }
    }

    function confirmDelete(numero) {
      editingOrder = orders.find(function (o) { return o.numero === numero; });
      if (!editingOrder) return;
      document.getElementById('confirm-title').textContent = 'Cancelar pedido?';
      document.getElementById('confirm-message').textContent = 'Cancelar #' + String(numero).padStart(4, '0') + '?';
      document.getElementById('confirm-btn').onclick = function () {
        apiFetch(API_URL + '/api/orders/' + numero, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hardDelete: false })
        })
          .then(function (r) {
            if (r.ok) { closeConfirm(); loadData(); showToast('Pedido cancelado', 'success'); }
            else { r.json().then(function(d) { showToast(d.error || 'Error al cancelar', 'error'); }).catch(function() { showToast('Error al cancelar', 'error'); }); }
          })
          .catch(function() { showToast('Error de conexión', 'error'); });
      };
      document.getElementById('confirm-overlay').classList.add('open');
    }

    function confirmDeleteProduct(id) {
      editingProduct = id;
      var p = products.find(function (prod) { return prod.id === id; });
      if (p && p.tipo === 'caja') {
        showToast('No puedes eliminar una Caja Personalizada', 'error');
        return;
      }
      document.getElementById('confirm-title').textContent = 'Eliminar producto?';
      document.getElementById('confirm-message').textContent = 'Eliminar este producto?';
      document.getElementById('confirm-btn').onclick = function () {
        apiFetch(API_URL + '/api/products/' + id, { method: 'DELETE' })
          .then(function (r) {
            if (r.ok) { closeConfirm(); loadData(); showToast('Eliminado', 'success'); }
            else { r.json().then(function(d) { showToast(d.error || 'Error al eliminar', 'error'); }).catch(function() { showToast('Error al eliminar', 'error'); }); }
          })
          .catch(function() { showToast('Error de conexión', 'error'); });
      };
      document.getElementById('confirm-overlay').classList.add('open');
    }

    function closeConfirm() {
      document.getElementById('confirm-overlay').classList.remove('open');
    }

    function sendWhatsApp(numero) {
      var order = orders.find(function (o) { return o.numero === numero; });
      if (!order || !order.telefono) { showToast('Sin telefono', 'error'); return; }
      
      var msg;
      if (order.estado === 'Pendiente') {
        // Si esta pendiente, enviar mensaje de espera de pago
        msg = getConfirmationMessage(order, 'Esperando Pago');
      } else if (order.estado === 'Esperando Pago') {
        // Recordatorio de pago
        msg = getConfirmationMessage(order, 'Esperando Pago');
      } else {
        // Mensaje general de estado
        msg = getConfirmationMessage(order, order.estado);
      }
      
      window.open('https://wa.me/' + order.telefono.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg), '_blank');
    }

    var ORDER_STATES = {
      Pendiente: { next: 'Esperando Pago', icon: '📋', color: 'warning' },
      'Esperando Pago': { next: 'Confirmado', icon: '💳', color: 'waiting' },
      Confirmado: { next: 'Preparando', icon: '✅', color: 'confirmed' },
      Preparando: { next: 'Listo', icon: '🍪', color: 'preparing' },
      Listo: { next: 'Entregado', icon: '📦', color: 'ready' },
      Entregado: { next: null, icon: '🎉', color: 'delivered' },
      Cancelado: { next: null, icon: '❌', color: 'cancelled' }
    };

    function getNextState(current) {
      return ORDER_STATES[current] ? ORDER_STATES[current].next : null;
    }
    
    function getStateIcon(estado) {
      return ORDER_STATES[estado] ? ORDER_STATES[estado].icon : '📋';
    }
    
    function getStateColor(estado) {
      return ORDER_STATES[estado] ? ORDER_STATES[estado].color : 'pending';
    }

    function getConfirmationMessage(order, nuevoEstado) {
      var tipoEntrega = order.tipo_entrega || 'pickup';
      var tipoTexto = tipoEntrega === 'pickup' ? 'Pasar a buscar' : tipoEntrega === 'delivery' ? 'Delivery' : tipoEntrega === 'envio' ? 'Envío Nacional' : 'No especificado';
      
      var prods = (order.productos || '').replace(/,/g, '\n');
      
      // Obtener cuentas bancarias
      var bankAccountsList = [];
      try {
        var cuentas = typeof currentConfig.bankAccounts === 'string' ? JSON.parse(currentConfig.bankAccounts || '[]') : (currentConfig.bankAccounts || []);
        if (cuentas && cuentas.length > 0) {
          bankAccountsList = cuentas;
        }
      } catch(e) {}
      
      // Función para reemplazar variables en plantilla
      function replaceVars(template, vars) {
        var result = template || '';
        Object.keys(vars).forEach(function(key) {
          result = result.split('{{' + key + '}}').join(vars[key] || '');
        });
        return result;
      }
      
      // Preparar cuentas bancarias
      var cuentasBancariasMsg = '';
      if (bankAccountsList.length > 0) {
        // Verificar si todas las cédulas son iguales
        var cedulas = bankAccountsList.map(function(c) { return (c.cedula || '').trim(); }).filter(Boolean);
        var todasIguales = cedulas.length > 1 && cedulas.every(function(c) { return c === cedulas[0]; });
        var cedulaUnica = todasIguales ? cedulas[0] : '';

        if (cedulaUnica) {
          cuentasBancariasMsg += '\n📌 Cédula: ' + cedulaUnica;
        }

        bankAccountsList.forEach(function(c, i) {
          cuentasBancariasMsg += '\n\n🏦 Cuenta ' + (i + 1) + ':';
          cuentasBancariasMsg += '\n' + c.banco;
          cuentasBancariasMsg += '\n' + c.tipo + ': ' + c.numero;
          cuentasBancariasMsg += '\n👤 ' + c.titular;
          if (!cedulaUnica && c.cedula) {
            cuentasBancariasMsg += '\n📌 Cédula: ' + c.cedula;
          }
        });
      }
      
      // Preparar variables
      var vars = {
        cliente: order.cliente || '',
        numero: String(order.numero).padStart(4, '0'),
        total: (order.total || 0).toLocaleString(),
        productos: prods,
        tipo_entrega: tipoTexto,
        subtotal: (order.subtotal || 0).toLocaleString(),
        descuento: (order.descuento || 0).toLocaleString(),
        envio: (order.envio || 0).toLocaleString(),
        pickup_direccion: currentConfig.pickupAddress || 'consultar dirección',
        cuentas_bancarias: cuentasBancariasMsg
      };
      
      // Usar plantilla personalizada o predeterminada
      var templateKey = '';
      switch(nuevoEstado) {
        case 'Esperando Pago': templateKey = 'msgEsperandoPago'; break;
        case 'Confirmado': templateKey = 'msgPagoConfirmado'; break;
        case 'Preparando': templateKey = 'msgPreparando'; break;
        case 'Listo': templateKey = 'msgListo'; break;
        case 'Entregado': templateKey = 'msgEntregado'; break;
        case 'Cancelado': templateKey = 'msgCancelado'; break;
      }
      
      console.log('Template key:', templateKey, 'currentConfig:', currentConfig[templateKey]);
      
      var customTemplate = currentConfig[templateKey];
      if (customTemplate) {
        return replaceVars(customTemplate, vars);
      }
      
      // Mensajes predeterminados si no hay plantilla personalizada
      if (nuevoEstado === 'Esperando Pago') {
        var descuentoMsg = order.descuento > 0 ? '\n🎉 Descuento: -RD$ ' + (order.descuento || 0).toLocaleString() : '';
        var bankMsg = '';
        if (bankAccountsList.length > 0) {
          // Verificar si todas las cédulas son iguales
          var cedulas = bankAccountsList.map(function(c) { return (c.cedula || '').trim(); }).filter(Boolean);
          var todasIguales = cedulas.length > 1 && cedulas.every(function(c) { return c === cedulas[0]; });
          var cedulaUnica = todasIguales ? cedulas[0] : '';

          bankMsg = '\n\n*💳 CUENTAS PARA TRANSFERENCIA:*';
          if (cedulaUnica) {
            bankMsg += '\n📌 Cédula: ' + cedulaUnica;
          }
          bankAccountsList.forEach(function(c, i) {
            bankMsg += '\n\n🏦 Cuenta ' + (i + 1) + ':\n' + c.banco + '\n' + c.tipo + ': ' + c.numero + '\n👤 ' + c.titular;
            if (!cedulaUnica && c.cedula) {
              bankMsg += '\n📌 Cédula: ' + c.cedula;
            }
          });
        }
        var trackingUrl = window.location.origin + '/seguimiento?tel=' + (order.telefono || '').replace(/\D/g, '');
        return '🍪 *ESME COOKIES*\n\n' +
          '*¡HOLA ' + (order.cliente || '').toUpperCase() + '!*\n' +
          'Recibimos tu pedido #' + String(order.numero).padStart(4, '0') + ' 🎉\n\n' +
          '*📋 DATOS DEL PEDIDO*\n─────────────────\n' +
          '👤 Cliente: ' + (order.cliente || '') + '\n' +
          '🚚 Entrega: ' + tipoTexto + '\n' +
          '📦 Productos:\n' + prods + '\n' +
          '─────────────────\n' +
          '*💰 TOTAL A PAGAR: RD$ ' + (order.total || 0).toLocaleString() + '*' + descuentoMsg + '\n' +
          '💳 Pago: ' + (order.pago || 'Por definir') + '\n' +
          '─────────────────\n' +
          bankMsg + '\n\n' +
          '*⏳ PRÓXIMO PASO*\n' +
          'Por favor, realiza la transferencia y envíame el comprobante aquí.\n' +
          'Una vez confirmado tu pago, comenzaremos a preparar tu pedido.\n\n' +
          '*📍 SEGUÍ TU PEDIDO:*\n' + trackingUrl + '\n\n' +
          '¡Gracias por tu compra! 🍪';
      }
      
      if (nuevoEstado === 'Confirmado') {
        var trackingUrl = window.location.origin + '/seguimiento?tel=' + (order.telefono || '').replace(/\D/g, '');
        return '🍪 *ESME COOKIES*\n\n' +
          '*¡PAGO CONFIRMADO! ✅*\n\n' +
          'Pedido #' + String(order.numero).padStart(4, '0') + '\n' +
          'Cliente: ' + (order.cliente || '') + '\n\n' +
          'Tu pago ha sido confirmado. Comenzaremos a preparar tu pedido pronto.\n\n' +
          '*📍 SEGUÍ TU PEDIDO:*\n' + trackingUrl + '\n\n' +
          '¡Te avisaremos cuando esté listo! 🍪';
      }

      if (nuevoEstado === 'Preparando') {
        var trackingUrl = window.location.origin + '/seguimiento?tel=' + (order.telefono || '').replace(/\D/g, '');
        return '🍪 *ESME COOKIES*\n\n' +
          '*¡TU PEDIDO ESTÁ SIENDO PREPARADO! 🍪*\n\n' +
          'Pedido #' + String(order.numero).padStart(4, '0') + '\n' +
          'Cliente: ' + (order.cliente || '') + '\n\n' +
          'Estamos preparando tu pedido con mucho cuidado. Te avisamos pronto cuando esté listo.\n\n' +
          '*📍 SEGUÍ TU PEDIDO:*\n' + trackingUrl + ' 🎉';
      }
      
      if (nuevoEstado === 'Listo') {
        var listoMsg = tipoEntrega === 'pickup' 
          ? '🎉 *¡TU PEDIDO ESTÁ LISTO!*\n\nPuedes pasar a buscarlo por:\n📍 ' + (currentConfig.pickupAddress || 'nuestra ubicación')
          : tipoEntrega === 'delivery'
          ? '🎉 *¡TU PEDIDO ESTÁ LISTO!*\n\nSaldrá pronto hacia tu dirección.'
          : '🎉 *¡TU PEDIDO HA SIDO ENVIADO!*\n\nTe llegará en los próximos días.';
        var trackingUrl = window.location.origin + '/seguimiento?tel=' + (order.telefono || '').replace(/\D/g, '');
        return '🍪 *ESME COOKIES*\n\n' + listoMsg + '\n\n' +
          'Pedido #' + String(order.numero).padStart(4, '0') + '\n' +
          '*📍 SEGUÍ TU PEDIDO:*\n' + trackingUrl + '\n\n' +
          '¡Gracias por tu compra! 🍪';
      }

      if (nuevoEstado === 'Entregado') {
        var trackingUrl = window.location.origin + '/seguimiento?tel=' + (order.telefono || '').replace(/\D/g, '');
        return '🍪 *ESME COOKIES*\n\n' +
          '*¡PEDIDO ENTREGADO! 🎉*\n\n' +
          'Pedido #' + String(order.numero).padStart(4, '0') + '\n' +
          'Cliente: ' + (order.cliente || '') + '\n\n' +
          'Tu pedido ha sido entregado exitosamente.\n\n' +
          '*📍 SEGUÍ TU PEDIDO:*\n' + trackingUrl + '\n\n' +
          '¡Gracias por tu compra! Vuelve pronto 🍪';
      }
      
      if (nuevoEstado === 'Cancelado') {
        return '🍪 *ESME COOKIES*\n\n' +
          '*PEDIDO CANCELADO*\n\n' +
          'Pedido #' + String(order.numero).padStart(4, '0') + '\n' +
          'Cliente: ' + (order.cliente || '') + '\n\n' +
          'Este pedido ha sido cancelado.\n\n' +
          'Si tienes alguna pregunta, respóndeme a este mensaje.';
      }
      
      return '🍪 *ESME COOKIES*\n\nPedido #' + String(order.numero).padStart(4, '0') + '\nCliente: ' + (order.cliente || '');
      
      // Si no hay plantilla personalizada, usar predeterminada
      // (el resto del código genera mensajes predeterminados)

      if (nuevoEstado === 'Esperando Pago') {
        return '🍪 *ESME COOKIES*\n\n' +
          '*¡HOLA ' + order.cliente.toUpperCase() + '!*\n' +
          'Recibimos tu pedido #' + String(order.numero).padStart(4, '0') + ' 🎉\n\n' +
          '*📋 DATOS DEL PEDIDO*\n' +
          '─────────────────\n' +
          '👤 Cliente: ' + order.cliente + '\n' +
          '🚚 Entrega: ' + tipoTexto + '\n' +
          '📦 Productos:\n' + prods.replace(/,/g, '\n') + '\n' +
          '─────────────────\n' +
          '*💰 TOTAL A PAGAR: RD$ ' + (order.total || 0).toLocaleString() + '*\n' +
          descuentoInfo +
          '💳 Forma de pago: ' + (order.pago || 'Por definir') + '\n' +
          '─────────────────\n' +
          bankInfo + '\n\n' +
          '*⏳ PRÓXIMO PASO*\n' +
          'Por favor, realiza la transferencia y envíame el comprobante aquí.\n' +
          'Una vez confirmado tu pago, comenzaremos a preparar tu pedido.\n\n' +
          '¡Gracias por tu compra! 🍪';
      }
      
      if (nuevoEstado === 'Confirmado') {
        return '🍪 *ESME COOKIES*\n\n' +
          '*¡PAGO CONFIRMADO! ✅*\n\n' +
          'Pedido #' + String(order.numero).padStart(4, '0') + '\n' +
          'Cliente: ' + order.cliente + '\n\n' +
          'Tu pago ha sido confirmado. Comenzaremos a preparar tu pedido pronto.\n\n' +
          '¡Te avisaremos cuando esté listo! 🍪';
      }

      if (nuevoEstado === 'Preparando') {
        return '🍪 *ESME COOKIES*\n\n' +
          '*¡TU PEDIDO ESTÁ SIENDO PREPARADO! 🍪*\n\n' +
          'Pedido #' + String(order.numero).padStart(4, '0') + '\n' +
          'Cliente: ' + order.cliente + '\n\n' +
          'Estamos preparando tu pedido con mucho cuidado. Te avisamos pronto cuando esté listo para recoger o entregar. 🎉';
      }
      
      if (nuevoEstado === 'Listo') {
        var listoMsg = '';
        if (tipoEntrega === 'pickup') {
          listoMsg = '🎉 *¡TU PEDIDO ESTÁ LISTO!*\n\nPuedes pasar a buscarlo por:\n📍 ' + (currentConfig.pickupAddress || 'nuestra ubicación');
        } else if (tipoEntrega === 'delivery') {
          listoMsg = '🎉 *¡TU PEDIDO ESTÁ LISTO!*\n\nSaldrá pronto hacia tu dirección. El delivery llegará en las próximas horas.';
        } else {
          listoMsg = '🎉 *¡TU PEDIDO HA SIDO ENVIADO!*\n\nTe llegará en los próximos días. Recibe tu pedido en la comodidad de tu hogar.';
        }
        return '🍪 *ESME COOKIES*\n\n' + listoMsg + '\n\n' +
          'Pedido #' + String(order.numero).padStart(4, '0') + '\n' +
          '¡Gracias por tu compra! 🍪';
      }

      if (nuevoEstado === 'Entregado') {
        return '🍪 *ESME COOKIES*\n\n' +
          '*¡PEDIDO ENTREGADO! 🎉*\n\n' +
          'Pedido #' + String(order.numero).padStart(4, '0') + '\n' +
          'Cliente: ' + order.cliente + '\n\n' +
          'Tu pedido ha sido entregado exitosamente.\n\n' +
          '¡Gracias por tu compra! Vuelve pronto 🍪';
      }
      
      if (nuevoEstado === 'Cancelado') {
        return '🍪 *ESME COOKIES*\n\n' +
          '*PEDIDO CANCELADO*\n\n' +
          'Pedido #' + String(order.numero).padStart(4, '0') + '\n' +
          'Cliente: ' + order.cliente + '\n\n' +
          'Este pedido ha sido cancelado.\n\n' +
          'Si tienes alguna pregunta, respondeme a este mensaje.';
      }

      return '🍪 *ESME COOKIES*\n\n' +
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
              estado_anterior: currentState
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

    async function updateOrderState(numero, withoutMessage) {
      var order = orders.find(function (o) { return o.numero === numero; });
      if (!order) { showToast('Pedido no encontrado', 'error'); return; }

      var currentState = order.estado || 'Pendiente';
      var nextState = getNextState(currentState);

      if (!nextState) {
        showToast('Este pedido ya esta completo', 'info');
        return;
      }

      try {
        var res = await apiFetch(API_URL + '/api/orders/' + numero, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estado: nextState,
            estado_timestamp: new Date().toISOString(),
            estado_anterior: currentState
          })
        });
        if (res.ok) {
          order.estado = nextState;
          updatePedidosCounters();
          renderOrders();
          showToast('Estado actualizado: ' + nextState, 'success');
          renderPreparacion();
        } else {
          showToast('Error al actualizar estado', 'error');
        }
      } catch (err) {
        console.error('Error actualizando estado:', err);
        showToast('Error de conexión', 'error');
      }
    }

    function renderPreparacion() {
      if (!products || products.length === 0) {
        document.getElementById('prep-by-product').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">Cargando productos...</div>';
        loadData();
        return;
      }

      var activeOrders = orders.filter(function (o) { return ['Pendiente', 'Esperando Pago', 'Confirmado', 'Preparando', 'Listo'].indexOf(o.estado) >= 0; });

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
        var order = { Pendiente: 0, 'Esperando Pago': 1, Confirmado: 2, Preparando: 3, Listo: 4 };
        return (order[a.estado] || 0) - (order[b.estado] || 0);
      });

      var html = '';
      list.forEach(function (o) {
        var tipoIcon = o.tipo_entrega === 'pickup' ? '🏪' : o.tipo_entrega === 'delivery' ? '🚚' : '📮';
        var btnLabel = o.estado === 'Pendiente' ? 'Confirmar' : o.estado === 'Esperando Pago' ? 'Confirmar Pago' : o.estado === 'Confirmado' ? 'Preparar' : o.estado === 'Preparando' ? 'Listo' : o.estado === 'Listo' ? 'Entregar' : 'Actualizar';
        var btnBg = o.estado === 'Pendiente' ? 'var(--warning)' : o.estado === 'Esperando Pago' ? '#28A745' : o.estado === 'Confirmado' ? '#0369A1' : o.estado === 'Preparando' ? '#15803D' : o.estado === 'Listo' ? '#6f42c1' : 'var(--success)';
        var badgeClass = getStateColor(o.estado);
        var borderColor = o.estado === 'Pendiente' ? 'var(--warning)' : o.estado === 'Esperando Pago' ? '#28A745' : o.estado === 'Confirmado' ? 'var(--info)' : o.estado === 'Preparando' ? '#0369A1' : o.estado === 'Listo' ? '#15803D' : 'var(--success)';
        html += '<div style="background:white;margin-bottom:8px;padding:10px;border-radius:8px;border-left:4px solid ' + borderColor + ';"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><strong style="color:var(--primary);">' + tipoIcon + ' #' + String(o.numero).padStart(4, '0') + '</strong><span class="badge badge-' + badgeClass + '" style="font-size:0.65rem;">' + o.estado + '</span></div><div style="font-size:0.85rem;margin-bottom:4px;">' + o.cliente + '</div><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">' + (o.telefono || '') + '</div><div style="font-size:0.7rem;background:var(--cream);padding:6px;border-radius:4px;margin-bottom:6px;white-space:pre-wrap;">' + (o.productos || 'Sin productos') + '</div><div style="font-size:0.8rem;font-weight:600;color:var(--primary);">RD$ ' + (o.total || 0).toLocaleString() + '</div><div style="display:flex;gap:4px;margin-top:8px;"><button onclick="sendConfirmation(' + o.numero + ')" style="flex:1;padding:6px;background:' + btnBg + ';color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:600;">' + btnLabel + '</button><button onclick="openEditModal(' + o.numero + ')" style="padding:6px 10px;background:var(--warm);border:none;border-radius:4px;cursor:pointer;font-size:0.75rem;">Editar</button></div></div>';
      });
      return html;
    }

    function toggleProductTipo() {
      var tipo = document.querySelector('input[name="product-tipo"]:checked');
      document.getElementById('box-config-fields').style.display = tipo && tipo.value === 'caja' ? 'block' : 'none';
      if (tipo && tipo.value === 'caja') loadBoxAllowedProducts();
    }

    function loadBoxAllowedProducts() {
      var container = document.getElementById('box-allowed-products');
      apiFetch(API_URL + '/api/products').then(function(res) {
        if (!res.ok) return;
        res.json().then(function(prods) {
          var filtered = prods.filter(function(p) { return p.id != 7 && p.tipo !== 'caja'; });
          if (filtered.length === 0) {
            container.innerHTML = '<p style="color:#999;font-size:0.85rem;text-align:center;">No hay productos disponibles</p>';
            return;
          }
          // Obtener productos actualmente seleccionados
          var currentAllowed = [];
          var boxConfigStr = document.getElementById('product-box-config').value;
          if (boxConfigStr) {
            try { var bc = JSON.parse(boxConfigStr); currentAllowed = bc.allowedProducts || []; } catch(e) {}
          }
          container.innerHTML = filtered.map(function(p) {
            var checked = currentAllowed.indexOf(p.id) >= 0;
            return '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:3px 6px;border-radius:4px;background:' + (checked ? '#e8f5e9' : 'white') + ';border:1px solid ' + (checked ? '#a5d6a7' : '#eee') + ';">' +
              '<input type="checkbox" class="box-allowed-cb" value="' + p.id + '" ' + (checked ? 'checked' : '') + ' style="margin:0;width:14px;height:14px;"> <span style="flex:1;font-size:0.85rem;line-height:1.3;">' + p.nombre + '</span> <span style="color:#999;font-size:0.75rem;">RD$' + p.precio + '</span></label>';
          }).join('');
        });
      }).catch(function() { container.innerHTML = '<p style="color:#999;font-size:0.85rem;">Error al cargar</p>'; });
    }

    function openProductModal(id) {
      editingProduct = id;
      document.getElementById('product-modal-title').textContent = id ? 'Editar Producto' : 'Nuevo Producto';
      document.getElementById('product-name').value = '';
      document.getElementById('product-price').value = '';
      document.getElementById('product-desc').value = '';
      document.getElementById('product-stock').value = '';
      document.getElementById('product-image').value = '';
      document.getElementById('product-image-preview').style.display = 'none';
      document.getElementById('preview-img').src = '';
      document.getElementById('product-box-config').value = '';
      document.getElementById('box-config-fields').style.display = 'none';
      document.querySelector('input[name="product-tipo"][value="producto"]').checked = true;

      if (id) {
        var p = products.find(function (prod) { return prod.id === id; });
        if (p) {
          document.getElementById('product-name').value = p.nombre;
          document.getElementById('product-price').value = p.precio;
          document.getElementById('product-desc').value = p.descripcion || '';
          document.getElementById('product-stock').value = (p.stock === null || p.stock === undefined) ? '' : p.stock;
          if (p.imagen) {
            document.getElementById('product-image').value = p.imagen;
            var imgUrl = p.imagen.startsWith('http') ? p.imagen : API_URL + p.imagen;
            document.getElementById('preview-img').src = imgUrl;
            document.getElementById('product-image-preview').style.display = 'block';
          }
          // Tipo y box config
          if (p.tipo === 'caja') {
            document.querySelector('input[name="product-tipo"][value="caja"]').checked = true;
            document.getElementById('box-config-fields').style.display = 'block';
            var bc = p.box_config;
            if (bc && typeof bc === 'string') { try { bc = JSON.parse(bc); } catch(e) { bc = null; } }
            if (bc && bc.sizes) {
              document.querySelectorAll('#box-config-fields .box-size-cb').forEach(function(cb) {
                cb.checked = bc.sizes.indexOf(parseInt(cb.value)) >= 0;
              });
            } else {
              document.querySelectorAll('#box-config-fields .box-size-cb').forEach(function(cb) { cb.checked = true; });
            }
            document.getElementById('product-box-config').value = JSON.stringify(bc || { sizes: [6, 12, 24], allowedProducts: [] });
            loadBoxAllowedProducts();
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
      var precio = parseFloat(document.getElementById('product-price').value) || 0;
      var descripcion = document.getElementById('product-desc').value.trim();
      var imagenData = document.getElementById('product-image').value;
      var tipo = document.querySelector('input[name="product-tipo"]:checked');
      var tipoVal = tipo ? tipo.value : 'producto';

      if (!nombre) { showToast('Completa los campos requeridos', 'error'); return; }
      if (tipoVal !== 'caja' && (!precio || precio <= 0)) { showToast('Ingresa un precio válido', 'error'); return; }

      try {
        var imagen = '';
        if (imagenData && imagenData.startsWith('data:')) {
          var res = await apiFetch(API_URL + '/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagen: imagenData, filename: nombre.replace(/\s+/g, '_') + '.jpg' })
          });
          if (res.ok) {
            var data = await res.json();
            imagen = data.url;
          } else {
            showToast('Error subiendo imagen', 'error');
            return;
          }
        } else if (imagenData && !imagenData.startsWith('data:')) {
          imagen = imagenData;
        }

        var stockInput = document.getElementById('product-stock').value.trim();

        // Build box config
        var boxConfig = null;
        if (tipoVal === 'caja') {
          var sizes = [];
          document.querySelectorAll('#box-config-fields .box-size-cb:checked').forEach(function(cb) { sizes.push(parseInt(cb.value)); });
          var allowedProducts = [];
          document.querySelectorAll('.box-allowed-cb:checked').forEach(function(cb) { allowedProducts.push(parseInt(cb.value)); });
          boxConfig = { sizes: sizes.length > 0 ? sizes : [6], allowedProducts: allowedProducts };
        }

        var productData = { nombre: nombre, precio: precio, descripcion: descripcion, imagen: imagen, stock: stockInput, tipo: tipoVal, box_config: boxConfig };

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
      var icon = '🔔';
      if (type === 'success') icon = '✅';
      if (type === 'error') icon = '❌';
      if (type === 'info') icon = 'ℹ️';
      if (type === 'warning') icon = '⚠️';
      
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
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);background:white;border-radius:12px;"><div style="font-size:3rem;margin-bottom:12px;">🎉</div><p>No hay ofertas creadas aún</p><p style="font-size:0.85rem;margin-top:8px;">Crea tu primera oferta con el botón de arriba</p></div>';
        return;
      }
      var tipoLabels = {
        banner: '🏷️ Banner',
        free_delivery: '🚚 Delivery',
        free_envio: '📦 Envío',
        free_all: '🎁 Todo Gratis',
        descuento_pct: '% Descuento',
        descuento_fijo: '💵 Desc Fijo',
        bogo: '🛒 2x1',
        cliente_nuevo: '⭐ Nuevo',
        pedido_minimo: '🛍️ Mín. Pedido',
        cantidad_minima: '🎯 Mín. Cantidad',
        whatsapp_only: '📱 WhatsApp'
      };
      var html = promos.map(function(p) {
        var fechaInfo = '';
        if (p.fecha_inicio || p.fecha_fin) {
          var ini = p.fecha_inicio ? p.fecha_inicio : '';
          var fin = p.fecha_fin ? p.fecha_fin : '';
          var hIni = p.hora_inicio ? p.hora_inicio : '';
          var hFin = p.hora_fin ? p.hora_fin : '';
          if (ini || fin) {
            fechaInfo = '<span style="display:inline-block;background:#e7f3ff;padding:4px 10px;border-radius:20px;font-size:0.75rem;color:#004085;font-weight:600;">📅 Del ' + ini + ' al ' + fin + '</span>';
          }
          if (hIni || hFin) {
            fechaInfo += ' <span style="display:inline-block;background:#fff3cd;padding:4px 10px;border-radius:20px;font-size:0.75rem;color:#856404;font-weight:600;">🕐 ' + (hIni || '00:00') + ' - ' + (hFin || '23:59') + '</span>';
          }
        }
        var descuento = '';
        if (p.descuento_pct > 0) descuento = '<span style="padding:3px 8px;background:#d4edda;color:#155724;border-radius:20px;font-size:0.75rem;font-weight:600;">-' + p.descuento_pct + '%</span>';
        if (p.descuento_fijo > 0) descuento = '<span style="padding:3px 8px;background:#d4edda;color:#155724;border-radius:20px;font-size:0.75rem;font-weight:600;">-RD$' + p.descuento_fijo + '</span>';
        if (p.compra_minima > 0) descuento = '<span style="padding:3px 8px;background:#cce5ff;color:#004085;border-radius:20px;font-size:0.75rem;font-weight:600;">Min RD$' + p.compra_minima + '</span>';
        if (p.cantidad_minima > 0) descuento = '<span style="padding:3px 8px;background:#fff3cd;color:#856404;border-radius:20px;font-size:0.75rem;font-weight:600;">x' + p.cantidad_minima + '</span>';
        
        var usoInfo = '';
        if (p.limite_usos > 0) {
          usoInfo = '<span style="font-size:0.7rem;color:#888;">📊 Usos: ' + (p.usos_actuales || 0) + '/' + p.limite_usos + '</span>';
        } else {
          usoInfo = '<span style="font-size:0.7rem;color:#888;">📊 Usos: ' + (p.usos_actuales || 0) + '</span>';
        }

        // Lógica de estado detallada (sincronizada con el motor de DR)
        var now = new Date();
        var drTime = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Santo_Domingo',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false
        }).format(now);
        var parts = drTime.split(/[\s,]+/);
        var currentDate = parts[0];
        var currentTime = parts[1] ? parts[1].substring(0, 5) : "00:00";

        var statusLabel = '';
        var fueraHorario = false;
        if (p.hora_inicio && p.hora_inicio > currentTime) fueraHorario = true;
        if (p.hora_fin && p.hora_fin < currentTime) fueraHorario = true;
        
        if (p.activa == 0) {
          statusLabel = '<span style="padding:2px 8px;background:#f8d7da;color:#721c24;border-radius:20px;font-size:0.7rem;font-weight:600;">❌ Inactiva / Finalizada</span>';
        } else if (p.limite_usos > 0 && (p.usos_actuales || 0) >= p.limite_usos) {
          statusLabel = '<span style="padding:2px 8px;background:#fff3cd;color:#856404;border-radius:20px;font-size:0.7rem;font-weight:600;">⚠️ Agotada (Límite alcanzado)</span>';
        } else if (p.fecha_inicio && p.fecha_inicio > currentDate) {
          statusLabel = '<span style="padding:2px 8px;background:#cce5ff;color:#004085;border-radius:20px;font-size:0.7rem;font-weight:600;">📅 Programada (' + p.fecha_inicio + ')</span>';
        } else if (p.fecha_fin && p.fecha_fin < currentDate) {
          statusLabel = '<span style="padding:2px 8px;background:#f8d7da;color:#721c24;border-radius:20px;font-size:0.7rem;font-weight:600;">⏰ Expirada por fecha</span>';
        } else if (fueraHorario) {
          statusLabel = '<span style="padding:2px 8px;background:#e2e3e5;color:#383d41;border-radius:20px;font-size:0.7rem;font-weight:600;">⏰ Fuera de horario (' + (p.hora_inicio || '00:00') + '-' + (p.hora_fin || '23:59') + ')</span>';
        } else {
          statusLabel = '<span style="padding:2px 8px;background:#d4edda;color:#155724;border-radius:20px;font-size:0.7rem;font-weight:600;">✅ Activa en Tienda</span>';
        }

        return '<div style="background:white;border-radius:12px;padding:18px;margin-bottom:12px;box-shadow:0 2px 8px rgba(44,24,16,0.08);border-left:5px solid ' + p.color + ';">'
          + '<div style="display:flex;align-items:flex-start;gap:15px;">'
          + '<div style="font-size:2.2rem;">' + (p.emoji || '🎉') + '</div>'
          + '<div style="flex:1;">'
          + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
          + '<span style="font-weight:700;color:var(--primary);font-size:1.05rem;">' + p.titulo + '</span>'
          + '<span style="padding:2px 8px;background:' + p.color + '20;color:' + p.color + ';border-radius:20px;font-size:0.7rem;font-weight:600;">' + (tipoLabels[p.tipo] || p.tipo) + '</span>'
          + statusLabel
          + '</div>'
          + (p.descripcion ? '<div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">' + p.descripcion + '</div>' : '')
          + '<div style="margin-top:8px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">' + descuento + fechaInfo + usoInfo + '</div>'
          + '</div>'
          + '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">'
          + '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.8rem;font-weight:600;color:var(--text-muted);">'
          + '<input type="checkbox" onchange="togglePromo(' + p.id + ',this.checked)" ' + (p.activa ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;"> Activar</label>'
          + '<button onclick="openPromoModal(' + p.id + ')" style="padding:5px 10px;background:var(--accent);color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">✏️</button>'
          + '<button onclick="deletePromo(' + p.id + ')" style="padding:5px 10px;background:var(--danger-light);color:var(--danger);border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">🗑️</button>'
          + '</div></div></div>';
      }).join('');
      container.innerHTML = html;
    }

    function togglePromoFields() {
      var tipo = document.getElementById('promo-tipo').value;
      document.getElementById('promo-field-pct').style.display = (tipo === 'descuento_pct') ? 'block' : 'none';
      document.getElementById('promo-field-fijo').style.display = (tipo === 'descuento_fijo') ? 'block' : 'none';
    }

    function openPromoModal(id) {
      editingPromo = id || null;
      document.getElementById('promo-modal-title').textContent = id ? 'Editar Oferta' : 'Nueva Oferta';
      
      // Limpiar campos
      ['promo-titulo','promo-desc','promo-pct','promo-fijo','promo-minimo','promo-cantidad','promo-limite','promo-inicio','promo-fin','promo-hora-inicio','promo-hora-fin'].forEach(function(el) {
        document.getElementById(el).value = '';
      });
      document.getElementById('promo-tipo').value = 'banner';
      document.getElementById('promo-aplica').value = 'todos';
      document.getElementById('promo-emoji').value = '🎉';
      document.getElementById('promo-color').value = '#C9883A';
      document.getElementById('promo-orden').value = '0';
      document.getElementById('promo-activa').checked = true;
      document.getElementById('promo-solo-cajas').checked = false;
      togglePromoFields();
      
      // Si es edición, cargar datos existentes
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
          document.getElementById('promo-emoji').value = promo.emoji || '🎉';
          document.getElementById('promo-color').value = promo.color || '#C9883A';
          document.getElementById('promo-orden').value = promo.orden || 0;
          document.getElementById('promo-inicio').value = promo.fecha_inicio || '';
          document.getElementById('promo-fin').value = promo.fecha_fin || '';
          document.getElementById('promo-hora-inicio').value = promo.hora_inicio || '';
          document.getElementById('promo-hora-fin').value = promo.hora_fin || '';
          document.getElementById('promo-activa').checked = promo.activa == 1;
          document.getElementById('promo-solo-cajas').checked = promo.solo_cajas == 1;
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
      if (!titulo) { showToast('El título es requerido', 'error'); return; }
      var tipo = document.getElementById('promo-tipo').value;
      var data = {
        titulo: titulo,
        descripcion: document.getElementById('promo-desc').value.trim(),
        tipo: tipo,
        aplica_a: document.getElementById('promo-aplica').value,
        descuento_pct: (parseFloat(document.getElementById('promo-pct').value) || 0),
        descuento_fijo: (parseFloat(document.getElementById('promo-fijo').value) || 0),
        compra_minima: (parseFloat(document.getElementById('promo-minimo').value) || 0),
        cantidad_minima: (parseInt(document.getElementById('promo-cantidad').value) || 0),
        limite_usos: parseInt(document.getElementById('promo-limite').value) || null,
        emoji: document.getElementById('promo-emoji').value || '🎉',
        color: document.getElementById('promo-color').value || '#C9883A',
        orden: parseInt(document.getElementById('promo-orden').value) || 0,
        fecha_inicio: document.getElementById('promo-inicio').value,
        fecha_fin: document.getElementById('promo-fin').value,
        hora_inicio: document.getElementById('promo-hora-inicio').value,
        hora_fin: document.getElementById('promo-hora-fin').value,
    activa: document.getElementById('promo-activa').checked,
    solo_cajas: document.getElementById('promo-solo-cajas').checked ? 1 : 0
  };
      try {
        var url = editingPromo ? API_URL + '/api/promociones/' + editingPromo : API_URL + '/api/promociones';
        var method = editingPromo ? 'PUT' : 'POST';
        var res = await apiFetch(url, { method: method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        if (res.ok) {
          showToast('Oferta guardada ✅', 'success');
          closePromoModal();
          loadPromos();
        } else { showToast('Error al guardar', 'error'); }
      } catch(err) { showToast('Error de conexión', 'error'); }
    }

    async function togglePromo(id, activa) {
      var promo = promos.find(function(p) { return p.id === id; });
      if (!promo) return;
      try {
        var res = await apiFetch(API_URL + '/api/promociones/' + id, {
          method: 'PUT', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(Object.assign({}, promo, { activa: activa }))
        });
        if (!res.ok) { showToast('Error al cambiar estado', 'error'); return; }
        showToast(activa ? 'Oferta activada ✅' : 'Oferta desactivada', activa ? 'success' : 'info');
        loadPromos();
      } catch(err) { showToast('Error', 'error'); }
    }

    async function deletePromo(id) {
      if (!confirm('¿Eliminar esta oferta?')) return;
      try {
        var res = await apiFetch(API_URL + '/api/promociones/' + id, { method: 'DELETE' });
        if (res.ok) { showToast('Oferta eliminada', 'success'); loadPromos(); }
        else { showToast('Error al eliminar', 'error'); }
      } catch(err) { showToast('Error de conexión', 'error'); }
    }
    // ===== FIN PROMOCIONES =====

    // Descarga un reporte CSV generado por el servidor (envía el token de admin).
    async function descargarReporteCSV(endpoint, filename) {
      try {
        showToast('Generando reporte...', 'info');
        var res = await apiFetch(API_URL + endpoint);
        if (!res.ok) { showToast('Error al generar reporte', 'error'); return; }
        var blob = await res.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Reporte descargado', 'success');
      } catch (err) {
        showToast('Error de conexion', 'error');
      }
    }
    function descargarPedidosCSV() {
      var f = 'pedidos_' + new Date().toISOString().split('T')[0] + '.csv';
      descargarReporteCSV('/api/reportes/pedidos.csv', f);
    }
    function descargarClientesCSV() {
      var f = 'clientes_' + new Date().toISOString().split('T')[0] + '.csv';
      descargarReporteCSV('/api/reportes/clientes.csv', f);
    }

    async function showClientesReport() {
      try {
        var res = await apiFetch(API_URL + '/api/clientes/all?all=true');
        if (!res.ok) throw new Error('Error');
        var clientes = await res.json();
        
        var res2 = await apiFetch(API_URL + '/api/orders?all=true');
        if (!res2.ok) { showToast('Error al cargar pedidos', 'error'); return; }
        var ordersAll = await res2.json();
        
        var totalClientes = clientes.length;
        var totalGastado = clientes.reduce(function(s, c) { return s + (c.total_gastado || 0); }, 0);
        var totalDescuentos = clientes.reduce(function(s, c) { return s + (c.total_descuentos || 0); }, 0);
        
        var clientesConPedidos = clientes.filter(function(c) { return (c.total_pedidos || 0) > 0; }).length;
        var mejorCliente = clientes.reduce(function(best, c) { return ((c.total_gastado || 0) > (best.total_gastado || 0)) ? c : best; }, { nombre: '', total_gastado: 0 });
        
        var porSector = {};
        clientes.forEach(function(c) {
          var sector = c.sector || 'Sin sector';
          porSector[sector] = (porSector[sector] || 0) + 1;
        });
        
        var html = '';
        
        html += '<div style="margin-bottom:20px;">';
        html += '<h3 style="color:var(--primary); margin:0; font-size:1.4rem;">👥 Reporte de Clientes</h3>';
        html += '<p style="color:var(--text-muted); margin:5px 0 0 0;">' + totalClientes + ' clientes registrados</p>';
        html += '</div>';
        
        // Tarjetas de resumen
        html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:15px; margin-bottom:20px;">';
        html += '<div style="background:linear-gradient(135deg, #2C1810 0%, #4a3728 100%); padding:20px; border-radius:12px; color:white;">';
        html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Total Clientes</div>';
        html += '<div style="font-size:2rem; font-weight:700;">' + totalClientes + '</div>';
        html += '</div>';
        html += '<div style="background:linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); padding:20px; border-radius:12px; color:white;">';
        html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Con Pedidos</div>';
        html += '<div style="font-size:2rem; font-weight:700;">' + clientesConPedidos + '</div>';
        html += '</div>';
        html += '<div style="background:linear-gradient(135deg, #C9883A 0%, #D9A036 100%); padding:20px; border-radius:12px; color:white;">';
        html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Total Recaudado</div>';
        html += '<div style="font-size:2rem; font-weight:700;">RD$ ' + totalGastado.toLocaleString() + '</div>';
        html += '</div>';
        html += '<div style="background:linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); padding:20px; border-radius:12px; color:white;">';
        html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Descuentos</div>';
        html += '<div style="font-size:2rem; font-weight:700;">RD$ ' + totalDescuentos.toLocaleString() + '</div>';
        html += '</div>';
        html += '</div>';
        
        // Estado de Resultados
        html += '<div style="background:white; padding:20px; border-radius:12px; border:2px solid var(--warm); margin-bottom:20px;">';
        html += '<h4 style="margin:0 0 15px 0; color:var(--primary); font-size:1rem;">📋 Métricas de Clientes</h4>';
        html += '<table style="width:100%; border-collapse:collapse; font-size:0.9rem;">';
        html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">Clientes con compras</td><td style="text-align:right; font-weight:600;">' + clientesConPedidos + '</td></tr>';
        html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">Clientes sin compras</td><td style="text-align:right; font-weight:600;">' + (totalClientes - clientesConPedidos) + '</td></tr>';
        html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">Promedio por cliente</td><td style="text-align:right; font-weight:600;">RD$ ' + (clientesConPedidos > 0 ? Math.round(totalGastado/clientesConPedidos).toLocaleString() : 0) + '</td></tr>';
        if (mejorCliente.nombre) {
          html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">Mejor cliente</td><td style="text-align:right; font-weight:600;">' + mejorCliente.nombre + '</td></tr>';
          html += '<tr style="background:var(--cream);"><td style="padding:12px 0;">Total mejor cliente</td><td style="text-align:right; font-weight:700; color:var(--primary);">RD$ ' + mejorCliente.total_gastado.toLocaleString() + '</td></tr>';
        }
        html += '</table>';
        html += '</div>';
        
        // Por Sector
        html += '<div style="background:white; padding:20px; border-radius:12px; border:2px solid var(--warm); margin-bottom:20px;">';
        html += '<h4 style="margin:0 0 15px 0; color:var(--primary); font-size:1rem;">🏘️ Clientes por Sector</h4>';
        html += '<div style="display:flex; flex-wrap:wrap; gap:10px;">';
        for (var sector in porSector) {
          html += '<div style="background:var(--cream); color:var(--primary); padding:8px 16px; border-radius:20px; font-weight:600;">' + sector + ': ' + porSector[sector] + '</div>';
        }
        html += '</div>';
        html += '</div>';
        
        // Top 10 clientes
        var topClientes = clientes.slice(0).sort(function(a, b) { return (b.total_gastado || 0) - (a.total_gastado || 0); }).slice(0, 10);
        
        html += '<div style="background:white; padding:20px; border-radius:12px; border:2px solid var(--warm); margin-bottom:20px;">';
        html += '<h4 style="margin:0 0 15px 0; color:var(--primary); font-size:1rem;">🏆 Top 10 Clientes</h4>';
        html += '<table style="width:100%; border-collapse:collapse; font-size:0.9rem;">';
        html += '<tr style="background:var(--cream);"><th style="text-align:left; padding:8px;">#</th><th style="text-align:left; padding:8px;">Cliente</th><th style="text-align:left; padding:8px;">Teléfono</th><th style="text-align:right; padding:8px;">Pedidos</th><th style="text-align:right; padding:8px;">Total</th></tr>';
        topClientes.forEach(function(c, i) {
          html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;">' + (i+1) + '</td><td style="padding:8px;">' + (c.nombre || '-') + '</td><td style="padding:8px;">' + (c.telefono || '-') + '</td><td style="text-align:right; padding:8px;">' + (c.total_pedidos || 0) + '</td><td style="text-align:right; padding:8px; font-weight:600;">RD$ ' + (c.total_gastado || 0).toLocaleString() + '</td></tr>';
        });
        html += '</table>';
        html += '</div>';
        
        // Botones de exportar
        html += '<div style="display:flex; gap:10px; justify-content:center; margin-top:10px;">';
        html += '<button onclick="exportClientes()" style="padding:12px 20px; background:#27ae60; color:white; border:none; border-radius:10px; font-weight:600; cursor:pointer;">📥 Exportar Clientes</button>';
        html += '<button onclick="exportClientesHistorial()" style="padding:12px 20px; background:#8e44ad; color:white; border:none; border-radius:10px; font-weight:600; cursor:pointer;">📊 Clientes + Pedidos</button>';
        html += '</div>';
        
        // Mostrar reporte
        var reportDiv = document.getElementById('clientes-report');
        if (!reportDiv) {
          reportDiv = document.createElement('div');
          reportDiv.id = 'clientes-report';
          reportDiv.style.display = 'none';
          var clientesTab = document.getElementById('tab-clientes');
          var firstChild = clientesTab.firstChild;
          clientesTab.insertBefore(reportDiv, firstChild);
        }
        reportDiv.innerHTML = html;
        reportDiv.style.display = 'block';
        
        // Ocultar lista de clientes
        var clientesList = document.getElementById('clientes-list');
        if (clientesList) clientesList.style.display = 'none';
        
        showToast('Reporte mostrado', 'success');
      } catch (err) {
        showToast('Error al cargar reporte', 'error');
      }
    }

    async function recalcularClientes() {
      if (!confirm('Esto recalculará los totales de todos los clientes desde los pedidos reales. ¿Continuar?')) return;
      try {
        showToast('Recalculando...', 'info');
        var res = await apiFetch(API_URL + '/api/clientes/recalcular', { method: 'POST' });
        var data = await res.json();
        if (res.ok) {
          showToast('Clientes recalculados: ' + data.actualizados + ' actualizados', 'success');
          loadClientes();
        } else {
          showToast('Error: ' + (data.error || ''), 'error');
        }
      } catch (err) {
        showToast('Error de conexión', 'error');
      }
    }

    async function exportClientes() {
      try {
        var res = await apiFetch(API_URL + '/api/clientes/all?all=true');
        if (!res.ok) throw new Error('Error');
        var clientes = await res.json();

        if (clientes.length === 0) {
          showToast('No hay clientes para exportar', 'error');
          return;
        }

        // Ordenar por total gastado descendente
        clientes.sort(function(a, b) { return (b.total_gastado || 0) - (a.total_gastado || 0); });

        var wb = XLSX.utils.book_new();

        // --- Hoja Resumen ---
        var wsData = [];
        wsData.push([{ t: 's', v: 'ESME COOKIES - REPORTE DE CLIENTES' }]);
        wsData.push([{ t: 's', v: 'Fecha de Generación: ' + new Date().toLocaleDateString('es-DO') }]);
        wsData.push([]);

        var totalClientes = clientes.length;
        var clientesConPedidos = clientes.filter(function(c) { return (c.total_pedidos || 0) > 0; }).length;
        var clientesSinPedidos = totalClientes - clientesConPedidos;
        var totalGastado = clientes.reduce(function(s, c) { return s + (c.total_gastado || 0); }, 0);
        var totalDescuentos = clientes.reduce(function(s, c) { return s + (c.total_descuentos || 0); }, 0);
        var promedioCliente = clientesConPedidos > 0 ? Math.round(totalGastado / clientesConPedidos) : 0;
        var mejorCliente = clientes[0] || { nombre: '-', total_gastado: 0, total_pedidos: 0 };

        wsData.push([{ t: 's', v: 'RESUMEN GENERAL' }]);
        wsData.push(['Total Clientes:', totalClientes, '']);
        wsData.push(['Clientes con Pedidos:', clientesConPedidos, '']);
        wsData.push(['Clientes sin Pedidos:', clientesSinPedidos, '']);
        wsData.push(['Total Recaudado:', totalGastado, 'RD$']);
        wsData.push(['Total Descuentos:', totalDescuentos, 'RD$']);
        wsData.push(['Promedio por Cliente:', promedioCliente, 'RD$']);
        wsData.push([]);

        // Por Sector
        wsData.push([{ t: 's', v: 'POR SECTOR' }]);
        wsData.push(['Sector', 'Clientes', '%']);
        var porSector = {};
        clientes.forEach(function(c) {
          var sector = c.sector || 'Sin sector';
          porSector[sector] = (porSector[sector] || 0) + 1;
        });
        for (var sector in porSector) {
          wsData.push([sector, porSector[sector], Math.round(porSector[sector] / totalClientes * 100) + '%']);
        }
        wsData.push([]);

        // Top 10
        wsData.push([{ t: 's', v: 'TOP 10 CLIENTES' }]);
        wsData.push(['#', 'Cliente', 'Teléfono', 'Pedidos', 'Total Gastado', 'RD$']);
        clientes.slice(0, 10).forEach(function(c, i) {
          wsData.push([i + 1, c.nombre || '-', c.telefono || '-', c.total_pedidos || 0, c.total_gastado || 0, 'RD$']);
        });

        var wsResumen = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

        // --- Hoja Detalle ---
        var detalleData = [];
        detalleData.push(['Nombre', 'Teléfono', 'Email', 'Dirección', 'Sector', 'Total Pedidos', 'Total Gastado', 'Descuentos', 'Último Pedido']);

        clientes.forEach(function(c) {
          detalleData.push([
            c.nombre || '',
            c.telefono || '',
            c.email || '',
            c.direccion || '',
            c.sector || '',
            c.total_pedidos || 0,
            c.total_gastado || 0,
            c.total_descuentos || 0,
            c.ultimo_pedido || ''
          ]);
        });

        var wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
        XLSX.utils.book_append_sheet(wb, wsDetalle, 'Clientes');

        XLSX.writeFile(wb, 'ESME_Reporte_Clientes_' + (new Date().toISOString().split('T')[0]) + '.xlsx');

        showToast('Reporte de clientes exportado', 'success');
      } catch (err) {
        showToast('Error al exportar', 'error');
      }
    }

    async function exportClientesHistorial() {
      try {
        var res = await apiFetch(API_URL + '/api/orders?all=true');
        if (!res.ok) throw new Error('Error');
        var ordersAll = await res.json();

        var res2 = await apiFetch(API_URL + '/api/clientes/all?all=true');
        if (!res2.ok) { showToast('Error al cargar clientes', 'error'); return; }
        var clientes = await res2.json();

        if (clientes.length === 0) {
          showToast('No hay clientes para exportar', 'error');
          return;
        }

        var wb = XLSX.utils.book_new();

        // --- Hoja Resumen por Cliente ---
        var wsData = [];
        wsData.push([{ t: 's', v: 'ESME COOKIES - CLIENTES CON HISTORIAL' }]);
        wsData.push([{ t: 's', v: 'Fecha de Generación: ' + new Date().toLocaleDateString('es-DO') }]);
        wsData.push([]);

        var totalClientes = clientes.length;
        var totalGastado = clientes.reduce(function(s, c) { return s + (c.total_gastado || 0); }, 0);
        var totalPedidos = ordersAll.length;
        var totalDescuentos = clientes.reduce(function(s, c) { return s + (c.total_descuentos || 0); }, 0);

        wsData.push([{ t: 's', v: 'RESUMEN GENERAL' }]);
        wsData.push(['Total Clientes:', totalClientes, '']);
        wsData.push(['Total Pedidos:', totalPedidos, '']);
        wsData.push(['Total Recaudado:', totalGastado, 'RD$']);
        wsData.push(['Total Descuentos:', totalDescuentos, 'RD$']);
        wsData.push([]);

        // Resumen por cliente
        wsData.push([{ t: 's', v: 'RESUMEN POR CLIENTE' }]);
        wsData.push(['Cliente', 'Teléfono', 'Pedidos', 'Total Gastado', 'Pendientes', 'Entregados', 'Cancelados', 'Último Pedido']);

        clientes.forEach(function(c) {
          var pedidosCliente = ordersAll.filter(function(o) { return o.telefono === c.telefono; });
          var pendientes = pedidosCliente.filter(function(o) { return o.estado === 'Pendiente' || o.estado === 'Esperando Pago' || o.estado === 'Confirmado' || o.estado === 'Preparando' || o.estado === 'Listo'; }).length;
          var entregados = pedidosCliente.filter(function(o) { return o.estado === 'Entregado'; }).length;
          var cancelados = pedidosCliente.filter(function(o) { return o.estado === 'Cancelado'; }).length;
          wsData.push([
            c.nombre || '',
            c.telefono || '',
            pedidosCliente.length,
            c.total_gastado || 0,
            pendientes,
            entregados,
            cancelados,
            c.ultimo_pedido || ''
          ]);
        });

        var wsResumen = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Clientes');

        // --- Hoja Detalle de Pedidos ---
        var detalleData = [];
        detalleData.push(['#', 'Fecha', 'Cliente', 'Teléfono', 'Tipo Entrega', 'Productos', 'Subtotal', 'Descuento', 'Envío', 'Total', 'Pago', 'Estado', 'Promociones']);

        ordersAll.sort(function(a, b) { return b.numero - a.numero; });

        ordersAll.forEach(function(o) {
          var cliente = clientes.find(function(c) { return c.telefono === o.telefono; });
          var clienteNombre = cliente ? cliente.nombre : (o.cliente || '');
          var tipoTxt = o.tipo_entrega === 'pickup' ? 'Pasar a buscar' : o.tipo_entrega === 'delivery' ? 'Delivery' : o.tipo_entrega === 'envio' ? 'Envío Nacional' : '';
          var productos = (o.productos || '').replace(/\n/g, ', ');
          var promos = [];
          try {
            if (o.promociones_aplicadas) promos = JSON.parse(o.promociones_aplicadas);
          } catch(e) { promos = []; }
          var promosTexto = promos.map(function(p) { return p.titulo + ' (-RD$' + p.descuento + ')'; }).join('; ');

          detalleData.push([
            '#' + (o.numero || ''),
            o.fecha || '',
            clienteNombre,
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

        var wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
        XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Pedidos');

        XLSX.writeFile(wb, 'ESME_Clientes_Historial_' + (new Date().toISOString().split('T')[0]) + '.xlsx');

        showToast('Reporte de clientes e historial exportado', 'success');
      } catch (err) {
        showToast('Error al exportar', 'error');
      }
    }

    function exportOrdersToExcel() {
      exportOrdersToExcelExport();
    }

    function showOrdersReport() {
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

      var total = filtered.length;
      var cancelados = filtered.filter(function(o) { return o.estado === 'Cancelado'; }).length;
      var exitosos = total - cancelados;
      var ventasTotal = filtered.reduce(function(s, o) { return s + (o.estado !== 'Cancelado' ? (o.total || 0) : 0); }, 0);
      var descuentosTotal = filtered.reduce(function(s, o) { return s + (o.descuento || 0); }, 0);
      var envioTotal = filtered.reduce(function(s, o) { return s + (o.envio || 0); }, 0);
      
      var porTipo = { pickup: 0, delivery: 0, envio: 0 };
      var porEstado = { Pendiente: 0, 'Esperando Pago': 0, Confirmado: 0, Preparando: 0, Listo: 0, Entregado: 0, Cancelado: 0 };
      
      filtered.forEach(function(o) {
        if (porTipo[o.tipo_entrega] !== undefined) porTipo[o.tipo_entrega]++;
        if (porEstado[o.estado] !== undefined) porEstado[o.estado]++;
      });
      
      var html = '';
      
      // Título
      html += '<div style="margin-bottom:20px;">';
      html += '<h3 style="color:var(--primary); margin:0; font-size:1.4rem;">📊 Reporte de Pedidos</h3>';
      html += '<p style="color:var(--text-muted); margin:5px 0 0 0;">' + filtered.length + ' pedidos encontrados</p>';
      html += '</div>';
      
      // Tarjetas de resumen
      html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:15px; margin-bottom:20px;">';
      html += '<div style="background:linear-gradient(135deg, #2C1810 0%, #4a3728 100%); padding:20px; border-radius:12px; color:white;">';
      html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Total Pedidos</div>';
      html += '<div style="font-size:2rem; font-weight:700;">' + total + '</div>';
      html += '</div>';
      html += '<div style="background:linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); padding:20px; border-radius:12px; color:white;">';
      html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Pedidos Exitosos</div>';
      html += '<div style="font-size:2rem; font-weight:700;">' + exitosos + '</div>';
      html += '</div>';
      html += '<div style="background:linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding:20px; border-radius:12px; color:white;">';
      html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Cancelados</div>';
      html += '<div style="font-size:2rem; font-weight:700;">' + cancelados + '</div>';
      html += '</div>';
      html += '<div style="background:linear-gradient(135deg, #C9883A 0%, #D9A036 100%); padding:20px; border-radius:12px; color:white;">';
      html += '<div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">Ventas Totales</div>';
      html += '<div style="font-size:2rem; font-weight:700;">RD$ ' + ventasTotal.toLocaleString() + '</div>';
      html += '</div>';
      html += '</div>';
      
      // Estado de Resultados
      html += '<div style="background:white; padding:20px; border-radius:12px; border:2px solid var(--warm); margin-bottom:20px;">';
      html += '<h4 style="margin:0 0 15px 0; color:var(--primary); font-size:1rem;">📋 Estado de Resultados</h4>';
      html += '<table style="width:100%; border-collapse:collapse; font-size:0.9rem;">';
      html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">Ventas Brutas (Subtotal)</td><td style="text-align:right; font-weight:600;">RD$ ' + filtered.reduce(function(s, o) { return s + (o.subtotal || 0); }, 0).toLocaleString() + '</td></tr>';
      html += '<tr style="border-bottom:1px solid #eee; color:#e74c3c;"><td style="padding:8px 0;">(-) Descuentos Otorgados</td><td style="text-align:right; font-weight:600;">-RD$ ' + descuentosTotal.toLocaleString() + '</td></tr>';
      html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">(+) Ingresos por Envío</td><td style="text-align:right; font-weight:600;">RD$ ' + envioTotal.toLocaleString() + '</td></tr>';
      html += '<tr style="background:var(--cream); font-weight:700;"><td style="padding:12px 0;">= Ventas Netas</td><td style="text-align:right; font-size:1.1rem; color:var(--primary);">RD$ ' + ventasTotal.toLocaleString() + '</td></tr>';
      html += '</table>';
      html += '</div>';
      
      // Por Tipo de Entrega
      html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:15px; margin-bottom:20px;">';
      html += '<div style="background:var(--cream); padding:16px; border-radius:10px; text-align:center;">';
      html += '<div style="font-size:2rem;">🏪</div>';
      html += '<div style="font-size:1.5rem; font-weight:700; color:var(--primary);">' + porTipo.pickup + '</div>';
      html += '<div style="font-size:0.8rem; color:var(--text-muted);">Pasar a Buscar</div>';
      html += '</div>';
      html += '<div style="background:var(--cream); padding:16px; border-radius:10px; text-align:center;">';
      html += '<div style="font-size:2rem;">🚚</div>';
      html += '<div style="font-size:1.5rem; font-weight:700; color:var(--primary);">' + porTipo.delivery + '</div>';
      html += '<div style="font-size:0.8rem; color:var(--text-muted);">Delivery</div>';
      html += '</div>';
      html += '<div style="background:var(--cream); padding:16px; border-radius:10px; text-align:center;">';
      html += '<div style="font-size:2rem;">📮</div>';
      html += '<div style="font-size:1.5rem; font-weight:700; color:var(--primary);">' + porTipo.envio + '</div>';
      html += '<div style="font-size:0.8rem; color:var(--text-muted);">Envíos</div>';
      html += '</div>';
      html += '</div>';
      
      // Por Estado
      html += '<div style="background:white; padding:20px; border-radius:12px; border:2px solid var(--warm); margin-bottom:20px;">';
      html += '<h4 style="margin:0 0 15px 0; color:var(--primary); font-size:1rem;">📊 Distribución por Estado</h4>';
      html += '<div style="display:flex; flex-wrap:wrap; gap:10px;">';
      for (var estado in porEstado) {
        var color = '#95a5a6';
        if (estado === 'Pendiente') color = '#f39c12';
        else if (estado === 'Esperando Pago') color = '#9b59b6';
        else if (estado === 'Confirmado') color = '#3498db';
        else if (estado === 'Preparando') color = '#0369A1';
        else if (estado === 'Listo') color = '#15803D';
        else if (estado === 'Entregado') color = '#27ae60';
        else if (estado === 'Cancelado') color = '#e74c3c';
        
        html += '<div style="background:' + color + '; color:white; padding:8px 16px; border-radius:20px; font-weight:600;">' + estado + ': ' + porEstado[estado] + '</div>';
      }
      html += '</div>';
      html += '</div>';
      
      // Botones de exportar
      html += '<div style="display:flex; gap:10px; justify-content:center; margin-top:10px;">';
      html += '<button onclick="exportOrdersToExcelExport()" style="padding:12px 20px; background:var(--accent); color:white; border:none; border-radius:10px; font-weight:600; cursor:pointer;">📥 Exportar CSV</button>';
      html += '</div>';
      
      // Mostrar reporte
      var reportDiv = document.getElementById('orders-report');
      if (!reportDiv) {
        reportDiv = document.createElement('div');
        reportDiv.id = 'orders-report';
        reportDiv.style.display = 'none';
        var pedidosTab = document.getElementById('tab-pedidos');
        var firstChild = pedidosTab.firstChild;
        pedidosTab.insertBefore(reportDiv, firstChild);
      }
      reportDiv.innerHTML = html;
      reportDiv.style.display = 'block';
      
      // Ocultar lista de pedidos mientras muestra el reporte
      var ordersList = document.getElementById('orders-list-container');
      if (ordersList) ordersList.style.display = 'none';
      
      showToast('Reporte mostrado', 'success');
    }

    function exportOrdersToExcelExport() {
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

      if (filtered.length === 0) {
        showToast('No hay pedidos para exportar', 'error');
        return;
      }

      // Agrupar pedidos por mes
      var ordersByMonth = {};
      filtered.forEach(function(o) {
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

      // Función para crear tabla de resumen
      function crearResumenMensual(monthOrders, mesNombre) {
        var wsData = [];

        // Título
        wsData.push([{ t: 's', v: 'ESME COOKIES - REPORTE DE VENTAS' }]);
        wsData.push([{ t: 's', v: 'Mes: ' + mesNombre }]);
        wsData.push([{ t: 's', v: 'Fecha de Generación: ' + new Date().toLocaleDateString('es-DO') }]);
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
        wsData.push(['Total Envíos:', totalEnvios, 'RD$']);
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

        // Por Método de Pago
        wsData.push([{ t: 's', v: 'POR MÉTODO DE PAGO' }]);
        wsData.push(['Método', 'Total', 'RD$']);
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
            var tipo = o.tipo_entrega === 'pickup' ? 'Pasar a buscar' : o.tipo_entrega === 'delivery' ? 'Delivery' : o.tipo_entrega === 'envio' ? 'Envío Nacional' : 'No especificado';
            entregas[tipo] = (entregas[tipo] || 0) + 1;
          }
        });
        for (var tipo in entregas) {
          wsData.push([tipo, entregas[tipo]]);
        }

        return wsData;
      }

      // Función para crear detalle de pedidos
      function crearDetallePedidos(monthOrders) {
        var wsData = [];

        // Encabezados
        wsData.push(['#', 'Fecha', 'Cliente', 'Teléfono', 'Tipo Entrega', 'Productos', 'Subtotal', 'Descuento', 'Envío', 'Total', 'Pago', 'Estado', 'Promociones']);

        monthOrders.forEach(function(o) {
          var promos = [];
          try {
            if (o.promociones_aplicadas) {
              promos = JSON.parse(o.promociones_aplicadas);
            }
          } catch(e) { promos = []; }
          var promosTexto = promos.map(function(p) { return p.titulo + ' (-RD$' + p.descuento + ')'; }).join('; ');

          var productos = (o.productos || '').replace(/\n/g, ', ');
          var tipoTxt = o.tipo_entrega === 'pickup' ? 'Pasar a buscar' : o.tipo_entrega === 'delivery' ? 'Delivery' : o.tipo_entrega === 'envio' ? 'Envío Nacional' : '';

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

      // Hoja General (si hay más de un mes)
      if (Object.keys(ordersByMonth).length > 1) {
        var wsGeneral = XLSX.utils.aoa_to_sheet(crearResumenMensual(filtered, 'Todos'));
        XLSX.utils.book_append_sheet(wb, wsGeneral, 'General');

        var wsDetalleGeneral = XLSX.utils.aoa_to_sheet(crearDetallePedidos(filtered));
        XLSX.utils.book_append_sheet(wb, wsDetalleGeneral, 'Todos los Pedidos');
      }

      // Descargar
      XLSX.writeFile(wb, 'ESME_Reporte_Pedidos_' + (new Date().toISOString().split('T')[0]) + '.xlsx');

      showToast('Reporte exportado exitosamente', 'success');
    }

    function renderDashboardInventory() {
      var invEl = document.getElementById('inventory-alerts');
      if (!invEl) return;
      var conStock = products.filter(function (p) { return p.stock !== null && p.stock !== undefined; });
      var agotados = conStock.filter(function (p) { return p.stock <= 0; });
      var threshold = window._invThreshold || 5;
      var bajos = conStock.filter(function (p) { return p.stock > 0 && p.stock <= threshold; });
      var totalUnidades = conStock.reduce(function(s, p) { return s + p.stock; }, 0);
      var invHtml = '';
      if (conStock.length === 0) {
        invHtml = '<p style="color:var(--text-muted);">Ningún producto tiene control de stock. Asigná un stock a un producto en la pestaña Productos para verlo acá.</p>';
      } else {
        invHtml += '<div style="display:flex; gap:10px; margin-bottom:14px;">';
        invHtml += '<div style="flex:1; text-align:center; background:#e8f5e9; border-radius:10px; padding:10px;"><div style="font-size:1.6rem; font-weight:700; color:var(--success);">' + totalUnidades + '</div><div style="font-size:0.8rem; color:var(--success);">Unidades</div></div>';
        invHtml += '<div style="flex:1; text-align:center; background:#fdecea; border-radius:10px; padding:10px;"><div style="font-size:1.6rem; font-weight:700; color:#c0392b;">' + agotados.length + '</div><div style="font-size:0.8rem; color:#c0392b;">Agotados</div></div>';
        invHtml += '<div style="flex:1; text-align:center; background:#fef5e7; border-radius:10px; padding:10px;"><div style="font-size:1.6rem; font-weight:700; color:#e67e22;">' + bajos.length + '</div><div style="font-size:0.8rem; color:#e67e22;">Stock bajo</div></div>';
        invHtml += '</div>';
        var alertList = agotados.concat(bajos);
        if (alertList.length === 0) {
          invHtml += '<p style="color:var(--success); font-weight:600;">✅ Todos los productos tienen stock suficiente (umbral: ' + threshold + ').</p>';
        } else {
          alertList.forEach(function (p) {
            var color = p.stock <= 0 ? '#c0392b' : '#e67e22';
            var etiqueta = p.stock <= 0 ? '⛔ Agotado' : (p.stock + ' u.');
            invHtml += '<div style="display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid var(--warm);"><span>' + p.nombre + '</span><span style="font-weight:700; color:' + color + ';">' + etiqueta + '</span></div>';
          });
        }
      }
      invEl.innerHTML = invHtml;
    }

    // ====== INVENTARIO ======
    var inventoryData = [];

    function renderInventario() {
      apiFetch('/api/inventory')
        .then(function(r) { return r.ok ? r.json() : []; })
        .then(function(data) {
          inventoryData = Array.isArray(data) ? data : [];
          renderInventoryTable();
          loadInventorySummary();
          loadInventoryConfig();
          loadMovementProductSelect();
          renderMovements();
        })
        .catch(function(e) { console.error('Error loading inventory:', e); });
    }

    function renderInventoryTable() {
      var estadoFiltro = (document.getElementById('inv-filter-estado') || {}).value || '';
      var busqueda = ((document.getElementById('inv-search') || {}).value || '').toLowerCase();
      var tbody = document.getElementById('inv-tbody');
      var empty = document.getElementById('inv-empty');
      if (!tbody) return;

      var filtered = inventoryData.filter(function(p) {
        if (estadoFiltro && p.estado !== estadoFiltro) return false;
        if (busqueda && p.nombre.toLowerCase().indexOf(busqueda) === -1) return false;
        return true;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
      }
      if (empty) empty.style.display = 'none';

      var html = '';
      filtered.forEach(function(p) {
        var estadoClass = p.estado === 'agotado' ? 'var(--danger)' : p.estado === 'bajo' ? 'var(--warning)' : p.estado === 'ok' ? 'var(--success)' : 'var(--text-muted)';
        var estadoText = p.estado === 'agotado' ? '⛔ Agotado' : p.estado === 'bajo' ? '⚠️ Bajo' : p.estado === 'ok' ? '✅ Ok' : '— Sin control';
        var stockDisplay = p.sinControl ? '—' : p.stock;
        html += '<tr style="border-bottom:1px solid var(--warm);">';
        html += '<td style="padding:12px 16px; font-weight:600;">' + p.nombre + '</td>';
        html += '<td style="padding:12px 16px; text-align:center;">RD$ ' + (p.precio || 0).toLocaleString() + '</td>';
        html += '<td style="padding:12px 16px; text-align:center; font-weight:700; font-size:1.1rem;">' + stockDisplay + '</td>';
        html += '<td style="padding:12px 16px; text-align:center;"><span style="color:' + estadoClass + '; font-weight:600;">' + estadoText + '</span></td>';
        html += '<td style="padding:12px 16px; text-align:right;">';
        html += '<div style="display:flex; gap:6px; justify-content:flex-end;">';
        html += '<button onclick="quickStockAdjust(' + p.id + ',\'' + p.nombre.replace(/'/g, "\\'") + '\',-1)" style="padding:4px 12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.85rem;" title="Restar 1">−1</button>';
        html += '<button onclick="quickStockAdjust(' + p.id + ',\'' + p.nombre.replace(/'/g, "\\'") + '\',1)" style="padding:4px 12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.85rem;" title="Sumar 1">+1</button>';
        html += '<button onclick="openStockAdjustModal(' + p.id + ')" style="padding:4px 12px; background:var(--accent); color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.85rem;">✏️</button>';
        html += '</div></td></tr>';
      });
      tbody.innerHTML = html;
    }

    function loadInventorySummary() {
      apiFetch('/api/inventory/summary')
        .then(function(r) { return r.ok ? r.json() : {}; })
        .then(function(s) {
          if (!s || s.error) return;
          setText('inv-total', s.totalProductos);
          setText('inv-con-stock', s.conStock);
          setText('inv-bajo', s.stockBajo);
          setText('inv-agotados', s.agotados);
          setText('inv-unidades', s.totalUnidades);
        })
        .catch(function(e) { console.error('Error loading summary:', e); });
    }

    function loadInventoryConfig() {
      apiFetch('/api/inventory/alerts')
        .then(function(r) { return r.ok ? r.json() : {}; })
        .then(function(c) {
          if (document.getElementById('inv-threshold')) document.getElementById('inv-threshold').value = c.umbralMinimo || 5;
          if (document.getElementById('inv-alerts-toggle')) document.getElementById('inv-alerts-toggle').checked = c.alertasActivas !== false;
        })
        .catch(function(e) { console.error('Error loading config:', e); });
    }

    function saveInventoryThreshold(val) {
      apiFetch('/api/inventory/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ umbralMinimo: parseInt(val) || 5 })
      }).then(function(r) {
        if (r.ok) showToast('Umbral guardado ✅', 'success');
        else showToast('Error al guardar umbral', 'error');
      }).catch(function(e) { showToast('Error de conexión', 'error'); });
    }

    function toggleInventoryAlerts(active) {
      apiFetch('/api/inventory/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertasActivas: active })
      }).then(function(r) {
        if (r.ok) showToast('Alertas ' + (active ? 'activadas' : 'desactivadas') + ' ✅', 'success');
        else showToast('Error al cambiar alertas', 'error');
      }).catch(function(e) { showToast('Error de conexión', 'error'); });
    }

    function openStockAdjustModal(productId) {
      var select = document.getElementById('adjust-producto');
      if (!select) return;
      select.innerHTML = '';
      inventoryData.forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre + ' (Stock: ' + (p.sinControl ? '—' : p.stock) + ')';
        select.appendChild(opt);
      });
      if (productId) select.value = productId;
      document.getElementById('stock-adjust-modal').style.display = 'flex';
    }

    function closeStockAdjustModal() {
      document.getElementById('stock-adjust-modal').style.display = 'none';
    }

    function saveStockAdjust() {
      var productoId = document.getElementById('adjust-producto').value;
      var tipo = document.getElementById('adjust-tipo').value;
      var cantidad = parseInt(document.getElementById('adjust-cantidad').value) || 1;
      var motivo = document.getElementById('adjust-motivo').value;
      if (!productoId) { showToast('Seleccioná un producto', 'error'); return; }
      apiFetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto_id: parseInt(productoId), tipo: tipo, cantidad: cantidad, motivo: motivo })
      })
      .then(function(r) { return r.ok ? r.json() : { error: 'Error de conexión' }; })
      .then(function(res) {
        if (res.success) {
          showToast(res.producto + ': ' + res.stock_anterior + ' → ' + res.stock_nuevo + ' unidades', 'success');
          closeStockAdjustModal();
          renderInventario();
        } else {
          showToast(res.error || 'Error al ajustar stock', 'error');
        }
      })
      .catch(function(e) { showToast('Error de conexión', 'error'); });
    }

    function quickStockAdjust(id, nombre, delta) {
      apiFetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto_id: id, tipo: delta > 0 ? 'entrada' : 'salida', cantidad: Math.abs(delta), motivo: 'Ajuste rápido' })
      })
      .then(function(r) { return r.ok ? r.json() : { error: 'Error de conexión' }; })
      .then(function(res) {
        if (res.success) {
          showToast(nombre + ': ' + res.stock_anterior + ' → ' + res.stock_nuevo, 'success');
          renderInventario();
        }
      })
      .catch(function(e) { showToast('Error de conexión', 'error'); });
    }

    function loadMovementProductSelect() {
      var select = document.getElementById('inv-mov-producto');
      if (!select) return;
      var currentVal = select.value;
      select.innerHTML = '<option value="">Todos los productos</option>';
      inventoryData.forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre;
        select.appendChild(opt);
      });
      if (currentVal) select.value = currentVal;
    }

    function renderMovements() {
      var container = document.getElementById('movements-list');
      if (!container) return;
      var productId = (document.getElementById('inv-mov-producto') || {}).value || '';
      var url = '/api/inventory/movements?limit=50';
      if (productId) url += '&producto_id=' + productId;
      apiFetch(url)
        .then(function(r) { return r.ok ? r.json() : []; })
        .then(function(movements) {
          if (!Array.isArray(movements) || movements.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:30px; color:var(--text-muted);">Sin movimientos registrados.</p>';
            return;
          }
          var html = '';
          movements.forEach(function(m) {
            var signo = (m.tipo === 'entrada' || m.tipo === 'compra' || m.tipo === 'devolucion') ? '+' : '-';
            var color = (m.tipo === 'entrada' || m.tipo === 'compra' || m.tipo === 'devolucion') ? 'var(--success)' : 'var(--danger)';
            var tipoTxt = m.tipo === 'venta' ? 'Venta' : m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'salida' ? 'Salida' : m.tipo === 'compra' ? 'Compra' : m.tipo === 'devolucion' ? 'Devolución' : 'Ajuste';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--warm);">';
            html += '<div style="flex:2;"><strong>' + (m.producto_nombre || 'Producto #' + m.producto_id) + '</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">' + tipoTxt + (m.motivo ? ' — ' + m.motivo : '') + (m.referencia ? ' (Ref: ' + m.referencia + ')' : '') + '</span></div>';
            html += '<div style="text-align:right;"><span style="font-weight:700; color:' + color + '; font-size:1.1rem;">' + signo + Math.abs(m.cantidad) + '</span>';
            if (m.stock_anterior !== null && m.stock_nuevo !== null) {
              html += '<br><span style="font-size:0.75rem; color:var(--text-muted);">' + m.stock_anterior + ' → ' + m.stock_nuevo + '</span>';
            }
            html += '<br><span style="font-size:0.75rem; color:var(--text-muted);">' + (m.created_at || '').split('.')[0] + '</span>';
            html += '</div></div>';
          });
          container.innerHTML = html;
        })
        .catch(function(e) { console.error('Error loading movements:', e); });
    }

    function setText(id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val;
    }

    if (sessionStorage.getItem('admin_logged') === 'true') {
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('admin-panel').classList.remove('hidden');
      loadData();
    }
