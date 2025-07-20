# PowerShell script to run the withdrawal password migration
# This sets withdrawal passwords to match account passwords for existing users

Write-Host "Setting default withdrawal passwords for existing users..." -ForegroundColor Cyan
Write-Host "This will allow users to use their account password for withdrawals." -ForegroundColor Yellow
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "server\migrations\set-default-withdrawal-passwords.js")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    Write-Host "Current directory: $PWD" -ForegroundColor Red
    Write-Host "Expected to find: server\migrations\set-default-withdrawal-passwords.js" -ForegroundColor Red
    pause
    exit 1
}

try {
    # Run the migration
    Write-Host "Running migration..." -ForegroundColor Green
    node server\migrations\set-default-withdrawal-passwords.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host "Users can now withdraw using their account password." -ForegroundColor Green
        Write-Host "The withdrawal system will automatically fall back to account password" -ForegroundColor Green
        Write-Host "if no separate withdrawal password is set." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error running migration: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
