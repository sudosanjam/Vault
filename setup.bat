@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0vault-app\scripts\setup.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% neq 0 (
    echo.
    echo ========================================================
    echo [ERROR] Vault setup encountered an error (Code: %EXIT_CODE%).
    echo ========================================================
    pause
    exit /b %EXIT_CODE%
) else (
    echo.
    echo ========================================================
    echo [SUCCESS] Vault setup completed successfully!
    echo Double-click start.bat to launch Vault.
    echo ========================================================
    pause
)
