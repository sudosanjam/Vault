@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo                 Stopping Vault Server                   
echo ========================================================

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Terminating server process (PID %%a)...
    taskkill /f /pid %%a >nul 2>&1
    set FOUND=1
)

if %FOUND%==0 (
    echo No active Vault server process found listening on port 8000.
) else (
    echo Vault server has been shut down successfully.
)

echo.
timeout /t 2 >nul
