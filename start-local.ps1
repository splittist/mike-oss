# One-command local startup: starts backend (APP_MODE=local) and frontend in parallel.
# Usage: .\start-local.ps1
# Stop with Ctrl+C (both processes are killed together).

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "Installing dependencies (if needed)..."
npm install --prefix "$repoRoot\backend" --silent
npm install --prefix "$repoRoot\frontend" --silent

Write-Host ""
Write-Host "Starting backend on http://localhost:3001 (APP_MODE=local)..."
$backendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location "$root\backend"
    $env:APP_MODE = "local"
    npm run dev
} -ArgumentList $repoRoot

Write-Host "Starting frontend on http://localhost:3000..."
$frontendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location "$root\frontend"
    npm run dev
} -ArgumentList $repoRoot

Write-Host ""
Write-Host "Both services are starting. Open http://localhost:3000 when ready."
Write-Host "Press Ctrl+C to stop."
Write-Host ""

try {
    while ($true) {
        Receive-Job -Job $backendJob, $frontendJob
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "Stopping..."
    Stop-Job -Job $backendJob, $frontendJob
    Remove-Job -Job $backendJob, $frontendJob -Force
    Write-Host "Done."
}
