param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'diagnose'

try {
  Write-Host '== Diagnostics ==' -ForegroundColor Cyan
  Write-Host "Project: $root" -ForegroundColor DarkGray
  Write-Host "Log:     $log" -ForegroundColor DarkGray
  Write-Host ''

  Assert-Command git

  Push-Location $root
  try {
    $rebase = Test-GitRebaseInProgress -Root $root
    if ($rebase) {
      Write-Host '[WARN] Git rebase in progress.' -ForegroundColor Yellow
    }

    $st = git status --porcelain
    if ($st) {
      Write-Host '[WARN] Working tree has local changes.' -ForegroundColor Yellow
      $st | Out-Host
    } else {
      Write-Host '[OK] Working tree clean.' -ForegroundColor Green
    }

    if (Test-Path (Join-Path $root 'node_modules')) {
      Write-Host '[OK] node_modules exists.' -ForegroundColor Green
    } else {
      Write-Host '[WARN] node_modules missing.' -ForegroundColor Yellow
    }

    if (Test-Path (Join-Path $root 'package-lock.json')) {
      Write-Host '[OK] package-lock.json exists.' -ForegroundColor Green
    }

    if (Get-Command node -ErrorAction SilentlyContinue) {
      Write-Host ("Node: {0}" -f (node --version)) -ForegroundColor Gray
    } else {
      Write-Host '[WARN] Node is not in PATH.' -ForegroundColor Yellow
    }

    if (Get-Command npm -ErrorAction SilentlyContinue) {
      Write-Host ("npm:  {0}" -f (npm --version)) -ForegroundColor Gray
    } else {
      Write-Host '[WARN] npm is not in PATH.' -ForegroundColor Yellow
    }

    Write-Host ''
    Write-Host 'Reports:' -ForegroundColor Cyan
    $p1 = Find-LatestReportFile -ProjectRoot $root -Pattern 'preflight_report.*'
    $p2 = Find-LatestReportFile -ProjectRoot $root -Pattern 'smoke_report.*'
    if ($p1) { Write-Host ("- {0}" -f $p1.FullName) -ForegroundColor Gray }
    if ($p2) { Write-Host ("- {0}" -f $p2.FullName) -ForegroundColor Gray }

    Write-Log -LogPath $log -Message 'SUCCESS diagnose'
    exit 0
  }
  finally { Pop-Location }
}
catch {
  Write-Host '[ERROR] Diagnostics failed.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Log -LogPath $log -Message ("ERROR diagnose {0}" -f $_.Exception.Message)
  exit 1
}
