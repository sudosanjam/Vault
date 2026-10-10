# Vault One-Click Setup Script (PowerShell)
# Sets up Python virtual environment, installs backend dependencies and Playwright Chromium,
# installs frontend npm dependencies, and builds the frontend production bundle.

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "             VAULT - Environment Setup                  " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Backend Setup
Write-Host "`n[1/4] Setting up Python Virtual Environment..." -ForegroundColor Yellow
$VenvDir = Join-Path $BackendDir "venv"
if (-not (Test-Path $VenvDir)) {
    Write-Host "Creating Python venv at $VenvDir..."
    python -m venv $VenvDir
}

$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

Write-Host "Upgrading pip..."
& $PythonExe -m pip install --upgrade pip

Write-Host "Installing backend requirements..."
$ReqFile = Join-Path $BackendDir "requirements.txt"
& $PythonExe -m pip install -r $ReqFile

Write-Host "`n[2/4] Installing Headless Chromium for PDF Export..." -ForegroundColor Yellow
& $PythonExe -m playwright install chromium

# 2. Frontend Setup
Write-Host "`n[3/4] Installing Frontend Node Dependencies..." -ForegroundColor Yellow
Push-Location $FrontendDir
npm install

Write-Host "`n[4/4] Building Production Frontend Assets..." -ForegroundColor Yellow
npm run build
Pop-Location

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "       Vault Setup Completed Successfully!             " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "To launch the application, run: .\scripts\start.ps1" -ForegroundColor Cyan
