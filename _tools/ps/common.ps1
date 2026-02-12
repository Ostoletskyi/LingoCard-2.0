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
    @('_tools\ps','_tools\backups','_tools\reports','_tools\tmp') | ForEach-Object {
        $dir = Join-Path $ProjectRoot $_
        if (-not (Test-Path $dir)) {
            New-Item -Path $dir -ItemType Directory -Force | Out-Null
        }
    }
}

function New-LogPath {
    param([string]$ProjectRoot,[string]$Prefix)
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    return (Join-Path $ProjectRoot ("_tools\reports\{0}_{1}.log" -f $Prefix, $stamp))
}

function Write-Log {
    param([string]$LogPath,[string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path $LogPath -Value $line
}

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is not installed or not available in PATH."
    }
}

function Copy-PathFiltered {
    param([string]$Source,[string]$Destination)
    if (-not (Test-Path $Source)) { return }
    if (Test-Path $Destination) { Remove-Item -Path $Destination -Recurse -Force }

    $exclude = @('node_modules','dist','.git','_tools\\backups','_tools\\reports')
    if ((Get-Item $Source).PSIsContainer) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
        Get-ChildItem -Path $Source -Recurse -Force | ForEach-Object {
            $full = $_.FullName
            foreach ($x in $exclude) {
                if ($full -match [regex]::Escape($x)) { return }
            }
            $relative = $full.Substring($Source.Length).TrimStart('\\')
            $target = Join-Path $Destination $relative
            if ($_.PSIsContainer) {
                if (-not (Test-Path $target)) { New-Item -ItemType Directory -Path $target -Force | Out-Null }
            } else {
                $targetDir = Split-Path -Parent $target
                if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
                Copy-Item -Path $full -Destination $target -Force
            }
        }
    } else {
        $targetDir = Split-Path -Parent $Destination
        if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
        Copy-Item -Path $Source -Destination $Destination -Force
    }
}
