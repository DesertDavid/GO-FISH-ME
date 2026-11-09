@echo off
rem Reel World launcher: double-click to play. Keep this window open while you play;
rem closing it stops the game server.
cd /d "%~dp0"
title Reel World

where node >nul 2>nul
if errorlevel 1 (
  echo Reel World needs Node.js. Get the LTS version from https://nodejs.org, install it, then run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing the game's packages. This takes a minute...
  call npm install
  if errorlevel 1 (
    echo Install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

rem Already running? Just open it.
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://localhost:5200 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" http://localhost:5200
  exit /b 0
)

echo Starting Reel World... your browser will open in a moment.
echo Keep this window open while you play. Close it to quit.
call npx vite --port 5200 --strictPort --open
