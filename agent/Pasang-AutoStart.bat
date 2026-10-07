@echo off
REM Agent otomatis berjalan setiap kali login Windows
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
> "%STARTUP%\MyWorkspaceAgent.vbs" echo CreateObject("WScript.Shell").Run """%~dp0start-agent-hidden.vbs""", 0, False
if exist "%STARTUP%\MyWorkspaceAgent.vbs" (
  echo [Agent] Auto-start terpasang. Agent akan aktif otomatis setiap login Windows.
) else (
  echo [Agent] Gagal memasang auto-start.
)
pause
