# PowerShell script to remove additional test-related files
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

# Additional test-related MD files
Remove-FileIfExists "$baseDir\PROGRESS_ENDPOINT_ANALYSIS.md"

# Test-related SQL file that contains test procedures
Remove-FileIfExists "$baseDir\fix_notification_categories.sql"

Write-Host "Additional test-related file removal completed successfully."
