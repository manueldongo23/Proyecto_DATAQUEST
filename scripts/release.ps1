# scripts/release.ps1
# DataQuest Release Automation Script
param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [string]$Type = "patch",
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot

function Write-Step { param([string]$msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Warning { param([string]$msg) Write-Host "   [!] $msg" -ForegroundColor Yellow }
function Write-Error { param([string]$msg) Write-Host "   [FAIL] $msg" -ForegroundColor Red }

# Step 1: Validate prerequisites
Write-Step "Validando prerequisitos..."
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Error "Hay cambios sin commit. Haz commit o stash primero."
    exit 1
}
Write-Success "Working directory clean"

# Step 2: Run tests
Write-Step "Ejecutando tests..."
$testResult = & php vendor/bin/phpunit 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Tests fallaron. Cancela release."
    exit 1
}
Write-Success "Tests pasaron"

# Step 3: TypeScript check
Write-Step "Verificando TypeScript..."
$tsResult = & npx --prefix frontend tsc --noEmit 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript check fallo"
    exit 1
}
Write-Success "TypeScript OK"

# Step 4: Update version in composer.json
Write-Step "Actualizando version a $Version..."
$composer = Get-Content "$rootDir/composer.json" -Raw | ConvertFrom-Json
$composer.version = $Version
$composer | ConvertTo-Json -Depth 10 | Set-Content "$rootDir/composer.json" -Encoding UTF8
Write-Success "composer.json actualizado"

# Step 5: Update version in frontend/package.json
$pkg = Get-Content "$rootDir/frontend/package.json" -Raw | ConvertFrom-Json
$pkg.version = $Version
$pkg | ConvertTo-Json -Depth 10 | Set-Content "$rootDir/frontend/package.json" -Encoding UTF8
Write-Success "frontend/package.json actualizado"

# Step 6: Generate changelog
Write-Step "Generando changelog..."
$lastTag = git describe --tags --abbrev=0 2>$null
if (-not $lastTag) { $lastTag = "init" }
$log = git log --oneline --no-decorate --since="$lastTag" 2>$null
$dateStr = Get-Date -Format 'yyyy-MM-dd'
$changelog = @"
# Changelog

## v$Version ($dateStr)

### Features
- (list features)

### Bug Fixes
- (list fixes)

### Improvements
- (list improvements)

### Full Changelog
$log
"@
Set-Content "$rootDir/CHANGELOG.md" $changelog -Encoding UTF8
Write-Success "CHANGELOG.md generado"

# Step 7: Commit version bump
Write-Step "Creando commit de release..."
if (-not $DryRun) {
    git add composer.json frontend/package.json CHANGELOG.md
    git commit -m "Release v$Version"
    git tag -a "v$Version" -m "Version $Version"
    Write-Success "Commit y tag creados"
}

# Step 8: Summary
Write-Step "Resumen de release v$Version"
Write-Host "  Version:    $Version"
Write-Host "  Fecha:      $(Get-Date -Format 'yyyy-MM-dd')"
Write-Host ""
Write-Host "  Para publicar:"
Write-Host "    git push origin main --tags"
Write-Host ""
Write-Host "  Para crear release en GitHub:"
Write-Host "    gh release create v$Version --title 'v$Version' --notes-file CHANGELOG.md"

Write-Success "Release v$Version preparada"
