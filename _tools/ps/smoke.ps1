Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..") | Select-Object -ExpandProperty Path
Push-Location $root
try {
  Write-Host "Running smoke checks..." -ForegroundColor Cyan
  & npm run tools:smoke
  if ($LASTEXITCODE -ne 0) { throw "Smoke test failed (npm run tools:smoke)." }
  Write-Host "Smoke test OK." -ForegroundColor Green
} finally {
  Pop-Location
}
