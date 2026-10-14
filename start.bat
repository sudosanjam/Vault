@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0vault-app\scripts\start.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% neq 0 (
    echo.
    echo ========================================================
    echo [ERROR] Vault server stopped with an error (Code: %EXIT_CODE%).
    echo ========================================================
    pause
    exit /b %EXIT_CODE%
)
