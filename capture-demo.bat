@echo off
setlocal enabledelayedexpansion
title Capture Demo Frames
cd /d "%~dp0"

set "NODE_EXE="
set "NODE_DIR="
pushd "%~dp0.." 2>nul
if exist "tools\node\node-v20.18.1-win-x64\node.exe" (
  set "NODE_DIR=!CD!\tools\node\node-v20.18.1-win-x64"
)
popd
if defined NODE_DIR (
  set "NODE_EXE=!NODE_DIR!\node.exe"
  set "PATH=!NODE_DIR!;!PATH!"
)
if not defined NODE_EXE (
  for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
)
if not defined NODE_EXE (
  echo [ERROR] Node.js not found. Install Node 18+ from https://nodejs.org
  goto :end
)

echo ==================================================
echo  Capture demo frames for README
echo ==================================================
echo.

echo [1/4] Checking dependencies ...
if not exist "node_modules\next" (
  echo       npm install ...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
)
if not exist "node_modules\playwright" (
  echo       installing playwright ...
  call npm i -D playwright --no-audit --no-fund
  if errorlevel 1 goto :fail
) else (
  echo       playwright ok
)

echo [2/4] Freeing ports ...
for %%P in (3000 8080 11434) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    taskkill /F /PID %%A >nul 2>&1
  )
)

echo [3/4] Starting local services in a new window ...
start "ZeroTrust Demo" cmd /c "%~dp0start-demo.bat"
echo       waiting 25s for Next.js to compile ...
timeout /t 25 /nobreak >nul

echo [4/4] Capturing frames ...
"!NODE_EXE!" scripts\capture-demo.mjs
if errorlevel 1 (
  echo.
  echo [WARN] capture reported an error, check output above.
  echo        Common causes:
  echo          - services not ready yet, rerun this script
  echo          - browser still compiling, wait and retry
)

echo.
echo Building GIF ...
python scripts\build_gif.py
if errorlevel 1 (
  echo [WARN] gif build failed. Install Pillow: pip install Pillow
)

echo.
echo Done. Check docs\frames\ and docs\demo.gif
goto :end

:fail
echo.
echo [ERROR] dependency installation failed

:end
echo.
pause
