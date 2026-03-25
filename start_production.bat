@echo off
echo ===============================================================
echo 🚀 INICIANDO ESME COOKIES PRO PARA PRODUCCION 🚀
echo ===============================================================

REM Asegurarnos de estar en el directorio correcto
cd /d "%~dp0"

echo [1] Verificando variables de entorno en .env...
if not exist ".env" (
    echo X Error: Falta el archivo .env
    echo Por favor usa el comando respectivo para crearlo
    pause
    exit /b
)

echo [2] Instalando localtunnel si no está presente...
call npm install -g localtunnel

echo [3] Iniciando Servidor NodeJS en segundo plano...
REM Usamos el comando PM2 si estuviera instalado, pero para simplicidad 
REM usaremos Node estandar. Si falla, el script no se cierra de golpe.
start "Servidor Node" cmd /c "node server/server.js"

echo [4] Esperando a que el servidor arranque (3 segundos)...
timeout /t 3 >nul

echo [5] Exponiendo Servidor a Internet usando LocalTunnel...
echo -------------------------------------------------------------
echo 🌐 Cuando aparezca el link "your url is: https://...", 
echo    esa será la pagina pública para enviar a tus clientes!
echo -------------------------------------------------------------
call lt --port 3000

echo Presiona cualquier tecla para cerrar...
pause
