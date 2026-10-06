@echo off
REM ===================================================================
REM  ZhongYu Toolbox portable - build a dependency-free portable ZIP.
REM  Only uses PowerShell + .NET, both shipped with Windows 10/11.
REM  NOTE: keep this file ASCII-only, so it stays readable under any
REM        console code page (GBK / Big5 / CP437 ...).
REM
REM  Usage:   pack-zip.cmd [Version] [InputDir] [OutFile]
REM  Example: pack-zip.cmd 0.0.8
REM ===================================================================
setlocal

set "VER=%~1"
if not "%VER%"=="" set "VER=%VER:"=%"

set "IN=%~2"
if "%IN%"=="" set "IN=out"

set "OUT=%~3"

if "%OUT%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pack-zip.ps1" -Version "%VER%" -InputDir "%IN%"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pack-zip.ps1" -Version "%VER%" -InputDir "%IN%" -OutFile "%OUT%"
)

if errorlevel 1 (
  echo.
  echo [FAILED] see the error above.
  pause
  exit /b 1
)

echo.
echo [OK] done.
pause
