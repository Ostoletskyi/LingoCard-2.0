$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$logDir = Join-Path $PSScriptRoot "..\..\_reports"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("repo_toolbox_{0}.log" -f (Get-Date -Format "yyyyMMdd_HHmmss"))

Start-Transcript -Path $logFile -Append | Out-Null
try {
    # --- SCRIPT BODY CONTINUES BELOW ---
}
catch {
    Write-Host ""
    Write-Host "[FATAL] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Log saved: $logFile" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
finally {
    Stop-Transcript | Out-Null
}


#requires -Version 5.1
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet("pull","push","check")]
  [string]$Action
)

$ErrorActionPreference = "Stop"

function Require-Exe($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "Required tool not found in PATH: $name" }
}

function Run([string]$title, [string]$exe, [string[]]$args) {
  Write-Host ""
  Write-Host "== $title ==" -ForegroundColor Cyan
  Write-Host "> $exe $($args -join ' ')"
  & $exe @args
  if ($LASTEXITCODE -ne 0) { throw "Step failed ($LASTEXITCODE): $title" }
}

# Project root = parent of _tools
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $Root

Require-Exe git
Require-Exe node
Require-Exe npm

# Fix "dubious ownership" automatically (common on Windows)
try {
  & git status --porcelain 1>$null 2>$null
} catch {
  # ignore; we'll diagnose below
}
$gitStatusOut = & git status 2>&1
if ($gitStatusOut -match "detected dubious ownership") {
  Run "Git safe.directory fix" "git" @("config","--global","--add","safe.directory",$Root.Path)
}

function Is-Dirty {
  $out = & git status --porcelain
  return ($out -and $out.Count -gt 0)
}

switch ($Action) {
  "pull" {
    if (Is-Dirty) {
      throw "Working tree is dirty. Commit or stash first (I refuse to overwrite local changes)."
    }
    Run "Git pull --rebase" "git" @("pull","--rebase")
    Run "Smoke test" "npm" @("run","tools:smoke")
    Run "Git status" "git" @("status")
  }

  "push" {
    # Push SHOULD NOT silently commit for you. It's safer.
    if (Is-Dirty) {
      throw "Working tree is dirty. Commit your changes first, then run push."
    }
    Run "Smoke test" "npm" @("run","tools:smoke")
    Run "Git push" "git" @("push")
    Run "Git status" "git" @("status")
  }

  "check" {
    Run "Git status" "git" @("status")
    Run "Smoke test" "npm" @("run","tools:smoke")
  }
}

Write-Host ""
Write-Host "OK." -ForegroundColor Green
