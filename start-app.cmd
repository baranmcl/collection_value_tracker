@echo off
REM ============================================================
REM  Collection Value Tracker — double-click this file to launch.
REM  Closing this window stops the app.
REM ============================================================

REM Move to the folder this script lives in (works from anywhere).
cd /d "%~dp0"

REM First run only: install dependencies if they are missing.
if not exist "node_modules" (
  echo Installing dependencies for the first time. This may take a minute...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency install failed - see the messages above.
    pause
    exit /b 1
  )
)

echo.
echo Starting Collection Value Tracker...
echo A browser tab will open automatically once it is ready.
echo Keep this window open while you use the app; close it to stop.
echo.

REM Start the dev server and open the browser to the right URL.
call npm run dev -- --open

REM If the server stops or fails to start, keep the window visible.
echo.
echo The app has stopped.
pause
