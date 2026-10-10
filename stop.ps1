# Script to stop the Vault server (PowerShell)
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "                Stopping Vault Server                   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$connections = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue

if ($connections) {
    foreach ($conn in $connections) {
        $procId = $conn.OwningProcess
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "Terminated server process (PID: $procId)" -ForegroundColor Green
    }
    Write-Host "Vault server has been shut down successfully." -ForegroundColor Green
} else {
    Write-Host "No active Vault server process found listening on port 8000." -ForegroundColor Gray
}
