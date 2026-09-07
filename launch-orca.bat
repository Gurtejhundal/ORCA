@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
echo ORCA will be available at http://127.0.0.1:3000
call npm run dev
