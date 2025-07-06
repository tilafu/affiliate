# PowerShell script to remove test and debug files from the codebase
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

# Server-side test files
Remove-FileIfExists "$baseDir\server\test_endpoints.js"
Remove-FileIfExists "$baseDir\server\test_carousel.js"
Remove-FileIfExists "$baseDir\server\test_basic.js"
Remove-FileIfExists "$baseDir\server\test_auth.js"
Remove-FileIfExists "$baseDir\server\debug_auth_detailed.js"
Remove-FileIfExists "$baseDir\server\debug_auth.js"

# Frontend JS test files
Remove-FileIfExists "$baseDir\public\js\debug-task-401.js"

# Debug HTML files
Remove-FileIfExists "$baseDir\public\port_debug.html"
Remove-FileIfExists "$baseDir\public\debug_auth.html"
Remove-FileIfExists "$baseDir\public\auth-debug.html"
Remove-FileIfExists "$baseDir\debug_saveorder.html"
Remove-FileIfExists "$baseDir\test_profile.html"
Remove-FileIfExists "$baseDir\test-detailed-progress.html"

# Root directory test files
Remove-FileIfExists "$baseDir\test_saveorder_debug.js"
Remove-FileIfExists "$baseDir\test_notification_api.js"
Remove-FileIfExists "$baseDir\test_notifications_db.js"
Remove-FileIfExists "$baseDir\test_notifications_api.js"
Remove-FileIfExists "$baseDir\test_notifications.js"
Remove-FileIfExists "$baseDir\test_frozen_balance_system.js"
Remove-FileIfExists "$baseDir\test_deposit_api.js"
Remove-FileIfExists "$baseDir\test_db.js"
Remove-FileIfExists "$baseDir\test_commission.js"
Remove-FileIfExists "$baseDir\test_carousel_api.js"
Remove-FileIfExists "$baseDir\test_api.js"
Remove-FileIfExists "$baseDir\test_admin_routes.js"
Remove-FileIfExists "$baseDir\test_admin_auth.js"
Remove-FileIfExists "$baseDir\test_admin_adjustments.js"
Remove-FileIfExists "$baseDir\debug_user.js"
Remove-FileIfExists "$baseDir\debug_ports.js"
Remove-FileIfExists "$baseDir\debug_products.js"
Remove-FileIfExists "$baseDir\debug_auth.js"
Remove-FileIfExists "$baseDir\debug_auth.html"

Write-Host "Test and debug file removal completed successfully."
