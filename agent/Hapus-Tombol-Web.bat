@echo off
reg delete "HKCU\Software\Classes\mwagent" /f >nul 2>&1
echo [Agent] Link mwagent:// dihapus.
pause
