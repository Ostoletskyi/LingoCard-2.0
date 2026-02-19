param(
  [string]$ProjectRoot,
  [switch]$Elevated
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'env_autosetup'

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-AdminSession {
  if (Test-IsAdmin) {
    Write-Host '[OK] Running elevated.' -ForegroundColor Green
    return
  }

  Write-Host '[WARN] Admin rights required. Elevating...' -ForegroundColor Yellow
  Write-Log -LogPath $log -Message 'INFO elevation_requested'

  $args = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$PSCommandPath`"",
    '-ProjectRoot', "`"$root`"",
    '-Elevated'
  )

  $p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($args -join ' ') -Wait -PassThru
  $code = $p.ExitCode
  if ($null -eq $code) { $code = 0 }
  exit $code
}

function Ensure-Chocolatey {
  if (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host '[OK] Chocolatey detected.' -ForegroundColor Green
    Write-Log -LogPath $log -Message 'INFO choco_exists'
    return
  }

  Write-Host '[INFO] Installing Chocolatey...' -ForegroundColor Cyan
  Write-Log -LogPath $log -Message 'INFO choco_install_start'

  Set-ExecutionPolicy Bypass -Scope Process -Force
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
  Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

  if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    $chocoExe = 'C:\ProgramData\chocolatey\bin\choco.exe'
    if (Test-Path $chocoExe) {
      $env:Path = "$(Split-Path $chocoExe -Parent);$env:Path"
    }
  }

  if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    throw 'Chocolatey installation failed.'
  }

  Write-Host '[OK] Chocolatey installed.' -ForegroundColor Green
  Write-Log -LogPath $log -Message 'INFO choco_install_done'
}

function Install-ChocoPackages {
  param([string[]]$Packages)

  foreach ($pkg in $Packages) {
    Write-Host "[INFO] Installing/upgrading $pkg ..." -ForegroundColor Cyan
    Write-Log -LogPath $log -Message "INFO choco_upgrade $pkg"

    choco upgrade $pkg --yes --no-progress --limit-output --accept-license | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to install package: $pkg"
    }

    Write-Host "[OK] $pkg ready." -ForegroundColor Green
    Write-Log -LogPath $log -Message "OK choco_upgrade $pkg"
  }
}

function Assert-InstalledTools {
  $checks = @(
    @{ Name = 'git'; Cmd = { git --version } },
    @{ Name = 'node'; Cmd = { node --version } },
    @{ Name = 'npm'; Cmd = { npm --version } },
    @{ Name = 'python'; Cmd = { python --version } }
  )

  foreach ($check in $checks) {
    Assert-Command $check.Name
    $version = & $check.Cmd
    Write-Host ("[OK] {0}: {1}" -f $check.Name, $version) -ForegroundColor Gray
    Write-Log -LogPath $log -Message ("OK tool {0} {1}" -f $check.Name, $version)
  }
}

try {
  Write-Host '== LingoCard Auto Environment Setup ==' -ForegroundColor Cyan
  Write-Host "Project: $root" -ForegroundColor DarkGray
  Write-Host "Log:     $log" -ForegroundColor DarkGray
  Write-Host ''

  if (-not $Elevated) { Ensure-AdminSession }

  Ensure-Chocolatey

  $requiredPackages = @('git', 'nodejs-lts', 'python')
  Install-ChocoPackages -Packages $requiredPackages

  Assert-InstalledTools

  Write-Host ''
  Write-Host '[SUCCESS] Environment setup complete.' -ForegroundColor Green
  Write-Log -LogPath $log -Message 'SUCCESS env_autosetup'
  exit 0
}
catch {
  Write-Host ''
  Write-Host '[ERROR] Environment setup failed.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Log -LogPath $log -Message ("ERROR env_autosetup {0}" -f $_.Exception.Message)
  exit 1
}
