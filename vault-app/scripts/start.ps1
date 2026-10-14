# Vault Server Launch Script (PowerShell)
# Launches the FastAPI server with SQLite cache and serves the React single-page app.
# Automatically detects if setup is needed and runs setup first if required.

param (
    [string]$VaultPath = "",
    [string]$HostIp = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$NoBrowser,
    [switch]$ForceSetup
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$VenvPython = Join-Path $BackendDir "venv\Scripts\python.exe"
$DistIndex = Join-Path $FrontendDir "dist\index.html"

# Verify initial setup requirements
$needsSetup = $ForceSetup -or (-not (Test-Path $VenvPython)) -or (-not (Test-Path $DistIndex))

if ($needsSetup) {
    Write-Host "========================================================" -ForegroundColor Yellow
    Write-Host "[!] Initial setup or build required before launch." -ForegroundColor Yellow
    Write-Host "    Running one-click environment setup..." -ForegroundColor Yellow
    Write-Host "========================================================`n" -ForegroundColor Yellow

    $SetupScript = Join-Path $ScriptDir "setup.ps1"
    & $SetupScript
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        Write-Host "`n[ERROR] Automated setup failed with exit code $LASTEXITCODE." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

if (-not (Test-Path $VenvPython)) {
    Write-Host "[ERROR] Could not find Python virtualenv at $VenvPython" -ForegroundColor Red
    Write-Host "Please run setup.bat or setup.ps1 first." -ForegroundColor Red
    exit 1
}

# Determine default vault path if not specified
if (-not $VaultPath) {
    $parentDir = Split-Path -Parent $ProjectRoot
    $sampleVault = Join-Path $parentDir "VaultSample"
    if (Test-Path $sampleVault) {
        $VaultPath = $sampleVault
    } else {
        $VaultPath = Join-Path $parentDir "VaultData"
    }
}

# Ensure vault directory exists
if (-not (Test-Path $VaultPath)) {
    New-Item -ItemType Directory -Path $VaultPath -Force | Out-Null
}

$env:VAULT_DIRECTORY = $VaultPath
$env:HOST = $HostIp
$env:PORT = $Port.ToString()

# Check for existing active port listener
$existingConn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existingConn) {
    $owningPid = $existingConn[0].OwningProcess
    $isVaultRunning = $false
    try {
        $health = Invoke-RestMethod -Uri "http://${HostIp}:${Port}/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($health -and $health.app -eq "Vault") {
            $isVaultRunning = $true
        }
    } catch {}

    if ($isVaultRunning) {
        Write-Host "========================================================" -ForegroundColor Cyan
        Write-Host "[INFO] An active Vault instance is already running!    " -ForegroundColor Cyan
        Write-Host "Address : http://${HostIp}:${Port} (PID: $owningPid)" -ForegroundColor Green
        Write-Host "========================================================" -ForegroundColor Cyan
        Write-Host "Opening your browser to the active Vault instance..." -ForegroundColor Green
        if (-not $NoBrowser) {
            Start-Process "http://${HostIp}:${Port}"
        }
        Write-Host "`nTo shut down the running server, run: stop.bat or stop.ps1" -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "[WARN] Port $Port is currently occupied by PID $owningPid." -ForegroundColor Yellow
        Write-Host "       If the server fails to bind, specify another port via: .\start.ps1 -Port 8080" -ForegroundColor Yellow
    }
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "                    VAULT SYSTEM                        " -ForegroundColor Cyan
Write-Host "   Local-First Personal Knowledge Graph and PKM         " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Active Vault Root : $VaultPath" -ForegroundColor Green
Write-Host "Listening Address : http://${HostIp}:${Port}" -ForegroundColor Green
Write-Host "Network Isolation : Loopback Only (Zero Cloud)" -ForegroundColor Gray
Write-Host "Single-Origin SPA : Enabled (frontend\dist)" -ForegroundColor Gray
Write-Host "========================================================`n" -ForegroundColor Cyan

# Open browser when server responds healthy
if (-not $NoBrowser) {
    Start-Job -ScriptBlock {
        param($url)
        $maxTries = 40
        for ($i = 0; $i -lt $maxTries; $i++) {
            Start-Sleep -Milliseconds 400
            try {
                $res = Invoke-WebRequest -Uri "$url/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
                if ($res -and $res.StatusCode -eq 200) {
                    Start-Process $url
                    break
                }
            } catch {}
        }
    } -ArgumentList "http://${HostIp}:${Port}" | Out-Null
}

Push-Location $BackendDir
try {
    & $VenvPython -m uvicorn app.main:app --host $HostIp --port $Port --log-level info
} finally {
    Pop-Location
}
