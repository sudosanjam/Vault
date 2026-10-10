# Vault Test Suite Runner (PowerShell)
# Executes all backend pytest tests (CRUD, Graph, Backups, Exports, Traversal Security, Reindexing)
# and runs frontend TypeScript type-checking.

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$PythonExe = Join-Path $BackendDir "venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "             VAULT - Comprehensive Test Suite           " -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Backend Pytest Suite
Write-Host "[1/2] Running Backend Tests (pytest)..." -ForegroundColor Yellow
Push-Location $BackendDir
& $PythonExe -m pytest -v --tb=short
$PytestExit = $LASTEXITCODE
Pop-Location

if ($PytestExit -ne 0) {
    Write-Host "`nBackend tests failed with exit code $PytestExit" -ForegroundColor Red
    exit $PytestExit
}

# 2. Frontend Type Check
Write-Host "`n[2/2] Running Frontend Type Check (tsc)..." -ForegroundColor Yellow
Push-Location $FrontendDir
npm run build
$FrontendExit = $LASTEXITCODE
Pop-Location

if ($FrontendExit -ne 0) {
    Write-Host "`nFrontend build failed with exit code $FrontendExit" -ForegroundColor Red
    exit $FrontendExit
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "       All Vault Tests and Builds PASSED! (100%)       " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
