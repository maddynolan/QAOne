# PowerShell script to set up PostgreSQL for QA AI Platform

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "QA AI Platform - PostgreSQL Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is available
$dockerAvailable = $false
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker is available" -ForegroundColor Green
        $dockerAvailable = $true
    }
} catch {
    Write-Host "✗ Docker not found" -ForegroundColor Yellow
}

if ($dockerAvailable) {
    Write-Host ""
    Write-Host "Setting up PostgreSQL using Docker..." -ForegroundColor Yellow
    
    # Check if container already exists
    $existingContainer = docker ps -a --filter "name=qa-postgres" --format "{{.Names}}" 2>&1
    
    if ($existingContainer -eq "qa-postgres") {
        Write-Host "Container 'qa-postgres' already exists" -ForegroundColor Yellow
        $response = Read-Host "Do you want to (R)estart it or (D)elete and recreate? (R/D, default: R)"
        
        if ($response -eq "D") {
            Write-Host "Removing existing container..." -ForegroundColor Yellow
            docker stop qa-postgres 2>&1 | Out-Null
            docker rm qa-postgres 2>&1 | Out-Null
            Write-Host "Starting fresh PostgreSQL container..." -ForegroundColor Yellow
            docker-compose up -d
        } else {
            Write-Host "Starting existing container..." -ForegroundColor Yellow
            docker start qa-postgres 2>&1 | Out-Null
        }
    } else {
        Write-Host "Creating new PostgreSQL container..." -ForegroundColor Yellow
        docker-compose up -d
    }
    
    Write-Host ""
    Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
    $maxWait = 30
    $waited = 0
    
    do {
        Start-Sleep -Seconds 2
        $waited += 2
        $health = docker exec qa-postgres pg_isready -U qaai 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ PostgreSQL is ready!" -ForegroundColor Green
            break
        }
        Write-Host "  Waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
    } while ($waited -lt $maxWait)
    
    if ($waited -ge $maxWait) {
        Write-Host "✗ PostgreSQL did not start in time" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "PostgreSQL Setup Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Connection Details:" -ForegroundColor Cyan
    Write-Host "  Host: localhost" -ForegroundColor White
    Write-Host "  Port: 5432" -ForegroundColor White
    Write-Host "  Database: qaai" -ForegroundColor White
    Write-Host "  User: qaai" -ForegroundColor White
    Write-Host "  Password: qaai123" -ForegroundColor White
    Write-Host ""
    Write-Host "Connection String:" -ForegroundColor Cyan
    Write-Host "  postgres://qaai:qaai123@localhost:5432/qaai" -ForegroundColor White
    Write-Host ""
    
} else {
    Write-Host ""
    Write-Host "Docker not available. Manual PostgreSQL setup required." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install PostgreSQL manually or install Docker." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "For Docker installation:" -ForegroundColor Cyan
    Write-Host "  Visit: https://docs.docker.com/get-docker/" -ForegroundColor White
    Write-Host ""
    Write-Host "For manual PostgreSQL:" -ForegroundColor Cyan
    Write-Host "  1. Install PostgreSQL 16" -ForegroundColor White
    Write-Host "  2. Create database: CREATE DATABASE qaai;" -ForegroundColor White
    Write-Host "  3. Create user: CREATE USER qaai WITH PASSWORD 'qaai123';" -ForegroundColor White
    Write-Host "  4. Grant privileges: GRANT ALL PRIVILEGES ON DATABASE qaai TO qaai;" -ForegroundColor White
    exit 1
}

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run migrations (see SETUP.md)" -ForegroundColor White
Write-Host "  2. Set DATABASE_URL in .env file" -ForegroundColor White
Write-Host "  3. Test connection: GET http://localhost:8001/health/database" -ForegroundColor White
Write-Host ""

