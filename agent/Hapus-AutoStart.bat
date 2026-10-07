@echo off
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\MyWorkspaceAgent.vbs" >nul 2>&1
echo [Agent] Auto-start dihapus.
pause
