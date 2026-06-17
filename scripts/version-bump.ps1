param(
    [ValidateSet('major', 'minor', 'patch', 'rc')]
    [string]$Type = 'patch',
    
    [switch]$DryRun
)

$composer = Get-Content composer.json | ConvertFrom-Json
$current = $composer.version
$parts = $current -split '\.'
$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

switch ($Type) {
    'major' { $major++; $minor = 0; $patch = 0 }
    'minor' { $minor++; $patch = 0 }
    'patch' { $patch++ }
    'rc' { $patch++; $patch--; $newVersion = "$major.$minor.$patch-rc" }
}

if (-not $newVersion) { $newVersion = "$major.$minor.$patch" }

Write-Host "Current: $current -> New: $newVersion" -ForegroundColor Cyan

if (-not $DryRun) {
    $composer.version = $newVersion
    $composer | ConvertTo-Json -Depth 10 | Set-Content composer.json
    
    $pkg = Get-Content frontend/package.json | ConvertFrom-Json
    $pkg.version = $newVersion
    $pkg | ConvertTo-Json -Depth 10 | Set-Content frontend/package.json
    
    Set-Content VERSION $newVersion
    Write-Host "[OK] Version bumped to $newVersion" -ForegroundColor Green
}
