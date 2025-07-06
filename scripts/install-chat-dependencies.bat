@echo off
REM Script to install required dependencies for chat integration

echo Installing required dependencies for chat integration...

REM Navigate to the server directory
cd "%~dp0\..\server" || (
    echo Error: Could not navigate to server directory
    exit /b 1
)

REM Check if npm is available
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: npm is not installed or not in PATH
    exit /b 1
)

REM Install dependencies
echo Installing express-session, socket.io, and cookie...
call npm install express-session socket.io cookie

if %ERRORLEVEL% equ 0 (
    echo Dependencies installed successfully!
) else (
    echo Error: Failed to install dependencies
    echo Please run the following commands manually:
    echo cd server
    echo npm install express-session socket.io cookie
    exit /b 1
)
