@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo                    VAULT - Launching                    
echo ========================================================
echo.

set "ROOT_DIR=%~dp0"
set "SCRIPTS_DIR=%ROOT_DIR%vault-app\scripts"
set "BACKEND_VENV=%ROOT_DIR%vault-app\backend\venv"
set "FRONTEND_DIST=%ROOT_DIR%vault-app\frontend\dist"

:: Check if initial setup is needed
if not exist "%BACKEND_VENV%\Scripts\python.exe" (
    echo [!] First-time setup detected. Virtual environment not found.
    echo Running automated setup...
    echo.
    call "%ROOT_DIR%setup.bat"
)

if not exist "%SCRIPTS_DIR%\start.bat" (
    echo [ERROR] Could not find vault-app\scripts\start.bat
    pause
    exit /b 1
)

call "%SCRIPTS_DIR%\start.bat"
