@echo off
cd /d "%~dp0"
if not exist ".agent-token" (
  echo Token belum ada. Jalankan Jalankan-Agent.bat dulu.
  pause
  exit /b 1
)
type ".agent-token" | clip
echo Token (sudah disalin ke clipboard):
type ".agent-token"
echo.
pause
