# Script to cleanly stop the Vault server and system tray process (PowerShell)
param (
    [int]$Port = 8000
)

$ErrorActionPreference = "SilentlyContinue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"
$PidFile = Join-Path $BackendDir ".vault.pid"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "            Stopping Vault Server & Tray App            " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$stoppedCount = 0

# 1. Stop PID from .vault.pid if present
if (Test-Path $PidFile) {
    try {
        $savedPid = Get-Content $PidFile -ErrorAction SilentlyContinue
        if ($savedPid -match '^\d+$') {
            $p = Get-Process -Id [int]$savedPid -ErrorAction SilentlyContinue
            if ($p) {
                Stop-Process -Id [int]$savedPid -Force -ErrorAction SilentlyContinue
                Write-Host "[OK] Terminated saved server process (PID: $savedPid)" -ForegroundColor Green
                $stoppedCount++
            }
        }
    } catch {}
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# 2. Stop any process listening on Port
$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        $procId = $conn.OwningProcess
        try {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Terminated listener process (PID: $procId)" -ForegroundColor Green
            $stoppedCount++
        } catch {}
    }
}

# 3. Stop any stray tray_app.py Python processes
try {
    $trayProcs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*tray_app.py*" }
    foreach ($tp in $trayProcs) {
        Stop-Process -Id $tp.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Terminated tray app process (PID: $($tp.ProcessId))" -ForegroundColor Green
        $stoppedCount++
    }
} catch {}

if ($stoppedCount -gt 0) {
    Write-Host "`nVault server and system tray app have been shut down cleanly." -ForegroundColor Green
} else {
    Write-Host "`nNo active Vault server or tray process was found running." -ForegroundColor Gray
}
Write-Host "========================================================" -ForegroundColor Cyan
