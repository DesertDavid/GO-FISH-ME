@echo off
rem Reel World launcher: double-click to play. The game opens in its own window; close that
rem window to quit (the game server stops with it).
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

rem hand over to the launcher, hidden, and close this window
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0tools\launcher.ps1"
exit /b 0
