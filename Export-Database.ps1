# PowerShell script to export PostgreSQL database
# Created on: July 6, 2025

# Configuration variables - modify these as needed
$DbName = "affiliate_db"
$DbUser = "postgres"
$DbPassword = ""  # Leave empty if using Windows authentication
$ExportFile = "affiliate_db_export.sql"
$SchemaOnlyFile = "affiliate_schema_only.sql"
$DataOnlyFile = "affiliate_data_only.sql"
$OutputDirectory = ".\exports"

# Create output directory if it doesn't exist
if (-not (Test-Path -Path $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
    Write-Host "Created directory: $OutputDirectory"
}

# Full paths for export files
$ExportFilePath = Join-Path -Path $OutputDirectory -ChildPath $ExportFile
$SchemaOnlyFilePath = Join-Path -Path $OutputDirectory -ChildPath $SchemaOnlyFile
$DataOnlyFilePath = Join-Path -Path $OutputDirectory -ChildPath $DataOnlyFile

Write-Host "Exporting PostgreSQL database '$DbName' with user '$DbUser'..."

# Function to run pg_dump with consistent parameters
function Invoke-PgDump {
    param (
        [string]$OutputFile,
        [string]$AdditionalArgs = ""
    )
    
    $pgDumpArgs = "-U $DbUser -d $DbName -F p $AdditionalArgs -f `"$OutputFile`""
    
    if (-not [string]::IsNullOrEmpty($DbPassword)) {
        $env:PGPASSWORD = $DbPassword
    }
    
    try {
        Write-Host "Running: pg_dump $pgDumpArgs"
        $process = Start-Process -FilePath "pg_dump" -ArgumentList $pgDumpArgs -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -ne 0) {
            Write-Host "Error: pg_dump exited with code $($process.ExitCode)" -ForegroundColor Red
            return $false
        }
        return $true
    }
    catch {
        Write-Host "Error executing pg_dump: $_" -ForegroundColor Red
        return $false
    }
    finally {
        if (-not [string]::IsNullOrEmpty($DbPassword)) {
            $env:PGPASSWORD = ""
        }
    }
}

# Export full database (schema + data)
Write-Host "Exporting complete database to: $ExportFilePath"
$success = Invoke-PgDump -OutputFile $ExportFilePath
if (-not $success) {
    Write-Host "Failed to export complete database." -ForegroundColor Red
    exit 1
}

# Export schema only (no data)
Write-Host "Exporting schema only to: $SchemaOnlyFilePath"
$success = Invoke-PgDump -OutputFile $SchemaOnlyFilePath -AdditionalArgs "--schema-only"
if (-not $success) {
    Write-Host "Failed to export schema." -ForegroundColor Red
}

# Export data only (no schema)
Write-Host "Exporting data only to: $DataOnlyFilePath"
$success = Invoke-PgDump -OutputFile $DataOnlyFilePath -AdditionalArgs "--data-only"
if (-not $success) {
    Write-Host "Failed to export data." -ForegroundColor Red
}

Write-Host "`nExport completed successfully. Files created:" -ForegroundColor Green
Write-Host "  - $ExportFilePath (complete export)"
Write-Host "  - $SchemaOnlyFilePath (schema only)"
Write-Host "  - $DataOnlyFilePath (data only)"
Write-Host "`nNext steps:"
Write-Host "1. Upload the $ExportFile file to your Ubuntu server using Bitvise SFTP"
Write-Host "2. On your server, run: psql -U postgres -d affiliate_db -f /path/to/$ExportFile"
