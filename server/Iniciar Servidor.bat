@echo off
title Esme Cookies Server
color 0A
cd /d "%~dp0"
echo.
echo  ========================================
echo     ESME COOKIES - Servidor de Pedidos
echo  ========================================
echo.
node server.js
if errorlevel 1 (
    echo.
    echo Error al iniciar. Presiona una tecla para salir...
    pause >nul
)
