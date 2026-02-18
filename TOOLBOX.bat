@echo off
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

call "%SCRIPT_DIR%\LC_TOOLBOX.bat"
set "RC=%ERRORLEVEL%"

endlocal & exit /b %RC%
