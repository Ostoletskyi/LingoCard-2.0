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
    @('_tools','_tools\ps','_tools\backups','_tools\reports') | ForEach-Object {
        $path = Join-Path $ProjectRoot $_
        if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
    }
}

function Get-ToolLogPath {
    param([string]$ProjectRoot)
    return (Join-Path $ProjectRoot '_tools\reports\toolbox.log')
}

function Write-ToolLog {
    param(
        [string]$ProjectRoot,
        [string]$Action,
        [string]$Command,
        [int]$ExitCode,
        [string]$Result,
        [string]$Details = ''
    )
    $logPath = Get-ToolLogPath -ProjectRoot $ProjectRoot
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[{0}] ACTION={1}; COMMAND={2}; RESULT={3}; EXIT={4}; DETAILS={5}" -f $stamp, $Action, $Command, $Result, $ExitCode, $Details
    Add-Content -Path $logPath -Value $line
}

function Show-LogHint {
    param([string]$ProjectRoot)
    $logPath = Get-ToolLogPath -ProjectRoot $ProjectRoot
    Write-Host "Лог: $logPath"
    Write-Host 'Если нужно, скачайте лог и отправьте его в поддержку.'
}

function Format-FileSize {
    param([long]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N2} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N2} KB' -f ($Bytes / 1KB)) }
    return "$Bytes B"
}

function Get-ConfigFiles {
    param([string]$ProjectRoot)
    $patterns = @('vite.config.*','tailwind.config.*')
    $files = @()
    foreach ($pattern in $patterns) {
        $files += Get-ChildItem -Path $ProjectRoot -Filter $pattern -File -ErrorAction SilentlyContinue
    }
    return $files
}
