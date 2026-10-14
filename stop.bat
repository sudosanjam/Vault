@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0vault-app\scripts\stop.ps1" %*
ping 127.0.0.1 -n 2 >nul
