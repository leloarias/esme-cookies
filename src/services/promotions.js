// Motor de promociones/descuentos que se aplica al crear un pedido.
// Extraído del handler POST /api/orders para poder testearlo por separado.

// Filtra las promociones activas dejando solo las vigentes según límite de usos,
// rango de fechas y rango de horas (en hora de República Dominicana).
function filtrarPromocionesVigentes(promos, currentDate, currentTime) {
  return promos.filter(p => {
    if (p.limite_usos && p.limite_usos > 0) {
      const usosActuales = p.usos_actuales || 0;
      if (usosActuales >= p.limite_usos) {
        console.log(`[Order Debug] Promo ${p.titulo} rechazada: límite de usos alcanzado (${usosActuales}/${p.limite_usos})`);
        return false;
      }
    }
    if (p.fecha_inicio && p.fecha_inicio > currentDate) return false;
    if (p.fecha_fin && p.fecha_fin < currentDate) return false;
    if (p.hora_inicio && p.hora_inicio > currentTime) return false;
    if (p.hora_fin && p.hora_fin < currentTime) return false;
    return true;
  });
}

// Evalúa las promociones vigentes contra el carrito y devuelve el descuento
// total sobre productos, el descuento de envío y las promos aplicadas.
// ctx: { subTotalNum, tipoEntrega, totalItems, envio, precio, cartItemsArr }
function evaluarPromociones(promosActivas, ctx) {
  const { subTotalNum, tipoEntrega, totalItems, envio, precio, cartItemsArr = [] } = ctx;

  let descuentoTotal = 0;
  let envioDescuento = 0;
  let promosAplicadas = [];

  promosActivas.forEach(promo => {
    let aplica = false;
    let ahorro = 0;

    if (promo.compra_minima > 0 && subTotalNum < promo.compra_minima) {
      console.log(`[Order Debug] Promo ${promo.titulo} rechazada: compra_minima ${promo.compra_minima} > ${subTotalNum}`);
      return;
    }
    if (promo.cantidad_minima > 0 && totalItems < promo.cantidad_minima) {
      console.log(`[Order Debug] Promo ${promo.titulo} rechazada: cantidad_minima ${promo.cantidad_minima} > ${totalItems}`);
      return;
    }

    // Solo cajas: solo aplicar si el carrito tiene un item de tipo caja (id == 7)
    if (promo.solo_cajas) {
      const hasBox = cartItemsArr.some(item => Number(item.id) === 7);
      if (!hasBox) {
        console.log(`[Order Debug] Promo ${promo.titulo} rechazada: solo_cajas activo pero el carrito no tiene caja`);
        return;
      }
    }

    switch (promo.tipo) {
      case 'descuento_pct':
        ahorro = Math.round(subTotalNum * (promo.descuento_pct / 100));
        aplica = ahorro > 0;
        break;
      case 'descuento_fijo':
        ahorro = promo.descuento_fijo;
        aplica = subTotalNum > 0;
        break;
      case 'free_delivery':
        if (tipoEntrega === 'delivery') {
          envioDescuento = parseFloat(envio) || 0;
          ahorro = envioDescuento;
          aplica = true;
        }
        break;
      case 'free_envio':
        if (tipoEntrega === 'envio') {
          envioDescuento = parseFloat(envio) || 0;
          ahorro = envioDescuento;
          aplica = true;
        }
        break;
      case 'free_all':
        if (tipoEntrega !== 'pickup') {
          envioDescuento = parseFloat(envio) || 0;
          ahorro = envioDescuento;
          aplica = true;
        }
        break;
      case 'bogo':
        if (totalItems >= 3) {
          let precios = [];
          if (cartItemsArr.length > 0) {
            cartItemsArr.forEach(item => {
              for (let i = 0; i < item.qty; i++) precios.push(item.precio);
            });
          } else if (precio) {
            precios = String(precio).split(',').map(p => parseFloat(p.trim()) || 0).filter(p => p > 0);
          }

          if (precios.length >= 3) {
            const gruposGratuitos = Math.floor(precios.length / 3);
            precios.sort((a, b) => a - b);
            ahorro = precios.slice(0, gruposGratuitos).reduce((a, b) => a + b, 0);
            aplica = true;
          }
        }
        break;
    }

    if (aplica && ahorro > 0) {
      descuentoTotal += (promo.tipo.startsWith('free_') ? 0 : ahorro);
      promosAplicadas.push({
        id: promo.id,
        tipo: promo.tipo,
        titulo: promo.titulo,
        ahorro: ahorro
      });
    }
  });

  return { descuentoTotal, envioDescuento, promosAplicadas };
}

module.exports = { filtrarPromocionesVigentes, evaluarPromociones };
