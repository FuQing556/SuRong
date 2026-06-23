@echo off
title Xixi Game Server
cd /d "%~dp0"

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org
    pause
    exit
)

:: Check node_modules
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

:: Start
echo Starting server at http://localhost:3000
start "" http://localhost:3000
node server.js
pause
