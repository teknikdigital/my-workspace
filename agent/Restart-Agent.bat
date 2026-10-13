@echo off
REM ============================================================
REM  My Workspace Agent - Restart (hentikan lalu jalankan lagi)
REM  Double-click satu kali: agent lama berhenti, agent baru jalan.
REM  CATATAN: aplikasi yang dinyalakan lewat agent ikut berhenti
REM  dan perlu dinyalakan ulang dari web (Work > Lokal).
REM ============================================================
title My Workspace Agent - Restart
cd /d "%~dp0"

echo [Agent] Menghentikan agent lama...
if not exist ".agent.pid" goto portkill
set /p AGENTPID=<".agent.pid"
taskkill /pid %AGENTPID% /T /F >nul 2>&1
del ".agent.pid" >nul 2>&1

:portkill
powershell -NoProfile -Command "$ids = Get-NetTCPConnection -LocalPort 4545 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($i in $ids) { $n = (Get-Process -Id $i -ErrorAction SilentlyContinue).ProcessName; if ($n -eq 'node') { taskkill /pid $i /T /F | Out-Null; Write-Host ('[Agent] Agent lama (PID ' + $i + ') dihentikan.') } }"
timeout /t 3 /nobreak >nul

echo [Agent] Menjalankan agent baru...
where node >nul 2>&1
if errorlevel 1 (
  echo [Agent] Node.js tidak ditemukan. Install dari https://nodejs.org lalu coba lagi.
  pause
  exit /b 1
)
wscript "%~dp0start-agent-hidden.vbs"
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-RestMethod http://127.0.0.1:4545/health -TimeoutSec 3; Write-Host ('[Agent] Aktif kembali, versi ' + $r.version) } catch { Write-Host '[Agent] Belum merespons. Cek file agent\logs\agent.log' }"
echo.
echo [Agent] Selesai. Nyalakan ulang aplikasimu dari web: Work ^> Lokal.
echo.
pause
