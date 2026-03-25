# Esme Cookies - Sistema de Gestión de Pedidos

Sistema de gestión de pedidos para Esme Cookies con conexión automática a Excel.

## Requisitos

- Node.js 16+ 
- npm

## Instalación

1. Abre una terminal en la carpeta del proyecto
2. Instala las dependencias:
```bash
npm install
```

3. Instala Electron:
```bash
npm install electron@28.0.0 --save-dev
```

## Uso

1. **Ejecuta la aplicación:**
```bash
npm start
```

2. **Primera ejecución:**
   - La aplicación buscará automáticamente un archivo Excel (.xlsx o .xls) en la misma carpeta
   - Si no encuentra ninguno, puedes abrir uno manualmente con el botón "📂 Abrir"

3. **Guardado automático:**
   - Cada cambio se guarda automáticamente después de 5 segundos de inactividad
   - También puedes guardar manualmente con Ctrl+S o el botón "💾 Guardar"

## Archivo Excel

El sistema espera un archivo Excel con al menos dos hojas:

### Hoja "Registro Pedidos" (o similar)
| Columna | Descripción |
|---------|-------------|
| Fecha | Fecha del pedido |
| No. Pedido | Número único |
| Cliente | Nombre del cliente |
| Teléfono | WhatsApp |
| Productos | Lista de productos |
| Cantidad | Cantidad total |
| Subtotal | Subtotal sin envío |
| Envío | Costo de envío |
| Total | Total final |
| Método de Pago | Transferencia/Efectivo/etc |
| Estado | Pendiente/Confirmado/etc |
| Observaciones | Notas |

### Hoja "Productos" (o similar)
| Columna | Descripción |
|---------|-------------|
| Producto | Nombre del producto |
| Precio | Precio en RD$ |

## Atajos de Teclado

- `Ctrl+N` - Nuevo pedido
- `Ctrl+O` - Abrir archivo Excel
- `Ctrl+S` - Guardar cambios
- `Ctrl+Q` - Salir

## Ubicación de archivos

- Los datos del último archivo abierto se guardan en la carpeta de configuración de Electron
- En Windows: `%APPDATA%\esme-cookies\`
