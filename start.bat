@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"

echo Cleaning up previous instances...
taskkill /F /FI "WINDOWTITLE eq RoboSphere Backend*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq RoboSphere Frontend*" /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1

echo Starting RoboSphere...

echo Starting Backend Service...
start "RoboSphere Backend" cmd /k "cd backend && node index.js"

echo Starting Frontend Service...
start "RoboSphere Frontend" cmd /k "cd frontend && .\node_modules\.bin\vite.cmd"

echo RoboSphere has been successfully launched in separate command windows!
