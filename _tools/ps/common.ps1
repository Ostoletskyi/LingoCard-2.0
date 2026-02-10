param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ProjectRoot {
    param([string]$ProvidedRoot)
    if ($ProvidedRoot -and (Test-Path $ProvidedRoot)) { return (Resolve-Path $ProvidedRoot).Path }
    return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Ensure-ToolDirectories {
    param([string]$ProjectRoot)
    @('_tools\ps', '_tools\backups', '_tools\tmp', '_tools\reports', '_reports', '_reports\toolbox') | ForEach-Object {
        $path = Join-Path $ProjectRoot $_
        if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
    }
    $dateDir = Join-Path $ProjectRoot ("_reports\toolbox\{0}" -f (Get-Date -Format 'yyyy-MM-dd'))
    if (-not (Test-Path $dateDir)) { New-Item -ItemType Directory -Path $dateDir -Force | Out-Null }
}

function Resolve-LogPaths {
    param([string]$ProjectRoot, [string]$Prefix, [string]$LogPath)
    $stamp = Get-Date -Format 'HHmmss'
    if ($LogPath) {
        $md = $LogPath
        $json = [System.IO.Path]::ChangeExtension($LogPath, '.json')
        return @{ Md = $md; Json = $json }
    }
    $base = Join-Path $ProjectRoot ("_reports\toolbox\{0}\{1}_{2}" -f (Get-Date -Format 'yyyy-MM-dd'), $Prefix, $stamp)
    return @{ Md = "$base.md"; Json = "$base.json" }
}

function Write-ToolLog {
    param(
        [hashtable]$LogPaths,
        [string]$Action,
        [string]$Command,
        [string]$Result,
        [int]$ExitCode,
        [string]$Details = ''
    )
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $LogPaths.Md -Value ("- [{0}] **{1}** `{2}` => {3} (exit {4}) {5}" -f $stamp, $Action, $Command, $Result, $ExitCode, $Details)

    $entry = [ordered]@{
        timestamp = $stamp
        action = $Action
        command = $Command
        result = $Result
        exitCode = $ExitCode
        details = $Details
    }
    $arr = @()
    if (Test-Path $LogPaths.Json) {
        try {
            $raw = Get-Content -Path $LogPaths.Json -Raw
            if ($raw) { $arr = @($raw | ConvertFrom-Json) }
        } catch { $arr = @() }
    }
    $arr += [pscustomobject]$entry
    ($arr | ConvertTo-Json -Depth 6) | Set-Content -Path $LogPaths.Json -Encoding UTF8
}

function Show-LogHint {
    param([hashtable]$LogPaths)
    Write-Host "Markdown log: $($LogPaths.Md)"
    Write-Host "JSON log: $($LogPaths.Json)"
    Write-Host 'Next step: open and share logs if issue persists.'
}

function Write-DebugInfo {
    param([string]$Message)
    if ($env:TOOLBOX_DEBUG -eq '1') { Write-Host "[DEBUG] $Message" -ForegroundColor DarkGray }
}

function Get-ConfigFiles {
    param([string]$ProjectRoot)
    @('vite.config.*', 'tailwind.config.*') | ForEach-Object {
        Get-ChildItem -Path $ProjectRoot -Filter $_ -File -ErrorAction SilentlyContinue
    }
}
