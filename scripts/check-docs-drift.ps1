# scripts/check-docs-drift.ps1
# Standalone documentation drift checker

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot

Write-Host "Checking API documentation drift..." -ForegroundColor Cyan

# Extract routes from routes/api.php
$routesFile = Join-Path $rootDir "routes/api.php"
$routePattern = 'Route::(get|post|put|delete|patch)\([''"](\/[^''"]+)[''"]'
$apiRoutes = @{}
Get-Content $routesFile | Select-String -Pattern $routePattern | ForEach-Object {
    $method = $_.Matches[0].Groups[1].Value.ToUpper()
    $path = $_.Matches[0].Groups[2].Value
    $apiRoutes["$method $path"] = $true
}

# Extract documented endpoints from API_DOCUMENTATION.md
$docFile = Join-Path $rootDir "API_DOCUMENTATION.md"
$docPattern = '### (GET|POST|PUT|DELETE|PATCH)\s+`?\/?([a-z0-9\/\-\{\}_.]+)`?'
$docRoutes = @{}
Get-Content $docFile | Select-String -Pattern $docPattern | ForEach-Object {
    $method = $_.Matches[0].Groups[1].Value.ToUpper()
    $path = '/' + $_.Matches[0].Groups[2].Value.TrimStart('/')
    $docRoutes["$method $path"] = $true
}

# Find missing
$missing = @()
$undocumented = @()

foreach ($route in $apiRoutes.Keys) {
    $found = $false
    foreach ($docRoute in $docRoutes.Keys) {
        $routeNorm = $route -replace '\{[^}]+\}', '\w+'
        $docNorm = $docRoute -replace '\{[^}]+\}', '\w+'
        if ($routeNorm -eq $docNorm) {
            $found = $true
            break
        }
    }
    if (-not $found) { $undocumented += $route }
}

foreach ($docRoute in $docRoutes.Keys) {
    $found = $false
    foreach ($route in $apiRoutes.Keys) {
        $routeNorm = $route -replace '\{[^}]+\}', '\w+'
        $docNorm = $docRoute -replace '\{[^}]+\}', '\w+'
        if ($routeNorm -eq $docNorm) {
            $found = $true
            break
        }
    }
    if (-not $found) { $missing += $docRoute }
}

$hasErrors = $false

if ($undocumented.Count -gt 0) {
    Write-Host "`n[WARNING] Rutas implementadas pero NO documentadas:" -ForegroundColor Yellow
    $undocumented | Sort-Object | ForEach-Object { Write-Host "   $_" }
    $hasErrors = $true
}

if ($missing.Count -gt 0) {
    Write-Host "`n[ERROR] Endpoints documentados pero NO implementados:" -ForegroundColor Red
    $missing | Sort-Object | ForEach-Object { Write-Host "   $_" }
    $hasErrors = $true
}

if (-not $hasErrors) {
    Write-Host "`n[OK] No se detecto drift documental." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nResumen:" -ForegroundColor Cyan
    Write-Host "   Rutas implementadas: $($apiRoutes.Count)"
    Write-Host "   Endpoints documentados: $($docRoutes.Count)"
    Write-Host "   Sin documentar: $($undocumented.Count)"
    Write-Host "   Documentados sin implementar: $($missing.Count)"
    exit 1
}
