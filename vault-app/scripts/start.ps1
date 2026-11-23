# Vault Server Launch Script (PowerShell)
# Launches the FastAPI server with SQLite cache and serves the React single-page app.
# Automatically detects if setup is needed and runs setup first if required.

param (
    [string]$VaultPath = "",
    [string]$HostIp = "0.0.0.0",
    [int]$Port = 8000,
    [switch]$NoBrowser,
    [switch]$ForceSetup,
    [switch]$Console
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$VenvPython = Join-Path $BackendDir "venv\Scripts\python.exe"
$VenvPythonw = Join-Path $BackendDir "venv\Scripts\pythonw.exe"
$DistIndex = Join-Path $FrontendDir "dist\index.html"
$TrayScript = Join-Path $ScriptDir "tray_app.py"

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

# Determine default vault path: check persistent session first
if (-not $VaultPath) {
    $parentDir = Split-Path -Parent $ProjectRoot
    $sessionFile = Join-Path $parentDir "vault_session.json"
    if (Test-Path $sessionFile) {
        try {
            $sess = Get-Content $sessionFile -Raw | ConvertFrom-Json
            if ($sess.active_vault_path -and (Test-Path $sess.active_vault_path)) {
                $VaultPath = $sess.active_vault_path
            }
        } catch {}
    }
}

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
$env:ALLOW_LAN = "true"

# Ensure Windows Firewall allows LAN sync connections on Port
try {
    $fw = Get-NetFirewallRule -DisplayName "Vault PKM Server" -ErrorAction SilentlyContinue
    if (-not $fw) {
        New-NetFirewallRule -DisplayName "Vault PKM Server" -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -ErrorAction SilentlyContinue | Out-Null
    }
} catch {}

# Check for existing active port listener
$existingConn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existingConn) {
    $owningPid = $existingConn[0].OwningProcess
    $isVaultRunning = $false
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:${Port}/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
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

if (-not $Console) {
    # Default: Run minimized in System Tray without desktop CLI
    Write-Host "Launching Vault minimized to System Tray..." -ForegroundColor Cyan
    $trayArgs = @(
        "`"$TrayScript`"",
        "--host", $HostIp,
        "--port", $Port.ToString(),
        "--vault-path", "`"$VaultPath`""
    )
    if ($NoBrowser) {
        $trayArgs += "--no-browser"
    }

    $runner = if (Test-Path $VenvPythonw) { $VenvPythonw } else { $VenvPython }
    Start-Process -FilePath $runner -ArgumentList $trayArgs
    Write-Host "[OK] Vault launched! Look for the retro Vault icon in your system tray." -ForegroundColor Green
    Write-Host "Opening web interface at http://${HostIp}:${Port}..." -ForegroundColor Green
    exit 0
}

# Foreground Console Mode
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "                    VAULT SYSTEM                        " -ForegroundColor Cyan
Write-Host "   Local-First Personal Knowledge Graph and PKM         " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Active Vault Root : $VaultPath" -ForegroundColor Green
Write-Host "Listening Address : http://${HostIp}:${Port}" -ForegroundColor Green
Write-Host "Console Mode      : Interactive / Foreground" -ForegroundColor Yellow
Write-Host "========================================================`n" -ForegroundColor Cyan

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
