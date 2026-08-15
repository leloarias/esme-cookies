// Configuración de PM2 para producción (OpenMediaVault).
// Uso: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'esme-cookies',
      script: 'src/server.js',
      cwd: __dirname,

      // Una sola instancia, en modo fork (NO cluster): el rate-limit de
      // login (loginAttempts) y las salas de Socket.io (admins) viven en
      // memoria del proceso — con varias instancias cada una tendría su
      // propio estado, y el rate-limit y los avisos en vivo dejarían de
      // funcionar bien.
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production'
      },

      autorestart: true,
      watch: false,
      max_memory_restart: '300M',

      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      time: true
    }
  ]
};
