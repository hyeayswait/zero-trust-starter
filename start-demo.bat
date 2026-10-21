@echo off
setlocal enabledelayedexpansion
title Zero-Trust Starter
cd /d "%~dp0"

echo ==================================================
echo  Zero-Trust Starter
echo ==================================================
echo.

rem --- locate node: portable copy in parent folder, else PATH ---
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
  echo  Node: !NODE_EXE!
)
if not defined NODE_EXE (
  for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
  if defined NODE_EXE (echo  Node: !NODE_EXE!)
)
if not defined NODE_EXE (
  echo [ERROR] Node.js not found.
  echo         Install Node 18+ from https://nodejs.org
  goto :end
)
echo.

echo [1/4] Freeing ports 3000 8080 11434 ...
for %%P in (3000 8080 11434) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    echo       kill PID %%A on port %%P
    taskkill /F /PID %%A >nul 2>&1
  )
)

echo [2/4] Preparing env ...
if not exist ".env.demo" (
  copy /y ".env.demo.example" ".env.demo" >nul
  echo       created .env.demo
) else (
  echo       .env.demo ok
)
if exist ".env" (
  ren ".env" ".env.old-disabled" >nul 2>&1
  echo       disabled docker .env
)

echo [3/4] Checking dependencies ...
if not exist "node_modules\next" (
  echo       installing, this may take a few minutes ...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] npm install failed
    goto :end
  )
) else (
  echo       node_modules ok
)

echo [4/4] Starting services ...
echo.
echo   URL:     http://127.0.0.1:3000  ^(use this exact address^)
echo   Account: demo  ^(roles admin,member^)
echo   Stop:    Ctrl+C
echo.
echo --------------------------------------------------

"!NODE_EXE!" "scripts\run-demo.mjs"
set "RC=%ERRORLEVEL%"

echo --------------------------------------------------
if not "%RC%"=="0" (
  echo [ERROR] process exited with code %RC%
  echo.
  echo Common fixes:
  echo   - Port occupied: run free-ports.bat then retry
  echo   - Stale cache:    delete .next folder then retry
)

:end
echo.
pause
