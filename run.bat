@echo off
title SmartRetail AI Launcher
echo ===================================================
echo Starting SmartRetail AI (Backend + Frontend)
echo ===================================================

echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "SmartRetail Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

echo Starting Vite React Frontend on http://localhost:5173 ...
start "SmartRetail Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both servers are launching in separate windows!
echo - Web App:        http://localhost:5173
echo - API Docs:       http://127.0.0.1:8000/docs
echo ===================================================
pause

