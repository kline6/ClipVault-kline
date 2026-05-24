@echo off
chcp 65001 >nul 2>&1
title ClipVault

cd /d "%~dp0"

echo.
echo  ================================
echo   ClipVault - Clipboard Manager
echo  ================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found
    echo  Download: https://nodejs.org
    pause
    exit /b 1
)

if exist "node_modules" (
    if not exist "node_modules\vitest" (
        echo  Cleaning broken node_modules...
        rmdir /s /q node_modules 2>nul
    )
)

if not exist "node_modules" (
    echo  [1/2] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo  [OK] Done
) else (
    echo  [OK] Dependencies ready
)

echo  [2/2] Starting ClipVault...
echo.

call npx electron .
