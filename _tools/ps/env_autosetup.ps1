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

$script:ProgressValue = 0

function Show-CyberBanner {
    Clear-Host
    Write-Host '============================================================' -ForegroundColor DarkCyan
    Write-Host '        LingoCard :: AUTO ENV BOOTSTRAP :: CINE MODE       ' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor DarkCyan
    Write-Host "Project: $root" -ForegroundColor DarkGray
    Write-Host "Log:     $log" -ForegroundColor DarkGray
    Write-Host ''
}

function Write-HackerLine {
    param([string]$Tag)

    $alphabet = '01ABCDEFabcdef<>#@*[]{}'
    $chars = for ($i = 0; $i -lt 52; $i++) { $alphabet[(Get-Random -Minimum 0 -Maximum $alphabet.Length)] }
    $stream = -join $chars
    Write-Host ("[{0}] {1}" -f $Tag, $stream) -ForegroundColor DarkGray
}

function Show-HackerPulse {
    param(
        [string]$Label,
        [int]$StartPercent,
        [int]$EndPercent,
        [int]$Ticks = 10
    )

    if ($Ticks -lt 1) { $Ticks = 1 }
    $range = [Math]::Max(1, ($EndPercent - $StartPercent))

    for ($i = 0; $i -lt $Ticks; $i++) {
        $pct = [Math]::Min(100, $StartPercent + [Math]::Floor(($range * ($i + 1)) / $Ticks))
        Write-Progress -Activity 'Auto environment setup' -Status $Label -PercentComplete $pct

        if ($i % 3 -eq 0) {
            Write-HackerLine -Tag $Label
        }

        Start-Sleep -Milliseconds 80
    }

    $script:ProgressValue = [Math]::Max($script:ProgressValue, $EndPercent)
}

function Complete-Stage {
    param([string]$Label, [int]$Percent)

    $script:ProgressValue = [Math]::Max($script:ProgressValue, $Percent)
    Write-Progress -Activity 'Auto environment setup' -Status "$Label :: done" -PercentComplete $script:ProgressValue
    Write-Host ("[{0,3}%] {1}" -f $script:ProgressValue, $Label) -ForegroundColor Green
    Write-Log -LogPath $log -Message ("INFO stage_complete {0} {1}" -f $script:ProgressValue, $Label)
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-AdminSession {
    if (Test-IsAdmin) {
        Complete-Stage -Label 'Admin check' -Percent 5
        return
    }

    Write-Host 'Admin rights required. Elevating...' -ForegroundColor Yellow
    Write-Log -LogPath $log -Message 'INFO elevation_requested'

    $args = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', "`"$PSCommandPath`"",
        '-ProjectRoot', "`"$root`"",
        '-Elevated'
    )

    $proc = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($args -join ' ') -Wait -PassThru
    $code = if ($null -ne $proc) { $proc.ExitCode } else { 1 }
    exit $code
}

function Ensure-Chocolatey {
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Complete-Stage -Label 'Chocolatey detected' -Percent 20
        Write-Log -LogPath $log -Message 'INFO choco_exists'
        return
    }

    Show-HackerPulse -Label 'Installing Chocolatey' -StartPercent 8 -EndPercent 18 -Ticks 12
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

    Complete-Stage -Label 'Chocolatey installed' -Percent 24
    Write-Log -LogPath $log -Message 'INFO choco_install_done'
}

function Install-ChocoPackages {
    param([string[]]$Packages)

    $base = 28
    $top = 82
    $count = [Math]::Max(1, $Packages.Count)

    for ($i = 0; $i -lt $Packages.Count; $i++) {
        $pkg = $Packages[$i]
        $stageStart = $base + [Math]::Floor((($top - $base) * $i) / $count)
        $stageEnd = $base + [Math]::Floor((($top - $base) * ($i + 1)) / $count)

        Show-HackerPulse -Label ("Preparing package {0}" -f $pkg) -StartPercent $stageStart -EndPercent ([Math]::Min($stageEnd - 2, 95)) -Ticks 8
        Write-Host ("Installing/upgrading {0} ..." -f $pkg) -ForegroundColor Cyan
        Write-Log -LogPath $log -Message ("INFO install_start {0}" -f $pkg)

        choco upgrade $pkg --yes --no-progress --limit-output --accept-license | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install package: $pkg"
        }

        Complete-Stage -Label ("Package ready: {0}" -f $pkg) -Percent $stageEnd
        Write-Log -LogPath $log -Message ("INFO install_done {0}" -f $pkg)
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
    Show-HackerPulse -Label 'Verifying toolchain' -StartPercent 84 -EndPercent 92 -Ticks 10
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
        Write-Host ("{0}: {1}" -f $check.Name, $version) -ForegroundColor Gray
        Write-Log -LogPath $log -Message ("INFO verify {0} {1}" -f $check.Name, $version)
    }

    Complete-Stage -Label 'Verification complete' -Percent 96
}

try {
    Show-CyberBanner
    Show-HackerPulse -Label 'Boot sequence' -StartPercent 0 -EndPercent 4 -Ticks 7

    if (-not $Elevated) {
        Ensure-AdminSession
    }
    else {
        Complete-Stage -Label 'Elevated session active' -Percent 6
    }

    Ensure-Chocolatey

    $requiredPackages = @(
        'git',
        'nodejs-lts',
        'python'
    )

    Install-ChocoPackages -Packages $requiredPackages
    Assert-InstalledTools

    Show-HackerPulse -Label 'Finalizing' -StartPercent 96 -EndPercent 100 -Ticks 8
    Write-Progress -Activity 'Auto environment setup' -Completed

    Write-Host ''
    Write-Host '[OK] Auto environment setup completed successfully.' -ForegroundColor Green
    Write-Host 'System is ready for LingoCard.' -ForegroundColor Cyan

    Write-Log -LogPath $log -Message 'SUCCESS env_autosetup'
    exit 0
}
catch {
    Write-Progress -Activity 'Auto environment setup' -Completed
    Write-Host ''
    Write-Host '[ERROR] Auto environment setup failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR env_autosetup $($_.Exception.Message)"
    exit 1
}
