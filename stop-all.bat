@echo off
echo.
echo =====================================
echo  Stopping All Services
echo =====================================
echo.

echo Stopping Docker containers...
docker compose down

echo.
echo All services stopped!
echo.
pause
