@echo off
title Install Dependencies
cd /d "%~dp0"

echo Installing dependencies, please wait...
call npm install

if %errorlevel% equ 0 (
    echo.
    echo Done! Now double-click '启动游戏.bat' to play.
) else (
    echo.
    echo Install failed. Please check your network and try again.
)
pause
