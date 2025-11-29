# Database Setup Script for QAAI
# This script sets up PostgreSQL database and runs migrations

Write-Host "`n=== QAAI Database Setup ===" -ForegroundColor Cyan

# Check if PostgreSQL is installed
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "`n❌ PostgreSQL (psql) not found in PATH" -ForegroundColor Red
    Write-Host "Please install PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "Or add PostgreSQL bin directory to your PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ PostgreSQL found at: $($psqlPath.Source)" -ForegroundColor Green

# Database configuration
$DB_NAME = "qaai"
$DB_USER = "qaai"
$DB_PASSWORD = "qaai123"
$DB_HOST = "localhost"
$DB_PORT = "5432"

Write-Host "`n📋 Database Configuration:" -ForegroundColor Cyan
Write-Host "  Database: $DB_NAME"
Write-Host "  User: $DB_USER"
Write-Host "  Host: $DB_HOST"
Write-Host "  Port: $DB_PORT"

# Prompt for PostgreSQL admin password
Write-Host "`n⚠️  You'll need to enter the PostgreSQL 'postgres' user password" -ForegroundColor Yellow
$env:PGPASSWORD = Read-Host "Enter PostgreSQL 'postgres' user password (or press Enter if no password)"

# Create database
Write-Host "`n📦 Creating database..." -ForegroundColor Cyan
$createDbSQL = @"
CREATE DATABASE $DB_NAME;
"@

try {
    $env:PGPASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "" }
    echo $createDbSQL | psql -U postgres -h $DB_HOST -p $DB_PORT -q
    Write-Host "✅ Database '$DB_NAME' created" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Database might already exist, continuing..." -ForegroundColor Yellow
}

# Create user
Write-Host "`n👤 Creating user..." -ForegroundColor Cyan
$createUserSQL = @"
DO `$`$`$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
`$`$`$;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
"@

try {
    echo $createUserSQL | psql -U postgres -h $DB_HOST -p $DB_PORT -d $DB_NAME -q
    Write-Host "✅ User '$DB_USER' created" -ForegroundColor Green
} catch {
    Write-Host "⚠️  User might already exist, continuing..." -ForegroundColor Yellow
}

# Run migrations
Write-Host "`n📝 Running migrations..." -ForegroundColor Cyan
$migrationFiles = @(
    "supabase\migrations\001_initial_schema.sql",
    "supabase\migrations\002_ai_generations.sql",
    "supabase\migrations\003_ai_templates.sql",
    "supabase\migrations\004_requirements_table.sql",
    "supabase\migrations\005_fix_ai_generations.sql",
    "supabase\migrations\006_enhance_test_lifecycle.sql"
)

foreach ($migration in $migrationFiles) {
    if (Test-Path $migration) {
        Write-Host "  Running: $migration" -ForegroundColor Gray
        $env:PGPASSWORD = $DB_PASSWORD
        Get-Content $migration | psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -q
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ $migration" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $migration (may have errors, but continuing...)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  $migration not found, skipping..." -ForegroundColor Yellow
    }
}

Write-Host "`n✅ Database setup complete!" -ForegroundColor Green
Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart your backend server"
Write-Host "  2. Check database connection: http://localhost:8000/health/database"
Write-Host "  3. Try saving a test case`n"




