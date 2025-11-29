# PowerShell script to run database migrations
# Connects to PostgreSQL and executes all migration files in order

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "QA AI Platform - Database Migrations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

# Auto-discover all migration files in order
$migrationsDir = "supabase\migrations"
$migrationFiles = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name | ForEach-Object { $_.Name }

Write-Host "Found $($migrationFiles.Count) migration files" -ForegroundColor Cyan
Write-Host ""

if (-not $psqlPath) {
    Write-Host "psql not found. Using Docker exec instead..." -ForegroundColor Yellow
    
    foreach ($file in $migrationFiles) {
        $filePath = Join-Path $migrationsDir $file
        if (Test-Path $filePath) {
            Write-Host "Running $file..." -ForegroundColor Yellow
            Get-Content $filePath | docker exec -i qa-postgres psql -U qaai -d qaai
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ $file completed" -ForegroundColor Green
            } else {
                Write-Host "  ✗ $file failed" -ForegroundColor Red
            }
        } else {
            Write-Host "  ⚠ $file not found, skipping" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Using psql..." -ForegroundColor Green
    
    $env:PGPASSWORD = "qaai123"
    
    foreach ($file in $migrationFiles) {
        $filePath = Join-Path $migrationsDir $file
        if (Test-Path $filePath) {
            Write-Host "Running $file..." -ForegroundColor Yellow
            psql -h localhost -U qaai -d qaai -f $filePath
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ $file completed" -ForegroundColor Green
            } else {
                Write-Host "  ✗ $file failed" -ForegroundColor Red
            }
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Migrations Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Test connection: GET http://localhost:8001/health/database" -ForegroundColor Cyan
Write-Host ""


