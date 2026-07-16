@echo off
title Instagram CRM Server
echo ======================================================================
echo           InstaCRM - Sistema de Gestion y Automatizacion
echo ======================================================================
echo.

pushd "%~dp0"

:: Verificar Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Python 3.8+ antes de continuar.
    popd
    pause
    exit /b 1
)

:: Instalar dependencias
echo [INFO] Instalando/Actualizando dependencias de python (Flask, Requests)...
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Error al instalar dependencias con pip.
    popd
    pause
    exit /b 1
)

echo.
echo [INFO] Iniciando el servidor local de Flask en puerto 5000...
echo [INFO] Se abrira el navegador predeterminado automaticamente en segundos...
echo.

:: Iniciar el navegador con retraso para dar tiempo a Flask a arrancar
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5000"

:: Arrancar el servidor
python app.py

popd
pause
