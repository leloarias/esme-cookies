@echo off
cd /d "%~dp0"
echo.
echo ========================================
echo    ESME COOKIES - Servidor de Pedidos
echo ========================================
echo.
echo Matando procesos anteriores...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo Iniciando servidor...
echo.
node server.js
