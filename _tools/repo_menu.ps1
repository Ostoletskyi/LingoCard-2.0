#requires -Version 5.1
$ErrorActionPreference = "Stop"

function Require-Exe($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "Required tool not found in PATH: $name" }
}

function Run([string]$title, [string]$exe, [string[]]$args) {
  Write-Host ""
  Write-Host "== $title ==" -ForegroundColor Cyan
  Write-Host ("> " + $exe + " " + ($args -join " "))
  & $exe @args
  if ($LASTEXITCODE -ne 0) { throw "Step failed ($LASTEXITCODE): $title" }
}

function Pause-AnyKey {
  Write-Host ""
  Write-Host "Press any key to continue..." -ForegroundColor DarkGray
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Is-Dirty {
  $out = & git status --porcelain
  return ($out -and $out.Count -gt 0)
}

function Ensure-GitSafeDir([string]$rootPath) {
  # Run a command and parse output for the "dubious ownership" case
  $out = & git status 2>&1
  if ($out -match "detected dubious ownership") {
    Run "Git safe.directory fix" "git" @("config","--global","--add","safe.directory",$rootPath)
  }
}

function Show-Header([string]$rootPath) {
  Clear-Host
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host " LingoCard 2.0 - Git Toolbox (Pull / Push / Check)" -ForegroundColor White
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host ("Root: " + $rootPath) -ForegroundColor DarkGray
  Write-Host ""
}

function Do-Pull([string]$rootPath) {
  if (Is-Dirty) {
    throw "Working tree is dirty. Commit or stash first (I won't overwrite local changes)."
  }
  Run "Git pull --rebase" "git" @("pull","--rebase")
  Run "Smoke test" "npm" @("run","tools:smoke")
  Run "Git status" "git" @("status")
}

function Do-Push([string]$rootPath) {
  if (Is-Dirty) {
    throw "Working tree is dirty. Commit your changes first, then push."
  }
  Run "Smoke test" "npm" @("run","tools:smoke")
  Run "Git push" "git" @("push")
  Run "Git status" "git" @("status")
}

function Do-Check([string]$rootPath) {
  Run "Git status" "git" @("status")
  Run "Smoke test" "npm" @("run","tools:smoke")
}

# --- Determine project root (parent of _tools)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $Root

# --- Tools
Require-Exe git
Require-Exe node
Require-Exe npm

# --- Fix Git "dubious ownership" once if needed
Ensure-GitSafeDir $Root.Path

while ($true) {
  Show-Header $Root.Path

  Write-Host "[1] Pull (git pull --rebase + smoke)" -ForegroundColor Green
  Write-Host "[2] Push (smoke + git push)" -ForegroundColor Green
  Write-Host "[3] Check (git status + smoke)" -ForegroundColor Green
  Write-Host "[0] Exit" -ForegroundColor Yellow
  Write-Host ""
  $choice = Read-Host "Select option (0-3)"

  try {
    switch ($choice) {
      "1" { Do-Pull  $Root.Path; Pause-AnyKey }
      "2" { Do-Push  $Root.Path; Pause-AnyKey }
      "3" { Do-Check $Root.Path; Pause-AnyKey }
      "0" { break }
      default { Write-Host "Unknown option." -ForegroundColor Red; Pause-AnyKey }
    }
  }
  catch {
    Write-Host ""
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Tip:" -ForegroundColor DarkGray
    Write-Host " - If it says 'dirty', run: git status, then commit or stash manually." -ForegroundColor DarkGray
    Write-Host " - If it says 'safe.directory', run the menu again (it auto-fixes) or run:" -ForegroundColor DarkGray
    Write-Host ("   git config --global --add safe.directory " + $Root.Path) -ForegroundColor DarkGray
    Pause-AnyKey
  }
}
