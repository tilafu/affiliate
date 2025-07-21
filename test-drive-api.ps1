# Drive API Status Checker
# Quick script to test all drive API endpoints

Write-Host "=== Drive API Status Check ===" -ForegroundColor Cyan
Write-Host "Testing all drive API endpoints..." -ForegroundColor Yellow

$baseUrl = "http://localhost:3000"
$endpoints = @(
    @{ Method = "GET"; Path = "/api/drive/status"; Description = "Get drive status" },
    @{ Method = "POST"; Path = "/api/drive/start"; Description = "Start drive session" },
    @{ Method = "POST"; Path = "/api/drive/getorder"; Description = "Get next order" },
    @{ Method = "POST"; Path = "/api/drive/saveorder"; Description = "Save order" },
    @{ Method = "POST"; Path = "/api/drive/refund"; Description = "Process refund" },
    @{ Method = "POST"; Path = "/api/drive/check-unfreeze"; Description = "Check unfreeze" },
    @{ Method = "POST"; Path = "/api/drive/add-commission"; Description = "Add commission" }
)

Write-Host ""
Write-Host "Testing endpoints without authentication (expect 401 errors):" -ForegroundColor Green

foreach ($endpoint in $endpoints) {
    try {
        Write-Host "  Testing: $($endpoint.Method) $($endpoint.Path)" -ForegroundColor White -NoNewline
        
        $response = if ($endpoint.Method -eq "GET") {
            Invoke-RestMethod -Uri "$baseUrl$($endpoint.Path)" -Method $endpoint.Method -ErrorAction SilentlyContinue
        } else {
            Invoke-RestMethod -Uri "$baseUrl$($endpoint.Path)" -Method $endpoint.Method -Body "{}" -ContentType "application/json" -ErrorAction SilentlyContinue
        }
        
        Write-Host " ✅ OK" -ForegroundColor Green
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host " 🔐 401 (Auth Required)" -ForegroundColor Yellow
        }
        elseif ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host " ❌ 404 (Not Found)" -ForegroundColor Red
        }
        elseif ($_.Exception.Response.StatusCode -eq 500) {
            Write-Host " ⚠️  500 (Server Error)" -ForegroundColor Red
        }
        else {
            Write-Host " ❓ $($_.Exception.Response.StatusCode)" -ForegroundColor Magenta
        }
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "✅ OK = Endpoint responding" -ForegroundColor Green
Write-Host "🔐 401 = Needs authentication (expected)" -ForegroundColor Yellow  
Write-Host "❌ 404 = Route not found (problem)" -ForegroundColor Red
Write-Host "⚠️  500 = Server error (problem)" -ForegroundColor Red
Write-Host ""
Write-Host "If you see 500 errors, check server logs for details." -ForegroundColor White
Write-Host "If you see 404 errors, the route is not properly configured." -ForegroundColor White
