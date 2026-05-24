@echo off
chcp 65001 >nul 2>&1
title ClipVault Tests

cd /d "%~dp0"

:: Clean failed install if needed
if exist "node_modules" (
    if not exist "node_modules\vitest" (
        echo  Cleaning broken node_modules...
        rmdir /s /q node_modules 2>nul
    )
)

if not exist "node_modules" (
    echo  Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo.
)

echo.
echo  Running TDD tests...
echo  ========================
echo.

call npx vitest run

echo.
echo  ========================
pause
