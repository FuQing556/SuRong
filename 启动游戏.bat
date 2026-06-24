@echo off
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js not found: https://nodejs.org
    pause
    exit
)

if not exist "node_modules\" (
    echo Installing...
    npm install
)

echo Starting at http://localhost:3000
echo.
start http://localhost:3000
node server.js
pause
