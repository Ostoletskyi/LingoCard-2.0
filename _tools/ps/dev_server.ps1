Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..") | Select-Object -ExpandProperty Path
Push-Location $root
try {
  Write-Host "Starting dev server (npm run dev)..." -ForegroundColor Cyan
  Write-Host "Close this window to stop it." -ForegroundColor DarkGray
  & npm run dev
} finally {
  Pop-Location
}
