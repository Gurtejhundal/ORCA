@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
echo Starting ORCA backend at http://127.0.0.1:8000
if exist ".venv\Scripts\python.exe" (
  start "ORCA Backend" cmd /k ".venv\Scripts\python.exe -m backend.run"
) else (
  start "ORCA Backend" cmd /k "py -3 -m backend.run"
)
echo ORCA will be available at http://127.0.0.1:3000
call npm run dev
