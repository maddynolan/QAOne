# Build script for Flowstral Desktop Agent
# Builds for Windows, macOS, and Linux

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Flowstral Desktop Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "[1/5] Checking dependencies..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "  npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: npm not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/5] Installing dependencies..." -ForegroundColor Yellow
npm ci --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "  Dependencies installed" -ForegroundColor Green

Write-Host ""
Write-Host "[3/5] Installing Playwright browsers..." -ForegroundColor Yellow
npx playwright install chromium
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARNING: Failed to install Playwright browsers" -ForegroundColor Yellow
}
Write-Host "  Browsers installed" -ForegroundColor Green

Write-Host ""
Write-Host "[4/5] Generating icons..." -ForegroundColor Yellow
# Check if icons exist
if (-not (Test-Path "assets/icon.png")) {
    Write-Host "  Generating placeholder icons..."
    node scripts/generate-icons.js
}
Write-Host "  Icons ready" -ForegroundColor Green

Write-Host ""
Write-Host "[5/5] Building application..." -ForegroundColor Yellow

# Build based on platform argument or build all
$platform = $args[0]

switch ($platform) {
    "win" {
        Write-Host "  Building for Windows..." -ForegroundColor Cyan
        npm run build:win
    }
    "mac" {
        Write-Host "  Building for macOS..." -ForegroundColor Cyan
        npm run build:mac
    }
    "linux" {
        Write-Host "  Building for Linux..." -ForegroundColor Cyan
        npm run build:linux
    }
    default {
        Write-Host "  Building for all platforms..." -ForegroundColor Cyan
        npm run build
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "BUILD FAILED" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Output files are in: dist/" -ForegroundColor Cyan
Write-Host ""

# List output files
if (Test-Path "dist") {
    Write-Host "Generated files:" -ForegroundColor Yellow
    Get-ChildItem -Path "dist" -File | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  $($_.Name) ($size MB)" -ForegroundColor White
    }
}

