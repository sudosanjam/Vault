@echo off
setlocal
cd /d "%~dp0"

set "PROJECT_ROOT=%~dp0.."
if not exist "%PROJECT_ROOT%\backend\venv\Scripts\python.exe" goto :do_setup
if not exist "%PROJECT_ROOT%\frontend\dist\index.html" goto :do_setup

:run_app
start "" "%PROJECT_ROOT%\backend\venv\Scripts\pythonw.exe" "%~dp0tray_app.py" %*
exit /b 0

:do_setup
echo ========================================================
echo [!] Initial setup or build required before launch.
echo     Running one-click environment setup...
echo ========================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Setup failed with code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)
goto :run_app
