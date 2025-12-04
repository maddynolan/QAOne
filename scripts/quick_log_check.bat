@echo off
REM Quick log checker that doesn't hang
REM Uses findstr (Windows built-in) instead of PowerShell

echo Checking Flowstral logs...
echo.

findstr /i /c:"flowstral" /c:"FORGE" /c:"SIMPLE-FLUX" /c:"session" /c:"Error" /c:"WARNING" backend\logs\app.log | findstr /i /c:"session stopped" /c:"Added node" /c:"SELECTOR" /c:"Error" > temp_log_check.txt

if exist temp_log_check.txt (
    echo Recent Flowstral Activity:
    echo.
    powershell -Command "Get-Content temp_log_check.txt -Tail 20"
    del temp_log_check.txt
) else (
    echo No matching log entries found
)

echo.
echo Done.

