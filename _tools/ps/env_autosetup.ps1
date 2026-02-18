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
    if (Test-IsAdmin) { return }

    Write-Host 'Autoconfig requires Administrator privileges. Elevating...'
    Write-Log -LogPath $log -Message 'INFO elevation_requested'

    $args = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', "`"$PSCommandPath`"",
        '-ProjectRoot', "`"$root`"",
        '-Elevated'
    )

    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($args -join ' ') -Wait
    $code = $LASTEXITCODE
    if ($null -eq $code) { $code = 0 }
    exit $code
}

function Ensure-Chocolatey {
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Host 'Chocolatey found.'
        Write-Log -LogPath $log -Message 'INFO choco_exists'
        return
    }

    Write-Host 'Installing Chocolatey...'
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

    Write-Log -LogPath $log -Message 'INFO choco_install_done'
}

function Install-ChocoPackages {
    param([string[]]$Packages)

    foreach ($pkg in $Packages) {
        Write-Host "Installing/upgrading $pkg ..."
        Write-Log -LogPath $log -Message "INFO install_start $pkg"

        choco upgrade $pkg --yes --no-progress --limit-output --accept-license | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install package: $pkg"
        }

        Write-Log -LogPath $log -Message "INFO install_done $pkg"
    }
}

function Refresh-PathHint {
    $commonPaths = @(
        'C:\Program Files\Git\cmd',
        'C:\Program Files\nodejs',
        "$env:ProgramFiles\Python312",
        "$env:ProgramFiles\Python311",
        "$env:ProgramFiles\Python310",
        "$env:LOCALAPPDATA\Programs\Python\Python312",
        "$env:LOCALAPPDATA\Programs\Python\Python311",
        "$env:LOCALAPPDATA\Programs\Python\Python310",
        'C:\ProgramData\chocolatey\bin'
    )

    foreach ($pathEntry in $commonPaths) {
        if ((Test-Path $pathEntry) -and ($env:Path -notlike "*$pathEntry*")) {
            $env:Path = "$pathEntry;$env:Path"
        }
    }
}

function Assert-InstalledTools {
    Refresh-PathHint

    $checks = @(
        @{ Name = 'git'; Cmd = { git --version } },
        @{ Name = 'node'; Cmd = { node --version } },
        @{ Name = 'npm'; Cmd = { npm --version } },
        @{ Name = 'python'; Cmd = { python --version } }
    )

    foreach ($check in $checks) {
        Assert-Command $check.Name
        $version = & $check.Cmd
        Write-Host ("{0}: {1}" -f $check.Name, $version)
        Write-Log -LogPath $log -Message ("INFO verify {0} {1}" -f $check.Name, $version)
    }
}

try {
    if (-not $Elevated) {
        Ensure-AdminSession
    }

    Ensure-Chocolatey

    $requiredPackages = @(
        'git',
        'nodejs-lts',
        'python'
    )

    Install-ChocoPackages -Packages $requiredPackages
    Assert-InstalledTools

    Write-Host 'Автонастройка окружения завершена успешно.' -ForegroundColor Green
    Write-Log -LogPath $log -Message 'SUCCESS env_autosetup'
    exit 0
}
catch {
    Write-Host 'Автонастройка окружения завершилась с ошибкой.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR env_autosetup $($_.Exception.Message)"
    exit 1
}
