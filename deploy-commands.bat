@echo off
echo.
echo =====================================
echo  Deploy Slash Commands
echo =====================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo [ERROR] .env file not found!
    echo Please configure your .env file first.
    echo.
    pause
    exit /b 1
)

echo Choose deployment type:
echo.
echo [1] Guild (Server) - Instant deployment for testing
echo [2] Global - Takes up to 1 hour, for production
echo.
set /p choice="Enter your choice (1 or 2): "

if "%choice%"=="1" (
    set /p guildId="Enter your Discord Server ID: "
    echo.
    echo Deploying commands to guild %guildId%...
    node deploy-commands.js guild %guildId%
) else if "%choice%"=="2" (
    echo.
    echo Deploying commands globally...
    echo This may take up to 1 hour to propagate.
    node deploy-commands.js global
) else (
    echo.
    echo Invalid choice!
    pause
    exit /b 1
)

echo.
echo =====================================
echo  Commands deployed successfully!
echo =====================================
echo.
pause
