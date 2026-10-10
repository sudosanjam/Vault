@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=python"
)

if "%VAULT_DIRECTORY%"=="" (
    if exist "%PROJECT_ROOT%\..\VaultSample" (
        set "VAULT_DIRECTORY=%PROJECT_ROOT%\..\VaultSample"
    ) else (
        set "VAULT_DIRECTORY=%PROJECT_ROOT%\..\VaultData"
    )
)


if "%HOST%"=="" (
    set "HOST=127.0.0.1"
)

if "%PORT%"=="" (
    set "PORT=8000"
)

echo ========================================================
echo                    VAULT SYSTEM                        
echo   Local-First Personal Knowledge Graph and PKM         
echo ========================================================
echo Active Vault Root : %VAULT_DIRECTORY%
echo Listening Address : http://%HOST%:%PORT%
echo Network Isolation : Loopback Only (Zero Cloud)
echo ========================================================
echo.

start "" "http://%HOST%:%PORT%"

cd /d "%BACKEND_DIR%"
"%PYTHON_EXE%" -m uvicorn app.main:app --host %HOST% --port %PORT% --log-level info
pause
