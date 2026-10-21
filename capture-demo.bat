@echo off
setlocal enabledelayedexpansion
title Capture Demo Frames
cd /d "D:\deepseek work\zero-trust-starter"

set "NODE_DIR=D:\deepseek work\tools\node\node-v20.18.1-win-x64"
set "PATH=%NODE_DIR%;%PATH%"

echo ==================================================
echo  Capture demo frames for README
echo ==================================================
echo.

if not exist "%NODE_DIR%\node.exe" (
  echo [ERROR] node.exe not found: %NODE_DIR%
  goto :end
)

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
  echo       downloading chromium ...
  call npx playwright install chromium
) else (
  echo       playwright ok
)

echo [2/4] Freeing ports ...
for %%P in (3000 8080 11434) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    taskkill /F /PID %%A >nul 2>&1
  )
)

echo [3/4] Starting local services (separate window) ...
start "ZeroTrust Demo" cmd /c "start-demo.bat"
echo       waiting 25s for Next.js to compile ...
timeout /t 25 /nobreak >nul

echo [4/4] Capturing frames ...
node scripts\capture-demo.mjs
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
  echo [WARN] gif build failed, check that Pillow is installed: pip install Pillow
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
