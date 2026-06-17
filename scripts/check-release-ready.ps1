Write-Host "Release Readiness Check" -ForegroundColor Cyan
Write-Host "======================="

$allPassed = $true

Write-Host ""

# PHPUnit tests
$output = php vendor/bin/phpunit --no-coverage 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [PASS] PHPUnit tests" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] PHPUnit tests" -ForegroundColor Red
    $allPassed = $false
}

# TypeScript check
$output = & "npx" --prefix frontend tsc --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [PASS] TypeScript check" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] TypeScript check" -ForegroundColor Red
    $allPassed = $false
}

# No uncommitted changes
$gitStatus = git status --porcelain
if ($gitStatus -eq "") {
    Write-Host "  [PASS] No uncommitted changes" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] No uncommitted changes" -ForegroundColor Red
    $allPassed = $false
}

# CHANGELOG.md updated
if (Test-Path "CHANGELOG.md") {
    Write-Host "  [PASS] CHANGELOG.md updated" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] CHANGELOG.md updated" -ForegroundColor Red
    $allPassed = $false
}

# VERSION file exists
if (Test-Path "VERSION") {
    Write-Host "  [PASS] VERSION file exists" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] VERSION file exists" -ForegroundColor Red
    $allPassed = $false
}

# No syntax errors
$output = php -l routes/api.php 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [PASS] No syntax errors" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] No syntax errors" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""
if ($allPassed) {
    Write-Host "ALL CHECKS PASSED -- Ready for release" -ForegroundColor Green
    exit 0
} else {
    Write-Host "SOME CHECKS FAILED -- Fix before release" -ForegroundColor Red
    exit 1
}
