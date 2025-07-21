# Luxury Rating System Migration Script
# This script creates the necessary tables for the product rating system

param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$Host = "localhost",
    [string]$Port = "5432", 
    [string]$Database = "cdot_affiliate",
    [string]$Username = "postgres",
    [string]$Password = $env:DB_PASSWORD
)

Write-Host "=== Luxury Rating System Migration ===" -ForegroundColor Cyan
Write-Host "Creating tables for product rating and commission tracking..." -ForegroundColor Yellow

# Check if DATABASE_URL is provided
if ($DatabaseUrl) {
    Write-Host "Using DATABASE_URL: $DatabaseUrl" -ForegroundColor Green
    $connectionString = $DatabaseUrl
} else {
    Write-Host "Using individual connection parameters..." -ForegroundColor Green
    $connectionString = "postgresql://${Username}:${Password}@${Host}:${Port}/${Database}"
}

# Run the migration
try {
    Write-Host "Executing luxury rating migration..." -ForegroundColor Yellow
    
    # Check if psql is available
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlPath) {
        Write-Host "ERROR: psql command not found. Please ensure PostgreSQL client is installed and in PATH." -ForegroundColor Red
        Write-Host "You can also run the migration manually by executing the SQL file: sql/luxury-rating-migration.sql" -ForegroundColor Yellow
        exit 1
    }
    
    # Execute the migration SQL
    psql $connectionString -f "sql/luxury-rating-migration.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Luxury rating system migration completed successfully!" -ForegroundColor Green
        Write-Host "" 
        Write-Host "Created tables:" -ForegroundColor Cyan
        Write-Host "- product_ratings: Stores user ratings and earned commissions" -ForegroundColor White
        Write-Host "- user_commission_history: Tracks all commission transactions" -ForegroundColor White
        Write-Host "- drive_sessions.commission_earned: Added column for session commissions" -ForegroundColor White
        Write-Host ""
        Write-Host "Commission Rates by Tier:" -ForegroundColor Cyan
        Write-Host "- Bronze: 4⭐ = $0.40, 5⭐ = $0.20" -ForegroundColor White
        Write-Host "- Silver: 4⭐ = $0.70, 5⭐ = $0.30" -ForegroundColor White  
        Write-Host "- Gold: 4⭐ = $0.90, 5⭐ = $0.50" -ForegroundColor White
    } else {
        Write-Host "❌ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Please check the error messages above and try again." -ForegroundColor Yellow
        exit 1
    }
    
} catch {
    Write-Host "❌ Error running migration: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "You can run the migration manually by executing: sql/luxury-rating-migration.sql" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart your server to load the new API endpoint" -ForegroundColor White
Write-Host "2. Test the luxury features in the task.html page" -ForegroundColor White
Write-Host "3. Check browser console for any integration issues" -ForegroundColor White
Write-Host ""
Write-Host "Integration complete! 🎉" -ForegroundColor Green
