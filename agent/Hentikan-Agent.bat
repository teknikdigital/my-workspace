@echo off
REM Menghentikan agent + semua aplikasi yang dijalankan lewat agent
cd /d "%~dp0"
if not exist ".agent.pid" (
  echo [Agent] Tidak sedang berjalan.
  pause
  exit /b 0
)
set /p AGENTPID=<".agent.pid"
taskkill /pid %AGENTPID% /T /F >nul 2>&1
del ".agent.pid" >nul 2>&1
echo [Agent] Dihentikan. Aplikasi yang dinyalakan lewat agent ikut berhenti.
pause
