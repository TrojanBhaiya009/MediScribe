@echo off
REM MediScribe - Check Speech-to-Text Setup

echo ========================================
echo   MediScribe Speech-to-Text Checker
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] Checking .env file...
if not exist ".env" (
    echo   ERROR: .env file not found!
    echo   Please copy .env.example to .env
    pause
    exit /b 1
)
echo   OK: .env file exists

echo.
echo [2/3] Checking GROQ_API_KEY...
findstr /C:"GROQ_API_KEY=" .env >nul
if errorlevel 1 (
    echo   ERROR: GROQ_API_KEY not found in .env
    pause
    exit /b 1
)

findstr /C:"GROQ_API_KEY=\"\"" .env >nul
if not errorlevel 1 (
    echo   WARNING: GROQ_API_KEY is empty!
    echo   Please add your API key from https://console.groq.com
    echo.
    echo   Open .env file and set:
    echo   GROQ_API_KEY="gsk_your_key_here"
    echo.
    pause
    exit /b 1
)

findstr /C:"GROQ_API_KEY=\"gsk_" .env >nul
if errorlevel 1 (
    echo   WARNING: GROQ_API_KEY doesn't look valid (should start with gsk_)
    pause
) else (
    echo   OK: GROQ_API_KEY is configured
)

echo.
echo [3/3] Testing backend connection...
curl -s http://localhost:8000/nvidia-asr/status >nul 2>&1
if errorlevel 1 (
    echo   WARNING: Backend not responding on http://localhost:8000
    echo   Make sure to start the backend server:
    echo.
    echo   cd backend
    echo   uvicorn main:app --reload
    echo.
) else (
    echo   OK: Backend is running
)

echo.
echo ========================================
echo   Setup Status: Ready to Test!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure backend is running: uvicorn main:app --reload
echo 2. Open http://localhost:3000
echo 3. Go to Scribe page and test the microphone
echo.
pause
