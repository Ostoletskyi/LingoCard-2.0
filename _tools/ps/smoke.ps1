param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'smoke'

try {
  Assert-Command node
  Assert-Command npm

  Push-Location $root
  try {
    if (-not (Test-Path (Join-Path $root 'node_modules'))) {
      $install = Read-Host 'node_modules is missing. Run npm install now? (Y/N)'
      if ($install -match '^(Y|y)$') {
        npm install | Out-Host
      } else {
        Write-Log -LogPath $log -Message 'CANCEL smoke node_modules_missing'
        exit 2
      }
    }

    npm run tools:smoke | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw 'Smoke test failed (npm run tools:smoke).'
    }

    Write-Host ''
    Write-Host '[OK] Smoke test passed.' -ForegroundColor Green
    Write-Host 'Reports:' -ForegroundColor Cyan
    Write-Host "- _reports\smoke_report.md" -ForegroundColor Gray
    Write-Host "- _reports\smoke_report.json" -ForegroundColor Gray

    Write-Log -LogPath $log -Message 'SUCCESS smoke'
    exit 0
  }
  finally { Pop-Location }
}
catch {
  Write-Host ''
  Write-Host '[ERROR] Smoke test failed.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Log -LogPath $log -Message ("ERROR smoke {0}" -f $_.Exception.Message)
  exit 1
}
