# Root Setup Script for Vault (PowerShell)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SetupScript = Join-Path $ScriptDir "vault-app\scripts\setup.ps1"

if (-not (Test-Path $SetupScript)) {
    Write-Error "Could not find vault-app\scripts\setup.ps1"
    exit 1
}

& $SetupScript @args
