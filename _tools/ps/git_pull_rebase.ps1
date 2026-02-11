param(
  [string]$ProjectRoot,
  [string]$LogPath,
  [switch]$StatusOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "common.ps1")

$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log  = Resolve-LogPath $root $LogPath

function Write-LogLine([string]$msg) {
  $ts = (Get-Date).ToString("s")
  Add-Content -Path $log -Value "[$ts] $msg"
}

function Ensure-GitSafeDirectory([string]$dir) {
  try {
    & git -C $dir status 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) { return }
  } catch {}

  # If git complains about dubious ownership, add safe.directory.
  $tmp = Join-Path $env:TEMP ("lc_git_safe_" + [Guid]::NewGuid().ToString("N") + ".txt")
  try {
    & git -C $dir status 1>$tmp 2>&1
    $out = Get-Content $tmp -Raw
    if ($out -match "detected dubious ownership") {
      Write-Host "[WARN] Git reports dubious ownership for:" -ForegroundColor Yellow
      Write-Host "       $dir" -ForegroundColor Yellow
      Write-Host "       Adding git safe.directory (global)..." -ForegroundColor Yellow
      & git config --global --add safe.directory $dir
      if ($LASTEXITCODE -ne 0) { throw "Failed to add git safe.directory for $dir" }
      Write-Host "[OK] safe.directory added." -ForegroundColor Green
      Write-LogLine "Added safe.directory: $dir"
    }
  } finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
  }
}

function Get-Dirty {
  $s = & git -C $root status --porcelain
  return ($s -and $s.Count -gt 0)
}

function Prompt-DirtyResolution {
  Write-Host ""
  Write-Host "[WARN] Working tree has uncommitted changes." -ForegroundColor Yellow
  Write-Host "Pull --rebase cannot continue until you choose an action:" -ForegroundColor Yellow
  Write-Host "  1) Stash changes (recommended)"
  Write-Host "  2) Commit WIP (quick commit message: WIP)"
  Write-Host "  3) Cancel"
  Write-Host "  4) Discard changes (DANGEROUS)"
  Write-Host ""
  $choice = Read-Host "Select option (1-4)"
  return $choice
}

function Do-PullRebase {
  Write-Host "Running: git pull --rebase" -ForegroundColor Cyan
  Write-LogLine "git pull --rebase"
  & git -C $root pull --rebase
  if ($LASTEXITCODE -ne 0) { throw "git pull --rebase failed." }
}

# --- status only
Ensure-GitSafeDirectory $root
if ($StatusOnly) {
  & git -C $root status
  exit 0
}

try {
  if (-not (Test-Path (Join-Path $root ".git"))) {
    throw "Current folder is not a git repository: $root"
  }

  if (Get-Dirty) {
    $choice = Prompt-DirtyResolution
    switch ($choice) {
      "1" {
        Write-Host "Stashing (including untracked)..." -ForegroundColor Cyan
        Write-LogLine "git stash push -u -m WIP before pull --rebase"
        & git -C $root stash push -u -m "WIP before pull --rebase"
        if ($LASTEXITCODE -ne 0) { throw "git stash failed." }

        Do-PullRebase

        Write-Host "Restoring stash..." -ForegroundColor Cyan
        Write-LogLine "git stash pop"
        & git -C $root stash pop
        if ($LASTEXITCODE -ne 0) {
          Write-Host "[WARN] git stash pop returned non-zero. Resolve conflicts if any." -ForegroundColor Yellow
          Write-LogLine "stash pop non-zero (possible conflicts)"
        }
      }
      "2" {
        Write-Host "Committing WIP..." -ForegroundColor Cyan
        & git -C $root add -A
        if ($LASTEXITCODE -ne 0) { throw "git add failed." }
        & git -C $root commit -m "WIP"
        if ($LASTEXITCODE -ne 0) { throw "git commit failed (maybe nothing to commit?)." }

        Do-PullRebase
      }
      "4" {
        Write-Host ""
        $confirm = Read-Host "THIS WILL DELETE LOCAL CHANGES. Type YES to continue"
        if ($confirm -ne "YES") { throw "Canceled." }
        Write-Host "Resetting hard and cleaning..." -ForegroundColor Yellow
        Write-LogLine "git reset --hard; git clean -fd"
        & git -C $root reset --hard
        if ($LASTEXITCODE -ne 0) { throw "git reset --hard failed." }
        & git -C $root clean -fd
        if ($LASTEXITCODE -ne 0) { throw "git clean -fd failed." }

        Do-PullRebase
      }
      default {
        throw "Canceled."
      }
    }
  } else {
    Do-PullRebase
  }

  Write-Host "Git status:" -ForegroundColor Cyan
  & git -C $root status
  Write-LogLine "Success."
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  Write-LogLine ("ERROR: " + $_.Exception.Message)
  exit 1
}
