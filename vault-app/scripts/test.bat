@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"
set "PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=python"
)

echo ========================================================
echo              VAULT - Comprehensive Test Suite           
echo ========================================================
echo.

echo [1/2] Running Backend Tests (pytest)...
cd /d "%BACKEND_DIR%"
"%PYTHON_EXE%" -m pytest -v --tb=short
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Backend tests failed!
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Running Frontend Type Check ^& Build...
cd /d "%FRONTEND_DIR%"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Frontend build failed!
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo       All Vault Tests and Builds PASSED! (100%)
echo ========================================================
cd /d "%PROJECT_ROOT%"
pause
