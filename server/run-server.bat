@echo off
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:start
echo Starting server...
node server.js >> server.log 2>&1
echo Server stopped, restarting in 5 seconds...
timeout /t 5 >nul
goto start
