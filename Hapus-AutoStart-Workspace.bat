@echo off
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\MyWorkspace.vbs" >nul 2>&1
echo Auto-start My Workspace dihapus. Jalankan manual lewat Mulai-Workspace.bat.
pause
