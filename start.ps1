# Root Start Script for Vault (PowerShell)
param (
    [string]$VaultPath = "",
    [string]$HostIp = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$NoBrowser
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $ScriptDir "vault-app\backend\venv\Scripts\python.exe"

# If first-time run, run setup first
if (-not (Test-Path $VenvPython)) {
    Write-Host "[!] First-time run detected. Running automated setup..." -ForegroundColor Yellow
    $SetupScript = Join-Path $ScriptDir "setup.ps1"
    & $SetupScript
}

$StartScript = Join-Path $ScriptDir "vault-app\scripts\start.ps1"
if (-not (Test-Path $StartScript)) {
    Write-Error "Could not find vault-app\scripts\start.ps1"
    exit 1
}

& $StartScript -VaultPath $VaultPath -HostIp $HostIp -Port $Port -NoBrowser:$NoBrowser
