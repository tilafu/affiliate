# PowerShell script to remove remaining test files from the codebase
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

# Remaining server test files
Remove-FileIfExists "$baseDir\server\test-chat-server.js"

# Script test files
Remove-FileIfExists "$baseDir\scripts\test-admin-chat.js"

# Remaining frontend test files
Remove-FileIfExists "$baseDir\public\test-sidebar.html"
Remove-FileIfExists "$baseDir\public\test-progress-bar.html"
Remove-FileIfExists "$baseDir\public\test-features.html"
Remove-FileIfExists "$baseDir\public\test-deposit-api.html"
Remove-FileIfExists "$baseDir\public\test-carousel.html"
Remove-FileIfExists "$baseDir\public\mobile-nav-test.html"
Remove-FileIfExists "$baseDir\public\dual-auth-test.html"
Remove-FileIfExists "$baseDir\public\component-test.html"
Remove-FileIfExists "$baseDir\public\api-test.html"

Write-Host "Remaining test file removal completed successfully."
