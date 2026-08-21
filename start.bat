@echo off
REM ============================================================
REM  MediScribe — One-Click Launcher (Windows)
REM  Starts both backend (FastAPI) and frontend (Next.js)
REM  Usage:  Double-click start.bat  OR  .\start.bat
REM  Stop:   Close this window or press Ctrl+C
REM ============================================================

title MediScribe Launcher
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       MediScribe Launcher                ║
echo  ╚══════════════════════════════════════════╝
echo.

REM ── 1. Start Backend ───────────────────────────────────────
echo.
echo  [1/2] Starting Backend (FastAPI)...

start "MediScribe-Backend" cmd /k "cd /d "%~dp0backend" && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo   [OK] Backend starting on http://localhost:8000
timeout /t 3 /nobreak >nul

REM ── 3. Start Frontend ──────────────────────────────────────
echo  [2/2] Starting Frontend (Next.js)...

REM Check if node_modules exists
if not exist "frontend\node_modules" (
    echo   [!!] node_modules missing - running npm install...
    start "MediScribe-Frontend-Install" /wait cmd /c "cd /d "%~dp0frontend" && npm install"
)

start "MediScribe-Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo   [OK] Frontend starting on http://localhost:3000

REM ── 4. Done ────────────────────────────────────────────────
echo.
echo  ════════════════════════════════════════════
echo    MediScribe is running!
echo  ════════════════════════════════════════════
echo.
echo   Backend  -^>  http://localhost:8000
echo   Frontend -^>  http://localhost:3000
echo   API Docs -^>  http://localhost:8000/docs
echo.
echo   Close the two terminal windows to stop.
echo.

REM Open the app in the default browser after a brief delay
timeout /t 5 /nobreak >nul
start "" http://localhost:3000

pause
