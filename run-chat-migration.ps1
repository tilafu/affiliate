# Chat Migration Script for PowerShell
# This script runs the complete chat system migration

Write-Host "Starting Chat System Migration..." -ForegroundColor Green

# Set the path to the SQL file
$sqlFile = "sql\complete_chat_migration.sql"

# Check if SQL file exists
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERROR: SQL file not found at $sqlFile" -ForegroundColor Red
    exit 1
}

# You can run this migration in one of these ways:

Write-Host "Choose a method to run the migration:" -ForegroundColor Yellow
Write-Host "1. Using psql command line (recommended)"
Write-Host "2. Copy-paste into pgAdmin"
Write-Host ""

Write-Host "Method 1 - psql command:" -ForegroundColor Cyan
Write-Host "psql -U your_username -d affiliate_db -f `"$sqlFile`""
Write-Host ""

Write-Host "Method 2 - pgAdmin:" -ForegroundColor Cyan
Write-Host "1. Open pgAdmin"
Write-Host "2. Navigate to your affiliate_db database"
Write-Host "3. Right-click on affiliate_db > Query Tool"
Write-Host "4. Open the file: $sqlFile"
Write-Host "5. Click Execute (F5)"
Write-Host ""

Write-Host "After running the migration, restart your Node.js server to test the admin chat." -ForegroundColor Green

# Read the SQL content for easy copying
$sqlContent = Get-Content $sqlFile -Raw
Write-Host "SQL Content (for copy-paste):" -ForegroundColor Magenta
Write-Host "----------------------------------------"
Write-Host $sqlContent
Write-Host "----------------------------------------"
