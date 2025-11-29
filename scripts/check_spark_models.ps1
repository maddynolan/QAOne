# Check models on Spark DGX via SSH tunnel (PowerShell)
# Make sure SSH tunnel is running: ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local

Write-Host "Checking models on Spark DGX (via SSH tunnel on port 31143)..." -ForegroundColor Cyan
Write-Host ""

$response = Invoke-RestMethod -Uri "http://localhost:31143/api/tags" -Method Get
$models = $response.models

Write-Host "Available models ($($models.Count)):" -ForegroundColor Green
Write-Host ""

foreach ($model in $models) {
    $name = $model.name
    $sizeGB = [math]::Round($model.size / 1GB, 2)
    $modified = if ($model.modified_at) { $model.modified_at.Substring(0, 19) } else { "N/A" }
    
    if ($name -match "7b|7B") {
        Write-Host "  ✅ $name ($sizeGB GB) - $modified" -ForegroundColor Green
    } elseif ($name -match "30b|30B") {
        Write-Host "  ✅ $name ($sizeGB GB) - $modified" -ForegroundColor Green
    } else {
        Write-Host "  - $name ($sizeGB GB) - $modified"
    }
}

Write-Host ""
$has7b = $models | Where-Object { $_.name -match "qwen2.5-coder:7b" }
if ($has7b) {
    Write-Host "✅ 7B model (qwen2.5-coder:7b) is LOADED" -ForegroundColor Green
} else {
    Write-Host "❌ 7B model (qwen2.5-coder:7b) is NOT loaded" -ForegroundColor Red
}

