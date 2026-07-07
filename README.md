# 🍪 Esme Cookies — Sistema de Gestión de Pedidos

Aplicación web para gestionar los pedidos de Esme Cookies: catálogo para clientes,
panel de administración, pedidos en tiempo real, promociones, clientes y emails.

## Tecnología

- **Backend:** Node.js + Express
- **Base de datos:** [Turso](https://turso.tech) (libsql, en la nube)
- **Tiempo real:** Socket.io
- **Imágenes:** Cloudinary
- **Emails:** Nodemailer (SMTP configurable desde el panel)
- **Auth:** JWT + bcrypt

## Requisitos

- Node.js 18 o superior
- Una base de datos Turso (URL + token)
- (Opcional) Cuenta de Cloudinary para imágenes de productos

## Instalación

1. Instalá las dependencias:
   ```bash
   npm install
   ```

2. Copiá `.env.example` a `.env` y completá los valores reales:
   ```bash
   cp .env.example .env
   ```
   Como mínimo necesitás `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` y un `JWT_SECRET`.
   Para generar un `JWT_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

3. Arrancá el servidor:
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
| `TURSO_DATABASE_URL`  | URL de la base de datos Turso                           |
| `TURSO_AUTH_TOKEN`    | Token de acceso a Turso                                 |
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
└── server/
    ├── server.js            # Servidor Express + rutas
    ├── database.js          # Conexión Turso + esquema
    ├── auth.js              # JWT (login admin)
    ├── email.js             # Envío de emails
    └── public/              # Frontend (index.html, admin.html)
```

## Despliegue (servidor propio / OMV)

En producción se usa [PM2](https://pm2.keymetrics.io):
```bash
NODE_ENV=production pm2 start server/server.js --name esme-cookies
```
Recordá definir un `JWT_SECRET` fijo en el `.env` y `PORT=3001`.
