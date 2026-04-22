@echo off
REM Run UE4Editor-Cmd to export DataTables as JSON.
REM This will open and cook the project (takes 5-15 min first time).

set UPROJECT="C:\Program Files\Epic Games\SoulMaskModkit\Projects\WS\WS.uproject"
set UE4CMD="C:\Program Files\Epic Games\SoulMaskModkit\Engine\Binaries\Win64\UE4Editor-Cmd.exe"
set SCRIPT="%~dp0export_tables.py"

echo Starting UE4Editor export...
echo This may take several minutes on first run.
echo.

%UE4CMD% %UPROJECT% -ExecutePythonScript=%SCRIPT% -stdout -FullStdOutLogOutput -unattended -nopause

echo.
echo Export finished. Check Game\Exports\ for JSON files.
pause
