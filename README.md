# 🍪 Esme Cookies — Sistema de Gestión de Pedidos

Aplicación web para gestionar los pedidos de Esme Cookies: catálogo para clientes,
panel de administración, pedidos en tiempo real, promociones, clientes y emails.

## Tecnología

- **Backend:** Node.js + Express
- **Base de datos:** libsql/SQLite (archivo local por defecto; opcionalmente remoto)
- **Tiempo real:** Socket.io
- **Imágenes:** Cloudinary
- **Emails:** Nodemailer (SMTP configurable desde el panel)
- **Auth:** JWT + bcrypt

## Requisitos

- Node.js 18 o superior
- (Opcional) Cuenta de Cloudinary para imágenes de productos

> **Sistema independiente:** por defecto la base de datos es un archivo local
> (`data/esme.db`), no necesita ninguna nube. Opcionalmente puede apuntar a una
> base remota con `DATABASE_URL`.

## Instalación

1. Instalá las dependencias:
   ```bash
   npm install
   ```

2. Copiá `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   Para uso local no hace falta cambiar nada (ya viene con la base local).
   Para producción, generá un `JWT_SECRET` fijo:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

3. (Opcional) Cargá datos de ejemplo para ver la app funcionando:
   ```bash
   npm run seed
   ```

4. Arrancá el servidor:
   ```bash
   npm start
   ```
   En Windows también podés hacer doble clic en **`Iniciar-Servidor.bat`**.

El servidor queda en `http://localhost:3001` (configurable con `PORT`).

## Rutas principales

| Ruta       | Descripción                          |
|------------|--------------------------------------|
| `/`        | Catálogo y checkout para clientes    |
| `/admin`   | Panel de administración              |
| `/health`  | Health check (para monitoreo)        |

El primer administrador se crea automáticamente si la base de datos no tiene ninguno,
usando `ADMIN_USER` / `ADMIN_PASS` del `.env`.

## Variables de entorno

Ver `.env.example` para la lista completa. Las principales:

| Variable              | Descripción                                             |
|-----------------------|---------------------------------------------------------|
| `DATABASE_URL`        | Base de datos. Local por defecto (`file:data/esme.db`)  |
| `DATABASE_AUTH_TOKEN` | Token, solo si usás una base remota                     |
| `JWT_SECRET`          | Clave fija para firmar sesiones (obligatoria en prod)   |
| `PORT`                | Puerto del servidor (por defecto 3001)                  |
| `NODE_ENV`            | `development` o `production`                             |
| `APP_URL`             | URL pública (para los links del panel en los emails)    |
| `CLOUDINARY_*`        | Credenciales de Cloudinary para subir imágenes          |

> La configuración de email (SMTP), datos de la tienda y cuentas bancarias se
> administran desde el **panel de admin**, no desde el `.env`.

## Estructura del proyecto

```
esme-cookies/
├── .env / .env.example      # Variables de entorno
├── package.json             # Dependencias y scripts
├── Iniciar-Servidor.bat     # Lanzador rápido en Windows
├── public/                  # Frontend (index.html, admin.html, css)
├── scripts/                 # Utilidades de mantenimiento (reset-admin, etc.)
└── src/                     # Código del backend
    ├── server.js            # Arranque: HTTP + Socket.io + tareas periódicas
    ├── app.js               # Configuración de Express (monta las rutas)
    ├── config/              # Cloudinary
    ├── db/                  # Conexión a la base + esquema + migraciones
    ├── middleware/          # auth (JWT), security (cabeceras)
    ├── routes/              # Rutas de la API por dominio
    ├── services/            # Lógica de negocio (promociones, clientes, email…)
    └── utils/               # Helpers (teléfono, fecha, sanitización)
```

## Despliegue (servidor propio / OMV)

En producción se usa [PM2](https://pm2.keymetrics.io):
```bash
NODE_ENV=production pm2 start src/server.js --name esme-cookies
```
Recordá definir un `JWT_SECRET` fijo en el `.env` y `PORT=3001`.
