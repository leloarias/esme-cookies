@echo off
title Esme Cookies - Servidor
cd /d "%~dp0"
echo ========================================
echo    ESME COOKIES - Servidor de Pedidos
echo ========================================
echo.

if not exist ".env" (
    echo [X] Falta el archivo .env
    echo     Copia .env.example a .env y completa las credenciales de Turso.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [*] Instalando dependencias por primera vez...
    call npm install
    echo.
)

echo [*] Iniciando servidor...
echo.
call npm start

echo.
echo El servidor se detuvo. Presiona una tecla para cerrar...
pause >nul
