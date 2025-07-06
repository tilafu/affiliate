# PowerShell script to remove all documentation markdown files
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

# Get all markdown files in the workspace
$markdownFiles = Get-ChildItem -Path $baseDir -Filter "*.md" -Recurse -File

# Loop through and remove each markdown file
foreach ($file in $markdownFiles) {
    Remove-FileIfExists $file.FullName
}

Write-Host "Documentation markdown file removal completed successfully."
Write-Host "Removed $($markdownFiles.Count) markdown files."
