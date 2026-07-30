# Ashley ERP - Quick Start Script
# This script starts the development server on port 3001

Write-Host "🚀 Starting Ashley ERP on http://localhost:3001..." -ForegroundColor Cyan

# Check if port 3001 is already in use
$portCheck = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($portCheck) {
    Write-Host "⚠️ Warning: Port 3001 is already in use. Attempting to start anyway..." -ForegroundColor Yellow
}

npm run dev
