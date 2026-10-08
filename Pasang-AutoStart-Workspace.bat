@echo off
REM My Workspace (agent + web + bot Telegram) otomatis menyala setiap login Windows
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
> "%STARTUP%\MyWorkspace.vbs" echo CreateObject("WScript.Shell").Run """%~dp0Mulai-Workspace.bat""", 7, False
REM auto-start agent lama tidak perlu lagi (Mulai-Workspace juga menyalakan agent)
del "%STARTUP%\MyWorkspaceAgent.vbs" >nul 2>&1
if exist "%STARTUP%\MyWorkspace.vbs" (
  echo Auto-start terpasang. My Workspace menyala otomatis setiap login Windows.
) else (
  echo Gagal memasang auto-start.
)
pause
