param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'autofix'

try {
  Write-Host '== Auto-fix common issues ==' -ForegroundColor Cyan
  Write-Host "Project: $root" -ForegroundColor DarkGray
  Write-Host "Log:     $log" -ForegroundColor DarkGray
  Write-Host ''

  Assert-Command git
  Assert-Command node
  Assert-Command npm

  # 1) Git sync
  & (Join-Path $PSScriptRoot 'fix_git.ps1') -ProjectRoot $root
  if ($LASTEXITCODE -ne 0) { throw 'Git fix failed.' }

  # 2) Clean reinstall
  & (Join-Path $PSScriptRoot 'fix_node.ps1') -ProjectRoot $root
  if ($LASTEXITCODE -ne 0) { throw 'Node fix failed.' }

  # 3) Run checks (tsc / preflight / smoke)
  Push-Location $root
  try {
    Invoke-Logged -LogPath $log -Label 'npm run tsc' -Command { npm run tsc }
    Invoke-Logged -LogPath $log -Label 'npm run tools:preflight' -Command { npm run tools:preflight }
    Invoke-Logged -LogPath $log -Label 'npm run tools:smoke' -Command { npm run tools:smoke }
  }
  finally { Pop-Location }

  Write-Host ''
  Write-Host '[SUCCESS] Auto-fix completed and smoke passed.' -ForegroundColor Green
  Write-Log -LogPath $log -Message 'SUCCESS autofix'
  exit 0
}
catch {
  Write-Host ''
  Write-Host '[ERROR] Auto-fix failed.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Log -LogPath $log -Message ("ERROR autofix {0}" -f $_.Exception.Message)

  Write-Host ''
  Write-Host 'Next moves (manual):' -ForegroundColor Yellow
  Write-Host '- Open _reports and inspect smoke_report.md / preflight_report.md.'
  Write-Host '- If TypeScript errors remain, they are real code errors (not an environment issue).'
  Write-Host '- If npm ci fails with EPERM repeatedly, it is almost always file locking / antivirus.'

  exit 1
}
