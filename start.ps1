# Root Launch Script for Vault (PowerShell)
param (
    [string]$VaultPath = "",
    [string]$HostIp = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$NoBrowser,
    [switch]$ForceSetup
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $ScriptDir "vault-app\scripts\start.ps1"

if (-not (Test-Path $StartScript)) {
    Write-Error "Could not find vault-app\scripts\start.ps1"
    exit 1
}

& $StartScript -VaultPath $VaultPath -HostIp $HostIp -Port $Port -NoBrowser:$NoBrowser -ForceSetup:$ForceSetup
