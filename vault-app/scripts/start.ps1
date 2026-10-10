# Vault Server Launch Script (PowerShell)
# Launches the FastAPI server with SQLite cache and serves the React single-page app.

param (
    [string]$VaultPath = "",
    [string]$HostIp = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$NoBrowser
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"
$PythonExe = Join-Path $BackendDir "venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

# Determine default vault path if not specified
if (-not $VaultPath) {
    $DefaultSample = Join-Path (Split-Path -Parent $ProjectRoot) "VaultSample"
    if (Test-Path $DefaultSample) {
        $VaultPath = $DefaultSample
    } else {
        $VaultPath = Join-Path (Split-Path -Parent $ProjectRoot) "VaultData"
    }
}

$env:VAULT_DIRECTORY = $VaultPath
$env:HOST = $HostIp
$env:PORT = $Port.ToString()

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "                    VAULT SYSTEM                        " -ForegroundColor Cyan
Write-Host "   Local-First Personal Knowledge Graph and PKM         " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Active Vault Root : $VaultPath" -ForegroundColor Green
Write-Host "Listening Address : http://${HostIp}:${Port}" -ForegroundColor Green
Write-Host "Network Isolation : Loopback Only (Zero Cloud)" -ForegroundColor Gray
Write-Host "========================================================`n" -ForegroundColor Cyan

# Open browser in background if requested
if (-not $NoBrowser) {
    Start-Job -ScriptBlock {
        param($url)
        Start-Sleep -Seconds 2
        Start-Process $url
    } -ArgumentList "http://${HostIp}:${Port}" | Out-Null
}

Push-Location $BackendDir
& $PythonExe -m uvicorn app.main:app --host $HostIp --port $Port --log-level info
Pop-Location
