param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'backup_create'

if (-not (Get-Command Copy-PathFiltered -ErrorAction SilentlyContinue)) {
    function Copy-PathFiltered {
        param([string]$Source,[string]$Destination)
        if (-not (Test-Path $Source)) { return }
        if (Test-Path $Destination) { Remove-Item -Path $Destination -Recurse -Force }

        $exclude = @('node_modules','dist','.git','_tools\backups','_tools\reports')
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
    Write-Host '[WARN] Copy-PathFiltered was missing from common scope. Fallback helper enabled.' -ForegroundColor Yellow
    Write-Log -LogPath $log -Message 'WARN backup_create fallback Copy-PathFiltered enabled'
}

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
