@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Chybi Node.js / npm. Nainstaluj Node.js LTS a zkus to znovu.
  pause
  exit /b 1
)
if not exist "node_modules\electron" (
  echo Prvni spusteni: instaluji potrebne balicky...
  call npm install
  if errorlevel 1 (
    echo Instalace se nezdarila. Zkontroluj internet.
    pause
    exit /b 1
  )
)
call npm start
if errorlevel 1 pause
