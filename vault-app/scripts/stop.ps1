# Script to cleanly stop the Vault server (PowerShell)
param (
    [int]$Port = 8000
)

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "                Stopping Vault Server                   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

if ($connections) {
    $stopped = 0
    foreach ($conn in $connections) {
        $procId = $conn.OwningProcess
        try {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Terminated server process (PID: $procId)" -ForegroundColor Green
            $stopped++
        } catch {
            Write-Host "[WARN] Failed to terminate process PID: $procId" -ForegroundColor Yellow
        }
    }
    if ($stopped -gt 0) {
        Write-Host "Vault server has been shut down successfully." -ForegroundColor Green
    }
} else {
    Write-Host "No active Vault server process found listening on port $Port." -ForegroundColor Gray
}
