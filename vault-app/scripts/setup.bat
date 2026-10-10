@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo              VAULT - Environment Setup                  
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"
set "VENV_DIR=%BACKEND_DIR%\venv"

echo.
echo [1/4] Setting up Python Virtual Environment...
if not exist "%VENV_DIR%" (
    echo Creating virtualenv at %VENV_DIR%...
    python -m venv "%VENV_DIR%"
)

set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=python"
)

echo Upgrading pip...
"%PYTHON_EXE%" -m pip install --upgrade pip

echo Installing backend requirements...
"%PYTHON_EXE%" -m pip install -r "%BACKEND_DIR%\requirements.txt"

echo.
echo [2/4] Installing Headless Chromium for PDF rendering...
"%PYTHON_EXE%" -m playwright install chromium

echo.
echo [3/4] Installing Frontend Node Dependencies...
cd /d "%FRONTEND_DIR%"
call npm install

echo.
echo [4/4] Building Frontend Production Assets...
call npm run build

echo.
echo ========================================================
echo        Vault Setup Completed Successfully!
echo ========================================================
echo To launch Vault, run: scripts\start.bat
cd /d "%PROJECT_ROOT%"
pause
