# PowerShell script to prepare database export for upload
# Created on: July 6, 2025

# Configuration variables
$ExportDirectory = ".\exports"
$ExportFile = "affiliate_db_export.sql"
$ExportFilePath = Join-Path -Path $ExportDirectory -ChildPath $ExportFile
$ZippedExportFile = "affiliate_db_export.zip"
$ZippedExportFilePath = Join-Path -Path $ExportDirectory -ChildPath $ZippedExportFile

# Check if the export file exists
if (-not (Test-Path -Path $ExportFilePath)) {
    Write-Host "Error: Export file not found at $ExportFilePath" -ForegroundColor Red
    Write-Host "Please run Export-Database.ps1 first." -ForegroundColor Yellow
    exit 1
}

# Compress the SQL file for faster upload
Write-Host "Compressing $ExportFile to $ZippedExportFile..."
Compress-Archive -Path $ExportFilePath -DestinationPath $ZippedExportFilePath -Force

# Get file sizes for comparison
$SqlFileSize = (Get-Item -Path $ExportFilePath).Length / 1MB
$ZipFileSize = (Get-Item -Path $ZippedExportFilePath).Length / 1MB

Write-Host "Original SQL file size: $([math]::Round($SqlFileSize, 2)) MB"
Write-Host "Compressed ZIP file size: $([math]::Round($ZipFileSize, 2)) MB"
Write-Host "Compression ratio: $([math]::Round(100 - ($ZipFileSize / $SqlFileSize * 100), 0))%"

Write-Host "`nNext steps for uploading to Ubuntu:" -ForegroundColor Green
Write-Host "1. Open Bitvise SSH Client and connect to your server"
Write-Host "2. Click on the 'New SFTP window' button (or press F4) to open the file transfer panel"
Write-Host "3. In the SFTP panel that opens:"
Write-Host "   - Left side: Navigate to $ExportDirectory on your local machine"
Write-Host "   - Right side: Navigate to /tmp on your server"
Write-Host "4. Drag and drop $ZippedExportFile from the left panel to the right panel to upload it"
Write-Host "5. Switch back to the terminal tab and run the following commands:"
Write-Host "   cd /tmp"
Write-Host "   unzip $ZippedExportFile"
Write-Host "   psql -U postgres -d affiliate_db -f $ExportFile"
Write-Host "`nOr if using a different database user:"
Write-Host "   psql -U your_db_user -d affiliate_db -f $ExportFile"
