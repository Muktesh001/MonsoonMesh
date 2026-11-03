# MonsoonMesh - Sequential build + run script
# Avoids BuildKit EOF crash caused by building all images in parallel.
# Run from the project root: .\build-and-run.ps1

Set-Location $PSScriptRoot
$ErrorActionPreference = "Stop"

function Check-Docker {
    try {
        $null = docker ps 2>&1
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

Write-Host ""
Write-Host "=== MonsoonMesh startup ===" -ForegroundColor Cyan
Write-Host ""

# 1. Wait for Docker
Write-Host "[1/8] Waiting for Docker engine..." -ForegroundColor Yellow
$retries = 0
while (-not (Check-Docker) -and $retries -lt 30) {
    Start-Sleep -Seconds 5
    $retries++
    Write-Host "  Still waiting... ($($retries * 5)s)"
}
if (-not (Check-Docker)) {
    Write-Host "ERROR: Docker engine is not responding after 150s." -ForegroundColor Red
    Write-Host "Please open Docker Desktop and wait for 'Engine running', then re-run this script."
    exit 1
}
Write-Host "  Docker engine is ready." -ForegroundColor Green

# 2. Pull base images first (avoids TLS timeout mid-build)
Write-Host ""
Write-Host "[2/8] Pulling base images..." -ForegroundColor Yellow
$baseImages = @(
    "node:22-alpine",
    "nginx:1.27-alpine",
    "redis:7.4-alpine",
    "python:3.12-slim",
    "postgis/postgis:16-3.5",
    "prom/prometheus:v3.2.1",
    "grafana/grafana:11.5.2"
)
foreach ($img in $baseImages) {
    Write-Host "  Pulling $img..."
    docker pull $img 2>&1 | Select-Object -Last 1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  WARNING: Could not pull $img (will use cached or build will pull it)" -ForegroundColor Yellow
    }
}
Write-Host "  Base images ready." -ForegroundColor Green

# 3. Build images one at a time (prevents BuildKit memory/EOF crash)
Write-Host ""
Write-Host "[3/8] Building images sequentially (this takes 5-10 min on first run)..." -ForegroundColor Yellow

$services = @("postgres", "ai-service", "api", "worker", "web")
foreach ($svc in $services) {
    Write-Host ""
    Write-Host "  Building $svc..." -ForegroundColor Cyan
    docker compose build --no-cache=false $svc 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to build $svc" -ForegroundColor Red
        exit 1
    }
    Write-Host "  $svc built OK" -ForegroundColor Green
}

# 4. Bring up infrastructure first (postgres, redis)
Write-Host ""
Write-Host "[4/8] Starting database and cache..." -ForegroundColor Yellow
docker compose up -d postgres redis
Start-Sleep -Seconds 10

# Wait for postgres healthy
Write-Host "  Waiting for PostgreSQL to be ready..."
$pgReady = $false
for ($i = 0; $i -lt 24; $i++) {
    $health = docker compose ps postgres --format json 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($health.Health -eq "healthy" -or (docker compose exec -T postgres pg_isready -U monsoonmesh -d monsoonmesh 2>&1) -match "accepting") {
        $pgReady = $true
        Write-Host "  PostgreSQL ready." -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 5
    Write-Host "  Waiting for postgres... ($($i*5)s)"
}
if (-not $pgReady) {
    Write-Host "WARNING: PostgreSQL health check timed out, proceeding anyway..." -ForegroundColor Yellow
}

# 5. Run migrations + seed
Write-Host ""
Write-Host "[5/8] Running migrations and seeding demo data..." -ForegroundColor Yellow
docker compose run --rm bootstrap 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Bootstrap (migrate+seed) exited with code $LASTEXITCODE" -ForegroundColor Yellow
    Write-Host "This is OK if migrations were already applied." -ForegroundColor Yellow
}
Write-Host "  Bootstrap complete." -ForegroundColor Green

# 6. Start remaining services
Write-Host ""
Write-Host "[6/8] Starting all services..." -ForegroundColor Yellow
docker compose up -d
Write-Host "  All services started." -ForegroundColor Green

# 7. Wait for API health
Write-Host ""
Write-Host "[7/8] Waiting for API health check..." -ForegroundColor Yellow
$apiReady = $false
for ($i = 0; $i -lt 24; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:4000/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $apiReady = $true
            Write-Host "  API is healthy." -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 5
    Write-Host "  Waiting for API... ($($i*5)s)"
}
if (-not $apiReady) {
    Write-Host "WARNING: API did not respond in time. Check logs: docker compose logs api" -ForegroundColor Yellow
}

# 8. Wait for web
Write-Host ""
Write-Host "[8/8] Waiting for web frontend..." -ForegroundColor Yellow
$webReady = $false
for ($i = 0; $i -lt 12; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $webReady = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 5
    Write-Host "  Waiting for web... ($($i*5)s)"
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
if ($apiReady -and $webReady) {
    Write-Host "  MonsoonMesh is running!" -ForegroundColor Green
} else {
    Write-Host "  Services are starting (some may still be initialising)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Web UI:       http://localhost:5173" -ForegroundColor White
Write-Host "  API:          http://localhost:4000/health" -ForegroundColor White
Write-Host "  Grafana:      http://localhost:3000  (admin / monsoonmesh)" -ForegroundColor White
Write-Host "  Prometheus:   http://localhost:9090" -ForegroundColor White
Write-Host ""
Write-Host "  Demo login:" -ForegroundColor White
Write-Host "    Email:    operator@monsoonmesh.local" -ForegroundColor Cyan
Write-Host "    Password: MonsoonDemo!2026" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To view logs:  docker compose logs -f api" -ForegroundColor Gray
Write-Host "  To stop:       docker compose down" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Cyan

# Open browser
Start-Process "http://localhost:5173"
