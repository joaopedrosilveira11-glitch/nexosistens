# Deployment helper for staging/production (PowerShell)
# Usage: Open an elevated PowerShell where node/npm are available and run: .\scripts\deploy-staging.ps1 -Environment "staging"
param(
  [string]$Environment = 'staging'
)

$ErrorActionPreference = 'Stop'
Write-Host "Preparing build for environment: $Environment"

# Validate important env var (will read from current environment)
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
  Write-Error "SUPABASE_SERVICE_ROLE_KEY is not set in the environment. Aborting."; exit 1
}

# Build backend
Write-Host "Building backend..."
Push-Location -Path "./backend"
npm install --no-audit --no-fund
npm run build
Pop-Location

# Build frontend
Write-Host "Building frontend..."
npm install --no-audit --no-fund
npm run build

# Package artifacts
$timestamp = (Get-Date).ToString('yyyyMMddHHmmss')
$releaseDir = "release"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$zipName = "$releaseDir\nexo-release-$Environment-$timestamp.zip"

Write-Host "Packaging release to $zipName"
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Create a temp folder to stage files
$staging = Join-Path $env:TEMP "nexo-deploy-$timestamp"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging | Out-Null

# Copy backend dist and package.json
if (Test-Path "backend/dist") { Copy-Item -Path "backend/dist" -Destination (Join-Path $staging "backend/dist") -Recurse }
Copy-Item -Path "backend/package.json" -Destination (Join-Path $staging "backend/package.json") -Force

# Copy frontend build
if (Test-Path "dist") { Copy-Item -Path "dist" -Destination (Join-Path $staging "dist") -Recurse }

# Create zip from staged folder
if (Test-Path $zipName) { Remove-Item $zipName -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $zipName)

# Cleanup staging
Remove-Item $staging -Recurse -Force

Write-Host "Release package created: $zipName"

Write-Host "Next steps (manual):"
Write-Host "1. Upload $zipName to your staging/production host."
Write-Host "2. On the host, extract the archive to the deployment folder."
Write-Host "3. Ensure environment variables are configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, etc.)."
Write-Host "4. If using systemd: restart service (example): sudo systemctl restart nexo-backend"
Write-Host "   If using pm2: pm2 restart nexo-backend or pm2 start backend/dist/index.js --name nexo-backend --update-env"
Write-Host "5. Run DB migrations if needed."
Write-Host "6. Verify health: curl -sS http://localhost:4000/api/health"

Write-Host "Deployment helper finished."