@echo off
REM Menghentikan agent + semua aplikasi yang dijalankan lewat agent
cd /d "%~dp0"
if not exist ".agent.pid" goto port
set /p AGENTPID=<".agent.pid"
taskkill /pid %AGENTPID% /T /F >nul 2>&1
del ".agent.pid" >nul 2>&1

:port
REM Jaga-jaga: agent lama yang tidak tercatat di .agent.pid tapi masih memegang port 4545.
REM Hanya proses node yang dihentikan; program lain di port itu tidak disentuh.
powershell -NoProfile -Command "$ids = Get-NetTCPConnection -LocalPort 4545 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($i in $ids) { $n = (Get-Process -Id $i -ErrorAction SilentlyContinue).ProcessName; if ($n -eq 'node') { taskkill /pid $i /T /F | Out-Null; Write-Host ('[Agent] Agent lama di port 4545 dihentikan, PID ' + $i) } elseif ($n) { Write-Host ('[Agent] Port 4545 dipakai program lain: ' + $n + ', PID ' + $i + '. Tidak dihentikan.') } }"

echo [Agent] Dihentikan. Aplikasi yang dinyalakan lewat agent ikut berhenti.
pause
