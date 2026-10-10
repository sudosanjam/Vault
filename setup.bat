@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo                 VAULT - One-Click Setup                
echo ========================================================
echo.

set "ROOT_DIR=%~dp0"
set "SCRIPTS_DIR=%ROOT_DIR%vault-app\scripts"

if not exist "%SCRIPTS_DIR%\setup.bat" (
    echo [ERROR] Could not find vault-app\scripts\setup.bat
    echo Please make sure you are running this from the repository root.
    pause
    exit /b 1
)

echo Starting environment setup...
call "%SCRIPTS_DIR%\setup.bat"
