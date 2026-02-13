param(
  [Parameter(Mandatory=$false)]
  [string]$Root = (Get-Location).Path
)

# ============================================================
# LingoCard 2.0 - Git Toolbox (Pull / Push / Check)
# PowerShell 5.1 compatible
# - Launcher repo.cmd elevates to Admin
# - English-only output to avoid encoding issues
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Header {
  Clear-Host
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host "LingoCard 2.0 - Git Toolbox (Pull / Push / Check)" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host "Root: $Root" -ForegroundColor Gray
  Write-Host ""
  Write-Host "[1] Pull  (git pull --rebase + smoke)" -ForegroundColor Green
  Write-Host "[2] Push  (smoke + git push)" -ForegroundColor Green
  Write-Host "[3] Check (git status + smoke)" -ForegroundColor Green
  Write-Host "[0] Exit" -ForegroundColor Yellow
  Write-Host ""
}

function Require-Tool([string]$name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "Required tool not found in PATH: $name" }
}

function Run([string]$title, [scriptblock]$block) {
  Write-Host "----------------------------------------------" -ForegroundColor DarkGray
  Write-Host $title -ForegroundColor Cyan
  try {
    & $block
  } catch {
    Write-Host ""
    Write-Host "[ERROR] $title failed." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to continue"
    return $false
  }
  return $true
}

function Ensure-GitSafeDirectory {
  $out = & git -C $Root status 2>&1
  if ($LASTEXITCODE -eq 0) { return }

  if ($out -match "detected dubious ownership") {
    Write-Host "[WARN] Git reported 'dubious ownership'. Auto-fixing safe.directory..." -ForegroundColor Yellow
    & git config --global --add safe.directory $Root
    if ($LASTEXITCODE -ne 0) { throw "Failed to set git safe.directory for: $Root" }
    Write-Host "[OK] safe.directory added." -ForegroundColor Green
  }
}

function Get-WorkingTreeState {
  $lines = @()
  $lines = & git -C $Root status --porcelain 2>$null
  $dirty = ($lines -and $lines.Count -gt 0)
  return @{ IsDirty = $dirty; Lines = $lines }
}

function Offer-CleanWorkingTree {
  param(
    [Parameter(Mandatory=$true)][string]$ForAction
  )
  $st = Get-WorkingTreeState
  if (-not $st.IsDirty) { return $true }

  Write-Host ""
  Write-Host "[WARN] Working tree is not clean. $ForAction requires a clean tree." -ForegroundColor Yellow
  Write-Host "       Detected changes:" -ForegroundColor Gray
  $st.Lines | ForEach-Object { Write-Host "       $_" -ForegroundColor DarkGray }
  Write-Host ""
  Write-Host "[1] Stash changes (including untracked)  [recommended]" -ForegroundColor Green
  Write-Host "[2] Commit WIP (quick commit)" -ForegroundColor Green
  Write-Host "[3] Cancel" -ForegroundColor Yellow
  Write-Host ""
  $choice = Read-Host "Select option (1-3)"

  switch ($choice) {
    "1" {
      & git -C $Root stash push -u -m 'WIP before rebase'
      if ($LASTEXITCODE -ne 0) { throw "git stash failed" }
      return "stashed"
    }
    "2" {
      & git -C $Root add -A
      if ($LASTEXITCODE -ne 0) { throw "git add failed" }
      & git -C $Root commit -m 'WIP'
      if ($LASTEXITCODE -ne 0) { throw "git commit failed (maybe nothing to commit?)" }
      return "committed"
    }
    default {
      return $false
    }
  }
}

function Run-Smoke {
  return Run "Smoke test: npm run tools:smoke" { & npm run tools:smoke }
}

function Do-Pull {
  Ensure-GitSafeDirectory

  $cleanResult = Offer-CleanWorkingTree -ForAction "Pull --rebase"
  if ($cleanResult -eq $false) { return }

  $ok = Run "Git pull --rebase" { & git -C $Root pull --rebase }
  if (-not $ok) { return }

  $smokeOk = Run-Smoke
  if (-not $smokeOk) { return }

  if ($cleanResult -eq "stashed") {
    Run "Stash pop" { & git -C $Root stash pop } | Out-Null
  }

  Run "Git status" { & git -C $Root status } | Out-Null
}

function Do-Push {
  Ensure-GitSafeDirectory

  $smokeOk = Run-Smoke
  if (-not $smokeOk) { return }

  $st = Get-WorkingTreeState
  if ($st.IsDirty) {
    Write-Host ""
    Write-Host "[WARN] You have local changes. Push will not include them unless committed." -ForegroundColor Yellow
    Write-Host "[1] Commit WIP (include untracked)" -ForegroundColor Green
    Write-Host "[2] Continue push without committing" -ForegroundColor Yellow
    Write-Host "[3] Cancel" -ForegroundColor Yellow
    Write-Host ""
    $c = Read-Host "Select option (1-3)"
    if ($c -eq "1") {
      Run "git add -A" { & git -C $Root add -A } | Out-Null
      Run "git commit -m 'WIP'" { & git -C $Root commit -m 'WIP' } | Out-Null
    } elseif ($c -eq "3") {
      return
    }
  }

  $pushed = Run "Git push" { & git -C $Root push }
  if ($pushed) { return }

  Write-Host "[INFO] Push failed. Trying: git pull --rebase, then retry push..." -ForegroundColor Cyan
  $cleanResult = Offer-CleanWorkingTree -ForAction "Auto rebase before push"
  if ($cleanResult -eq $false) { return }

  $ok = Run "Git pull --rebase" { & git -C $Root pull --rebase }
  if (-not $ok) { return }

  if ($cleanResult -eq "stashed") {
    Run "Stash pop" { & git -C $Root stash pop } | Out-Null
  }

  Run "Git push (retry)" { & git -C $Root push } | Out-Null
}

function Do-Check {
  Ensure-GitSafeDirectory
  Run "Git status" { & git -C $Root status } | Out-Null
  Run-Smoke | Out-Null
}

# ---- Entry
try {
  Set-Location -Path $Root
  Require-Tool git
  Require-Tool node
  Require-Tool npm
} catch {
  Write-Host "[FATAL] $($_.Exception.Message)" -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

while ($true) {
  Write-Header
  $opt = Read-Host "Select option (0-3)"
  switch ($opt) {
    "1" { Do-Pull }
    "2" { Do-Push }
    "3" { Do-Check }
    "0" { break }
    default {
      Write-Host ""
      Write-Host "[WARN] Unknown option: $opt" -ForegroundColor Yellow
      Start-Sleep -Milliseconds 800
    }
  }
}

exit 0
