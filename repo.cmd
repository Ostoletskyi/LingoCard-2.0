@echo off

@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_tools\repo_menu.ps1"
if errorlevel 1 pause