# PowerShell script to update all instances of req.admin to req.user in admin-chat-controller.js

$filePath = Join-Path -Path $PSScriptRoot -ChildPath "server\controllers\admin-chat-controller.js"

# Read the file content
$content = Get-Content -Path $filePath -Raw

# Replace all instances of req.admin with req.user
$updatedContent = $content -replace "req\.admin", "req.user"

# Write the updated content back to the file
Set-Content -Path $filePath -Value $updatedContent

Write-Host "All instances of req.admin have been replaced with req.user in admin-chat-controller.js"
