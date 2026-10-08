@echo off
REM ============================================================
REM  Mulai My Workspace (mode lokal): agent + web + bot Telegram
REM  Double-click. Aman diklik ulang: yang sudah jalan tidak digandakan.
REM ============================================================
title Mulai My Workspace
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js tidak ditemukan. Install dari https://nodejs.org
  pause
  exit /b 1
)

REM ---- 1. Agent (port 4545) ----
powershell -NoProfile -Command "try { Invoke-RestMethod http://127.0.0.1:4545/health -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo [1/3] Menyalakan agent...
  wscript "%~dp0agent\start-agent-hidden.vbs"
) else (
  echo [1/3] Agent sudah berjalan.
)

REM ---- 2. Web localhost:3000 ----
netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul
if errorlevel 1 (
  echo [2/3] Menyalakan web di http://localhost:3000 ...
  start "MW Web - jangan ditutup" /min /d "%~dp0" cmd /k npm run dev
) else (
  echo [2/3] Web sudah berjalan.
)

REM ---- 3. Bot Telegram (mode lokal) ----
findstr /b /c:"TELEGRAM_BOT_TOKEN=" ".env.local" >nul 2>&1
if errorlevel 1 (
  echo [3/3] Bot Telegram dilewati: TELEGRAM_BOT_TOKEN belum ada di .env.local
  goto selesai
)
tasklist /v /fi "imagename eq cmd.exe" | findstr /c:"MW Telegram" >nul
if errorlevel 1 (
  echo [3/3] Menyalakan bot Telegram...
  start "MW Telegram - jangan ditutup" /min /d "%~dp0" cmd /k node scripts\telegram-poll.mjs
) else (
  echo [3/3] Bot Telegram sudah berjalan.
)

:selesai
echo.
echo Selesai. Jendela "MW Web" dan "MW Telegram" ada di taskbar, jangan ditutup.
echo Web: http://localhost:3000
timeout /t 8
