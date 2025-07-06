# PowerShell script to remove test-related MD and SQL files
# Created on: July 6, 2025

# Define function to safely remove files if they exist
function Remove-FileIfExists {
    param(
        [Parameter(Mandatory=$true)]
        [string]$FilePath
    )
    
    if (Test-Path $FilePath) {
        Write-Host "Removing: $FilePath"
        Remove-Item -Path $FilePath -Force
    } else {
        Write-Host "File not found: $FilePath (skipping)"
    }
}

# Set the base directory path
$baseDir = "c:\Users\user\Documents\affiliate-final"

# Test-related MD files
Remove-FileIfExists "$baseDir\ADMIN_CHAT_TESTING_GUIDE.md"
Remove-FileIfExists "$baseDir\ADMIN_CHAT_TESTING_GUIDE_INTEGRATED.md"

# Test-related SQL files
Remove-FileIfExists "$baseDir\scripts\admin-chat-schema-fixed.sql"

Write-Host "Test-related MD and SQL file removal completed successfully."
