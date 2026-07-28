@echo off
echo.
echo =====================================
echo  Dashboard - Quick Start
echo =====================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo [ERROR] .env file not found!
    echo Please copy .env.example to .env and configure it.
    echo.
    pause
    exit /b 1
)

echo Starting dashboard on http://localhost:3000
echo Press Ctrl+C to stop
echo.

npm run dashboard
