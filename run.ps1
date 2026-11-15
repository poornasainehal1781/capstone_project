Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Starting SmartRetail AI (Backend + Frontend)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run dev"

Write-Host "`nBoth servers have been started in separate PowerShell windows!" -ForegroundColor Green
Write-Host "- Frontend Web App:  http://localhost:5173" -ForegroundColor Yellow
Write-Host "- Backend API Docs:  http://127.0.0.1:8000/docs" -ForegroundColor Yellow

