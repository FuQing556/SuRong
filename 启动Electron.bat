@echo off
cd /d "%~dp0"
title Interactive Narrative Game - Electron

echo ============================================
echo   Interactive Narrative Game - Electron
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    echo          https://nodejs.org/
    pause
    exit /b 1
)

:: Check node_modules
if not exist "node_modules\" (
    echo [INFO] First run: installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: Check .env
if not exist ".env" (
    echo [WARN] .env file not found. Please create .env with your DEEPSEEK_API_KEY.
    echo        See .env.example for reference.
    echo.
)

echo [INFO] Starting Electron desktop app...
echo.

call npm run electron
pause
