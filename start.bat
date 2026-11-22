@echo off
setlocal
cd /d "%~dp0"

if exist "%~dp0vault.exe" (
    start "" "%~dp0vault.exe" %*
    exit /b 0
)

if not exist "%~dp0vault-app\backend\venv\Scripts\python.exe" goto :do_setup
if not exist "%~dp0vault-app\frontend\dist\index.html" goto :do_setup

:run_app
start "" "%~dp0vault-app\backend\venv\Scripts\pythonw.exe" "%~dp0vault-app\scripts\tray_app.py" %*
exit /b 0

:do_setup
echo ========================================================
echo [!] Initial setup or build required before launch.
echo     Running one-click environment setup...
echo ========================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0vault-app\scripts\setup.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Setup failed with code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)
goto :run_app
