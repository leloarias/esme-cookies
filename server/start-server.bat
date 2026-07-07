@echo off
cd /d "%~dp0"
start /B node server.js > server.log 2>&1
echo Servidor iniciado
timeout /t 2 >nul
