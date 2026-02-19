param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'backup_restore'

$tempDir = $null
try {
    $backupRoot = Join-Path $root '_tools\backups'
    $backups = Get-ChildItem -Path $backupRoot -Filter 'backup_*.zip' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if (-not $backups -or $backups.Count -eq 0) { throw 'No backups found in _tools\backups.' }

    Write-Host 'Available backups:'
    for ($i = 0; $i -lt $backups.Count; $i++) {
        Write-Host ("[{0}] {1}" -f ($i + 1), $backups[$i].Name)
    }

    $choice = Read-Host 'Enter backup number'
    if (-not ($choice -as [int])) { throw 'Invalid backup selection.' }
    $index = [int]$choice - 1
    if ($index -lt 0 -or $index -ge $backups.Count) { throw 'Backup index is out of range.' }

    $selected = $backups[$index]

    Write-Host 'Creating safety backup before restore...'
    & (Join-Path $PSScriptRoot 'backup_create.ps1') -ProjectRoot $root | Out-Host

    $tempDir = Join-Path $root ("_tools\tmp\restore_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    Expand-Archive -Path $selected.FullName -DestinationPath $tempDir -Force

    $confirm = Read-Host 'Type YES to replace current working files from this backup'
    if ($confirm -ne 'YES') {
        Write-Host 'Restore cancelled by user.'
        Write-Log -LogPath $log -Message "CANCEL backup_restore selected=$($selected.Name)"
        exit 2
    }

    Get-ChildItem -Path $tempDir -Force | ForEach-Object {
        if ($_.Name -in @('.git','node_modules','dist')) { return }
        Copy-Item -Path $_.FullName -Destination (Join-Path $root $_.Name) -Recurse -Force
    }

    Write-Host "Restore completed from: $($selected.Name)"
    Write-Log -LogPath $log -Message "SUCCESS backup_restore selected=$($selected.Name)"
    exit 0
}
catch {
    Write-Host 'Backup restore failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR backup_restore $($_.Exception.Message)"
    exit 1
}
