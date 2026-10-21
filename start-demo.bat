@echo off
setlocal
cd /d "D:\deepseek work\zero-trust-starter"
set "NODE_DIR=D:\deepseek work\tools\node\node-v20.18.1-win-x64"
set "PATH=%NODE_DIR%;%PATH%"
echo ================================================
echo  Zero-Trust Starter - local dev environment
echo ================================================
echo  Project: %CD%
echo  Node:    %NODE_DIR%
echo ------------------------------------------------
if not exist ".env.demo" (
  echo [1/2] create .env.demo
  copy /y ".env.demo.example" ".env.demo" >nul
) else (
  echo [1/2] .env.demo exists, skip
)
echo [2/2] starting services - press Ctrl+C to stop
echo.
echo   Open browser: http://127.0.0.1:3000
echo   Demo account: demo  - roles admin,member
echo.
"%NODE_DIR%\node.exe" "scripts\run-demo.mjs"
echo.
echo Services stopped.
pause
