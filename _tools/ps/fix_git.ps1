param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'fix_git'

try {
  Assert-Command git

  Write-Host '== Fix Git ==' -ForegroundColor Cyan
  Write-Host "Project: $root" -ForegroundColor DarkGray
  Write-Host "Log:     $log" -ForegroundColor DarkGray
  Write-Host ''

  Push-Location $root
  try {
    $st = git status --porcelain
    if ($st) {
      $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
      Invoke-Logged -LogPath $log -Label "git stash (stash-safe)" -Command { git stash push -u -m "toolbox_autostash_$stamp" }
    }

    Invoke-Logged -LogPath $log -Label 'git fetch --all --prune' -Command { git fetch --all --prune }

    $rebase = Test-GitRebaseInProgress -Root $root
    if ($rebase) {
      Write-Host '[WARN] Rebase detected. Attempting to continue if possible...' -ForegroundColor Yellow
      Write-Log -LogPath $log -Message 'WARN rebase_detected'

      git rebase --continue 2>$null | Out-Host
      if ($LASTEXITCODE -ne 0) {
        Write-Host '[WARN] Cannot auto-continue rebase. Aborting rebase to unlock repository.' -ForegroundColor Yellow
        Write-Log -LogPath $log -Message 'WARN rebase_continue_failed; aborting'
        git rebase --abort | Out-Host
      }
    }

    Invoke-Logged -LogPath $log -Label 'git pull --rebase' -Command { git pull --rebase }

    Write-Host '[OK] Git sync complete.' -ForegroundColor Green
    Write-Log -LogPath $log -Message 'SUCCESS fix_git'
    exit 0
  }
  finally { Pop-Location }
}
catch {
  Write-Host '[ERROR] Git fix failed.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Log -LogPath $log -Message ("ERROR fix_git {0}" -f $_.Exception.Message)
  exit 1
}
