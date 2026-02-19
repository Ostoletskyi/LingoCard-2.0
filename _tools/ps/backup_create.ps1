param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'backup_create'

$tempDir = $null
try {
    $name = "backup_{0}.zip" -f (Get-Date -Format 'yyyyMMdd_HHmmss')
    $backupPath = Join-Path $root ("_tools\backups\{0}" -f $name)
    $tempDir = Join-Path $env:TEMP ("lingocard_backup_" + [Guid]::NewGuid().ToString('N'))
    New-Item -Path $tempDir -ItemType Directory -Force | Out-Null

    $items = @('src','public','package.json','package-lock.json','tsconfig.json','index.html','README.md')
    foreach ($item in $items) {
        Copy-PathFiltered -Source (Join-Path $root $item) -Destination (Join-Path $tempDir $item)
    }

    Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $backupPath -CompressionLevel Optimal -Force
    $size = (Get-Item $backupPath).Length

    Write-Host "Backup created: $backupPath"
    Write-Host "Size: $size bytes"
    Write-Log -LogPath $log -Message "SUCCESS backup_create $backupPath size=$size"
    exit 0
}
catch {
    Write-Host 'Backup creation failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR backup_create $($_.Exception.Message)"
    exit 1
}
finally {
    if ($tempDir -and (Test-Path $tempDir)) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
