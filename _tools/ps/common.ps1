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
    @('_tools', '_tools\ps', '_tools\logs', '_tools\backups', '_tools\tmp') | ForEach-Object {
        $path = Join-Path $ProjectRoot $_
        if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
    }
}

function New-DefaultLogPath {
    param([string]$ProjectRoot, [string]$Prefix = 'toolbox')
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    return (Join-Path $ProjectRoot ("_tools\logs\{0}_{1}.log" -f $Prefix, $stamp))
}

function Resolve-LogPath {
    param([string]$ProjectRoot, [string]$LogPath, [string]$Prefix)
    if ($LogPath) { return $LogPath }
    return (New-DefaultLogPath -ProjectRoot $ProjectRoot -Prefix $Prefix)
}

function Write-ToolLog {
    param(
        [string]$LogPath,
        [string]$Action,
        [string]$Command,
        [string]$Result,
        [int]$ExitCode,
        [string]$Details = ''
    )
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $LogPath -Value ("[{0}] ACTION={1}; COMMAND={2}; RESULT={3}; EXIT={4}; DETAILS={5}" -f $stamp, $Action, $Command, $Result, $ExitCode, $Details)
}

function Show-LogHint {
    param([string]$LogPath)
    Write-Host "Log file: $LogPath"
    Write-Host 'If needed, download and share this log file for support.'
}

function Get-ConfigFiles {
    param([string]$ProjectRoot)
    @('vite.config.*', 'tailwind.config.*') | ForEach-Object {
        Get-ChildItem -Path $ProjectRoot -Filter $_ -File -ErrorAction SilentlyContinue
    }
}
