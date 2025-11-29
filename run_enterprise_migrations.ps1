# PowerShell script to run enterprise feature migrations
# Run this after setting up your database connection

Write-Host "Running Enterprise Feature Migrations..." -ForegroundColor Cyan

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "ERROR: psql command not found. Please install PostgreSQL client tools." -ForegroundColor Red
    Write-Host "You can download from: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

# Get database connection details from environment or prompt
$dbHost = $env:POSTGRES_HOST ?? "localhost"
$dbPort = $env:POSTGRES_PORT ?? "5432"
$dbName = $env:POSTGRES_DB ?? "qa_ai_platform"
$dbUser = $env:POSTGRES_USER ?? "qa_user"
$dbPassword = $env:POSTGRES_PASSWORD

if (-not $dbPassword) {
    Write-Host "Please enter database password:" -ForegroundColor Yellow
    $securePassword = Read-Host -AsSecureString
    $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    )
}

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $dbPassword

# Migration files
$migrations = @(
    "supabase/migrations/027_secrets_management.sql",
    "supabase/migrations/028_page_object_repository.sql"
)

foreach ($migration in $migrations) {
    if (Test-Path $migration) {
        Write-Host "`nRunning migration: $migration" -ForegroundColor Green
        $result = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migration 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Migration completed successfully" -ForegroundColor Green
        } else {
            Write-Host "✗ Migration failed:" -ForegroundColor Red
            Write-Host $result
        }
    } else {
        Write-Host "⚠ Migration file not found: $migration" -ForegroundColor Yellow
    }
}

Write-Host "`nMigration process completed!" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Verify tables were created: secrets, page_objects, page_elements" -ForegroundColor White
Write-Host "2. Update .env file with SECRETS_ENCRYPTION_KEY" -ForegroundColor White
Write-Host "3. Restart the backend server" -ForegroundColor White

