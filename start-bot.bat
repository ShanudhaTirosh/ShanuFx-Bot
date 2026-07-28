@echo off
echo.
echo =====================================
echo  Discord Management Bot - Quick Start
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

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js 22.5+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
call npm install

echo.
echo [2/4] Starting Lavalink (Docker)...
docker compose up lavalink -d

echo.
echo [3/4] Waiting for Lavalink to be ready (30 seconds)...
timeout /t 30 /nobreak >nul

echo.
echo [4/4] Starting bot...
echo.
echo =====================================
echo  Bot is starting...
echo  Press Ctrl+C to stop
echo =====================================
echo.

npm start
