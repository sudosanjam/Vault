# Root Stop Script for Vault (PowerShell)
param (
    [int]$Port = 8000
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StopScript = Join-Path $ScriptDir "vault-app\scripts\stop.ps1"

if (-not (Test-Path $StopScript)) {
    Write-Error "Could not find vault-app\scripts\stop.ps1"
    exit 1
}

& $StopScript -Port $Port
