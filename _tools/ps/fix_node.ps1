param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'fix_node'

function Stop-CommonNodeProcesses {
  # Best-effort. If nothing is running, ignore.
  @('node','vite') | ForEach-Object {
    Get-Process -Name $_ -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  }
}

function NpmCiWithRetry {
  param([int]$Retries = 2)

  for ($i=0; $i -le $Retries; $i++) {
    try {
      Invoke-Logged -LogPath $log -Label 'npm ci' -Command { npm ci }
      return
    } catch {
      $msg = $_.Exception.Message

      # Common Windows blocker: EPERM unlink esbuild.exe due to antivirus / running process.
      if ($msg -match 'EPERM' -or $msg -match 'operation not permitted') {
        Write-Host '[WARN] npm ci failed with EPERM. Stopping Node processes and retrying...' -ForegroundColor Yellow
        Write-Log -LogPath $log -Message 'WARN npm_eprem; stopping processes and retry'
        Stop-CommonNodeProcesses
        Start-Sleep -Seconds 2

        # One more cleanup attempt
        if (Test-Path (Join-Path $root 'node_modules')) {
          Remove-Item (Join-Path $root 'node_modules') -Recurse -Force -ErrorAction SilentlyContinue
        }

        continue
      }

      throw
    }
  }

  throw 'npm ci still fails after retries. Antivirus/Defender may be locking esbuild.exe.'
}

try {
  Assert-Command node
  Assert-Command npm

  Write-Host '== Fix Node Modules (clean install) ==' -ForegroundColor Cyan
  Write-Host "Project: $root" -ForegroundColor DarkGray
  Write-Host "Log:     $log" -ForegroundColor DarkGray
  Write-Host ''

  Push-Location $root
  try {
    Stop-CommonNodeProcesses

    if (Test-Path (Join-Path $root 'node_modules')) {
      Write-Host '[INFO] Removing node_modules...' -ForegroundColor Cyan
      Remove-Item (Join-Path $root 'node_modules') -Recurse -Force -ErrorAction SilentlyContinue
    }

    NpmCiWithRetry -Retries 2

    Write-Host '[OK] npm ci complete.' -ForegroundColor Green
    Write-Log -LogPath $log -Message 'SUCCESS fix_node'
    exit 0
  }
  finally { Pop-Location }
}
catch {
  Write-Host '[ERROR] Node fix failed.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Log -LogPath $log -Message ("ERROR fix_node {0}" -f $_.Exception.Message)

  Write-Host ''
  Write-Host 'Hints:' -ForegroundColor Yellow
  Write-Host '- Close Vite/dev server terminals before running npm ci.'
  Write-Host '- If Windows Defender/AV blocks esbuild.exe, add an exclusion for the repo folder.'
  Write-Host '- Run this script from an elevated PowerShell if your folder permissions are restricted.'

  exit 1
}
