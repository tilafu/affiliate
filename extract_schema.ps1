# PowerShell script to extract database schema
# Usage: .\extract_schema.ps1

Write-Host "🔍 Extracting database schema for affiliate_db..." -ForegroundColor Cyan

# Load environment variables from .env file
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            $name = $Matches[1]
            $value = $Matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Set database connection parameters
$DB_USER = $env:DB_USER ?? "postgres"
$DB_HOST = $env:DB_HOST ?? "localhost"
$DB_NAME = $env:DB_NAME ?? "affiliate_db"
$DB_PASSWORD = $env:DB_PASSWORD ?? "postgres"
$DB_PORT = $env:DB_PORT ?? "5432"

# Set output files
$COMPLETE_SCHEMA_FILE = "affiliate_db_complete_schema.sql"
$RELATIONS_FILE = "affiliate_db_relations.sql"

Write-Host "📊 Database: $DB_NAME" -ForegroundColor Green
Write-Host "🔗 Host: $DB_HOST:$DB_PORT" -ForegroundColor Green
Write-Host "👤 User: $DB_USER" -ForegroundColor Green

# Set password environment variable for pg_dump and psql
$env:PGPASSWORD = $DB_PASSWORD

Write-Host "📝 Extracting complete schema..." -ForegroundColor Yellow

# 1. Extract complete schema with structure only (no data)
$schemaHeader = @"
-- Complete Database Schema for affiliate_db
-- Generated on: $(Get-Date)
-- Database: $DB_NAME

"@

$schemaHeader | Out-File -FilePath $COMPLETE_SCHEMA_FILE -Encoding UTF8

try {
    # Extract schema using pg_dump
    & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only --no-owner --no-privileges | Out-File -FilePath $COMPLETE_SCHEMA_FILE -Append -Encoding UTF8
    Write-Host "✅ Schema structure extracted" -ForegroundColor Green
} catch {
    Write-Host "❌ Error extracting schema: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "🔗 Extracting relationships..." -ForegroundColor Yellow

# 2. Extract table relationships
$relationsHeader = @"
-- Table Structures and Relationships for affiliate_db
-- Generated on: $(Get-Date)

"@

$relationsHeader | Out-File -FilePath $RELATIONS_FILE -Encoding UTF8

# SQL query to get table structure
$tableStructureQuery = @"
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PRIMARY KEY'
        WHEN tc.constraint_type = 'FOREIGN KEY' THEN 'FOREIGN KEY -> ' || ccu.table_name || '(' || ccu.column_name || ')'
        WHEN tc.constraint_type = 'UNIQUE' THEN 'UNIQUE'
        ELSE ''
    END as constraint_info
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON c.table_name = t.table_name
LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.column_name = c.column_name AND ccu.table_name = t.table_name
LEFT JOIN information_schema.table_constraints tc ON tc.constraint_name = ccu.constraint_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;
"@

try {
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $tableStructureQuery | Out-File -FilePath $RELATIONS_FILE -Append -Encoding UTF8
    Write-Host "✅ Table structures extracted" -ForegroundColor Green
} catch {
    Write-Host "❌ Error extracting table structures: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Extract foreign key relationships
"`n-- Foreign Key Relationships`n" | Out-File -FilePath $RELATIONS_FILE -Append -Encoding UTF8

$foreignKeyQuery = @"
SELECT 
    tc.table_name as source_table,
    kcu.column_name as source_column,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;
"@

try {
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $foreignKeyQuery | Out-File -FilePath $RELATIONS_FILE -Append -Encoding UTF8
    Write-Host "✅ Foreign key relationships extracted" -ForegroundColor Green
} catch {
    Write-Host "❌ Error extracting foreign keys: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Extract indexes
"`n-- Indexes`n" | Out-File -FilePath $RELATIONS_FILE -Append -Encoding UTF8

$indexQuery = @"
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
"@

try {
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $indexQuery | Out-File -FilePath $RELATIONS_FILE -Append -Encoding UTF8
    Write-Host "✅ Indexes extracted" -ForegroundColor Green
} catch {
    Write-Host "❌ Error extracting indexes: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Schema extraction completed!" -ForegroundColor Green
Write-Host "📄 Files created:" -ForegroundColor Cyan
Write-Host "   - $COMPLETE_SCHEMA_FILE (Complete schema with CREATE statements)" -ForegroundColor White
Write-Host "   - $RELATIONS_FILE (Detailed table relationships and structure)" -ForegroundColor White

# Clean up environment variable
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
