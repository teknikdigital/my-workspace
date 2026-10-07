@echo off
REM ============================================================
REM  Mendaftarkan link mwagent:// ke Windows (hanya user ini, tanpa admin)
REM  Agar tombol "Nyalakan Agent" di My Workspace bisa menyalakan agent.
REM  Link hanya menjalankan start-agent-hidden.vbs, parameter apa pun diabaikan.
REM ============================================================
set "VBS=%~dp0start-agent-hidden.vbs"
reg add "HKCU\Software\Classes\mwagent" /ve /d "URL:My Workspace Agent" /f >nul
reg add "HKCU\Software\Classes\mwagent" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\mwagent\shell\open\command" /ve /d "wscript.exe \"%VBS%\"" /f >nul
if errorlevel 1 (
  echo [Agent] Gagal mendaftarkan link mwagent://
) else (
  echo [Agent] Berhasil. Tombol "Nyalakan Agent" di My Workspace sekarang bisa dipakai.
  echo Saat pertama diklik, browser akan bertanya izin membuka aplikasi: pilih Izinkan / Open.
)
pause
