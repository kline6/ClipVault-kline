@echo off
chcp 65001 >nul 2>&1
title ClipVault - Build .exe

cd /d "%~dp0"

echo.
echo  ================================
echo   ClipVault - Build to .exe
echo  ================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found
    pause
    exit /b 1
)

echo  Starting build...
echo.
call node build.mjs

echo.
pause
