param(
    [string]$ProjectRoot,
    [string]$LogPath
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log = Resolve-LogPath -ProjectRoot $root -LogPath $LogPath -Prefix 'backup_restore'
$action = 'backup_restore'

try {
    $backupRoot = Join-Path $root '_tools\backups'
    $backups = Get-ChildItem -Path $backupRoot -Filter 'backup_*.zip' -File | Sort-Object LastWriteTime -Descending
    if (-not $backups) {
        Write-Host 'No backups found.' -ForegroundColor Yellow
        Write-ToolLog -LogPath $log -Action $action -Command 'list backups' -Result 'error' -ExitCode 1 -Details 'none found'
        Show-LogHint -LogPath $log
        exit 1
    }

    Write-Host 'Available backups:'
    for ($i = 0; $i -lt $backups.Count; $i++) {
        Write-Host (("[{0}] {1}" -f ($i + 1), $backups[$i].Name))
    }

    $selected = Read-Host 'Enter backup number'
    if (-not ($selected -as [int])) { Write-ToolLog -LogPath $log -Action $action -Command 'select backup' -Result 'invalid_input' -ExitCode 2; Show-LogHint -LogPath $log; exit 2 }
    $idx = [int]$selected - 1
    if ($idx -lt 0 -or $idx -ge $backups.Count) { Write-ToolLog -LogPath $log -Action $action -Command 'select backup' -Result 'invalid_input' -ExitCode 2; Show-LogHint -LogPath $log; exit 2 }

    $picked = $backups[$idx]
    $restoreDir = Join-Path $root ("_tools\tmp\restore_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
    New-Item -ItemType Directory -Path $restoreDir -Force | Out-Null
    Expand-Archive -Path $picked.FullName -DestinationPath $restoreDir -Force
    Write-Host "Backup extracted to: $restoreDir"

    $replace = Read-Host 'Replace current working tree now? Type YES to continue'
    if ($replace -eq 'YES') {
        Get-ChildItem -Path $restoreDir -Force | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination (Join-Path $root $_.Name) -Recurse -Force
        }
        Write-Host 'Working tree replaced from selected backup.'
    } else {
        Write-Host 'Replace skipped. Review restored folder manually.'
    }

    Write-ToolLog -LogPath $log -Action $action -Command 'Expand-Archive and optional replace' -Result 'success' -ExitCode 0 -Details $picked.Name
    Show-LogHint -LogPath $log
    exit 0
}
catch {
    Write-Host 'Backup restore failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -LogPath $log -Action $action -Command 'restore' -Result 'error' -ExitCode 1 -Details $_.Exception.Message
    Show-LogHint -LogPath $log
    exit 1
}
