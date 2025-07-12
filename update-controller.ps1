# PowerShell script to update all instances of req.admin to req.user

$filePath = "server\controllers\admin-chat-controller.js"
$content = Get-Content $filePath -Raw
$updatedContent = $content -replace "req\.admin", "req.user"
$updatedContent | Set-Content $filePath

Write-Host "All instances of req.admin have been replaced with req.user in admin-chat-controller.js"
