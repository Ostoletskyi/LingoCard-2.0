param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ProjectRoot {
  param([string]$ProvidedRoot)

  if ($ProvidedRoot -and (Test-Path $ProvidedRoot)) {
    return (Resolve-Path $ProvidedRoot).Path
  }

  return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Ensure-ToolDirs {
  param([string]$ProjectRoot)

  @('_tools\ps', '_tools\backups', '_tools\reports', '_tools\tmp') | ForEach-Object {
    $dir = Join-Path $ProjectRoot $_
    if (-not (Test-Path $dir)) {
      New-Item -Path $dir -ItemType Directory -Force | Out-Null
    }
  }
}

function New-LogPath {
  param([string]$ProjectRoot, [string]$Prefix)

  $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  return (Join-Path $ProjectRoot ("_tools\reports\{0}_{1}.log" -f $Prefix, $stamp))
}

function Write-Log {
  param([string]$LogPath, [string]$Message)

  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -Path $LogPath -Value $line -Encoding utf8
}

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or not available in PATH."
  }
}

function Invoke-Logged {
  param(
    [string]$LogPath,
    [string]$Label,
    [scriptblock]$Command,
    [switch]$IgnoreExitCode
  )

  Write-Host "-- $Label" -ForegroundColor Cyan
  Write-Log -LogPath $LogPath -Message "INFO $Label"

  & $Command | Out-Host

  $code = $LASTEXITCODE
  if ($null -eq $code) { $code = 0 }

  if (-not $IgnoreExitCode -and $code -ne 0) {
    Write-Log -LogPath $LogPath -Message "ERROR $Label exit=$code"
    throw "$Label failed (exit code $code)."
  }

  Write-Log -LogPath $LogPath -Message "OK $Label exit=$code"
  return $code
}

function Test-GitRebaseInProgress {
  param([string]$Root)

  $gitDir = Join-Path $Root '.git'
  if (-not (Test-Path $gitDir)) { return $false }

  return (Test-Path (Join-Path $gitDir 'rebase-merge')) -or (Test-Path (Join-Path $gitDir 'rebase-apply'))
}

function Get-GitStatusPorcelain {
  param([string]$Root)
  Push-Location $Root
  try {
    return (git status --porcelain) 2>$null
  } finally { Pop-Location }
}

function Find-LatestReportFile {
  param([string]$ProjectRoot, [string]$Pattern)

  $dir = Join-Path $ProjectRoot '_reports'
  if (-not (Test-Path $dir)) { return $null }

  return Get-ChildItem -Path $dir -Filter $Pattern -File -ErrorAction SilentlyContinue |
    Sort-Object -Property LastWriteTime -Descending |
    Select-Object -First 1
}
