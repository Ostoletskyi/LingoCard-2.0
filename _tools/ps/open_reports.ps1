param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root

$reports = Join-Path $root '_reports'
if (-not (Test-Path $reports)) {
  Write-Host 'No _reports folder found yet.' -ForegroundColor Yellow
  exit 0
}

Write-Host "Opening: $reports" -ForegroundColor Cyan
Start-Process explorer.exe $reports
exit 0
