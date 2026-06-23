@echo off
chcp 65001 >nul
title 互动叙事 · 苏蓉蓉
cd /d "%~dp0"

echo.
echo   🎮 互动叙事 · 苏蓉蓉
echo   ────────────────────────────────────────
echo.

:: 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   ❌ 未检测到 Node.js，请先安装：
    echo   https://nodejs.org （下载 LTS 版本）
    echo.
    echo   安装后重新双击本文件即可。
    pause
    exit /b
)

:: 检查依赖
if not exist "node_modules\" (
    echo   ⏳ 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo   ❌ 安装失败，请检查网络后重试
        pause
        exit /b
    )
    echo   ✅ 依赖安装完成
    echo.
)

:: 检查 .env 中的 key
findstr /C:"sk-placeholder" ".env" >nul 2>nul
if %errorlevel% equ 0 (
    echo   ⚠ 未配置 API Key，请编辑 .env 文件填入 DeepSeek Key
    echo   获取地址：https://platform.deepseek.com/api_keys
    pause
    exit /b
)

:: 启动
echo   🟢 正在启动...
start "" http://localhost:3000
node server.js
pause
