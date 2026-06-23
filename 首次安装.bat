@echo off
chcp 65001 >nul
title 安装依赖 · 互动叙事
cd /d "%~dp0"

echo.
echo   📦 正在安装依赖，首次运行需要1-2分钟...
echo   ────────────────────────────────────────
echo.

call npm install

echo.
echo   ✅ 安装完成！
echo   ────────────────────────────────────────
echo   🎮 以后直接双击「启动游戏.bat」即可
echo.
pause
