@echo off
REM Script to update files for admin chat integration

REM Set the base directory
SET BASE_DIR=%~dp0
cd %BASE_DIR%

REM Install dependencies
echo Installing required dependencies...
call .\scripts\install-chat-dependencies.bat

REM Backup original files
echo Creating backups of original files...
mkdir .\backups 2>nul
copy .\server\server.js .\backups\server.js.bak
copy .\server\routes\admin-chat-api-integrated.js .\backups\admin-chat-api-integrated.js.bak
copy .\server\chat-server.js .\backups\chat-server.js.bak

REM Copy updated files
echo Copying updated files...
mkdir .\scripts\integration-updates 2>nul
copy .\server\server.js .\scripts\integration-updates\server.js
copy .\server\routes\admin-chat-api-integrated.js .\scripts\integration-updates\admin-chat-api-integrated.js
copy .\server\chat-server.js .\scripts\integration-updates\chat-server.js

echo Update completed successfully!
echo Please restart the server to apply changes.
