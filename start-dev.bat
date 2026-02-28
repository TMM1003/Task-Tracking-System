@echo off
setlocal

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

if /I "%~1"=="backend" goto run_backend
if /I "%~1"=="frontend" goto run_frontend

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found on PATH.
  echo Install Python and try again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found on PATH.
  echo Install Node.js and try again.
  pause
  exit /b 1
)

echo Opening backend and frontend dev servers...

start "Task Tracking Backend" cmd /k ""%~f0" backend"
start "Task Tracking Frontend" cmd /k ""%~f0" frontend"

echo Backend health check: http://127.0.0.1:8000/health
echo Frontend app:       http://localhost:5173
echo Press Ctrl+C in each server window to stop it.

exit /b 0

:run_backend
cd /d "%ROOT_DIR%\backend"

python -m pip show fastapi >nul 2>nul
if errorlevel 1 goto install_backend_deps

python -m pip show uvicorn >nul 2>nul
if errorlevel 1 goto install_backend_deps

goto start_backend

:install_backend_deps
python -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

:start_backend
python -m uvicorn app.main:app --reload
exit /b %errorlevel%

:run_frontend
cd /d "%ROOT_DIR%\frontend"

if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)

call npm run dev
exit /b %errorlevel%
