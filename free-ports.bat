@echo off
setlocal enabledelayedexpansion
echo Freeing ports 3000 8080 11434 ...
for %%P in (3000 8080 11434) do (
  set "FOUND="
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    set "FOUND=1"
    echo   port %%P held by PID %%A - killing
    taskkill /F /PID %%A >nul 2>&1
  )
  if not defined FOUND echo   port %%P already free
)
echo Done.
pause
