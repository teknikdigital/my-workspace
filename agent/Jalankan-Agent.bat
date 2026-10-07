@echo off
REM ============================================================
REM  My Workspace Agent - double-click untuk menjalankan
REM  Agent berjalan di background (tanpa jendela), port 4545
REM ============================================================
title My Workspace Agent
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [Agent] Node.js tidak ditemukan. Install dari https://nodejs.org lalu coba lagi.
  pause
  exit /b 1
)

powershell -NoProfile -Command "try { Invoke-RestMethod http://127.0.0.1:4545/health -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo [Agent] Sudah berjalan.
  goto token
)

wscript "%~dp0start-agent-hidden.vbs"
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-RestMethod http://127.0.0.1:4545/health -TimeoutSec 3; Write-Host ('[Agent] Aktif, versi ' + $r.version) } catch { Write-Host '[Agent] Belum merespons. Cek file agent\logs\agent.log' }"

:token
echo.
if exist ".agent-token" (
  echo Token agent sudah disalin ke clipboard.
  echo Tempel di My Workspace: Work ^> Lokal ^> tombol Pengaturan Agent.
  type ".agent-token" | clip
)
echo.
pause
