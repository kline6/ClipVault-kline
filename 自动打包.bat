@echo off
title ClipVault - Auto Build
cd /d "%~dp0"

echo.
echo  ================================
echo   ClipVault - Auto Build
echo  ================================
echo.

echo  [1/3] Killing old processes...
taskkill /F /IM ClipVault.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
echo  [OK] Done

echo.
echo  [2/3] Cleaning dist folder...
if not exist dist goto NO_DIST
rmdir /s /q dist
echo  [OK] dist deleted
goto DIST_DONE
:NO_DIST
echo  [OK] dist not found, skipping
:DIST_DONE

echo.
echo  [3/3] Building...
echo.
node build.mjs
if errorlevel 1 goto FAILED

echo.
echo  ================================
echo   BUILD SUCCESS!
echo  ================================
goto END

:FAILED
echo.
echo  ================================
echo   BUILD FAILED - see above
echo  ================================

:END
echo.
pause
