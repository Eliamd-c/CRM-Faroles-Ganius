@echo off
title CMR Faroles - Node.js Server
echo ======================================================================
echo           CMR Faroles - Sistema de Gestion y Automatizacion
echo ======================================================================
echo.

pushd "%~dp0"

:: Verificar Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Node.js (LTS recomendado) desde https://nodejs.org/
    popd
    pause
    exit /b 1
)

:: Instalar dependencias de Node.js
if not exist node_modules (
    echo [INFO] Carpeta node_modules no encontrada. Instalando dependencias...
    call npm install
) else (
    echo [INFO] Dependencias ya instaladas. Verificando actualizaciones...
    call npm install
)

if %errorlevel% neq 0 (
    echo [ERROR] Hubo un error al ejecutar 'npm install'.
    popd
    pause
    exit /b 1
)

echo.
echo [INFO] Iniciando el servidor de Node.js en puerto 5000...
echo [INFO] Se abrira el navegador predeterminado automaticamente en segundos...
echo.

:: Iniciar el navegador con un pequeño retraso
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5000"

:: Arrancar el servidor Express
node app.js

popd
pause
