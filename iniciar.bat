@echo off
chcp 65001 >nul
title Radar Lite - Buscador y Auditor de Prospectos B2B

echo.
echo  =============================================================
echo    RADAR LITE ^· BUSCADOR Y AUDITOR DE PROSPECTOS B2B
echo  =============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [AVISO] Node.js no fue detectado en tu sistema.
    echo.
    echo  Descargalo gratis desde: https://nodejs.org/ ^(boton verde LTS^)
    echo.
    start https://nodejs.org/
    pause
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo  [OK] Archivo .env preparado.
    ) else (
        echo PORT=3000 > .env
    )
)

if not exist "node_modules" (
    echo  [INFO] Primera ejecucion: instalando dependencias ligeras...
    call npm install --omit=dev
    if %errorlevel% neq 0 (
        echo  [ERROR] Fallo la instalacion con npm. Verifica tu internet.
        pause
        exit /b 1
    )
)

echo.
echo  =============================================================
echo    Iniciando en http://localhost:3000
echo    Abriendo tu navegador web...
echo    ^(Para cerrar la aplicacion, cierra esta ventana^)
echo  =============================================================
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
node server.mjs
pause
