param(
    [string]$ProjectRoot,
    [string]$Tag = 'manual'
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root

$action = 'backup_create'
$commandText = 'Compress-Archive selected project files'

try {
    $timestamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
    $safeTag = ($Tag -replace '[^a-zA-Z0-9_-]', '_')
    $backupName = if ($safeTag -and $safeTag -ne 'manual') { "backup_${timestamp}_${safeTag}.zip" } else { "backup_${timestamp}.zip" }
    $backupPath = Join-Path $root "_tools\\backups\\$backupName"

    $tempDir = Join-Path $env:TEMP ("lingocard_backup_" + [Guid]::NewGuid().ToString('N'))
    New-Item -Path $tempDir -ItemType Directory -Force | Out-Null

    $copyTargets = @('src','public','package.json','package-lock.json','tsconfig.json','index.html','_tools')
    foreach ($item in $copyTargets) {
        $source = Join-Path $root $item
        if (-not (Test-Path $source)) { continue }
        $destination = Join-Path $tempDir $item
        if ((Get-Item $source).PSIsContainer) {
            New-Item -ItemType Directory -Path $destination -Force | Out-Null
            Get-ChildItem -Path $source -Recurse -Force | ForEach-Object {
                $full = $_.FullName
                if ($full -match '\\node_modules(\\|$)' -or $full -match '\\dist(\\|$)' -or $full -match '\\.git(\\|$)' -or $full -match '\\_tools\\backups(\\|$)' -or $full -match '\\_tools\\reports(\\|$)') { return }
                $relative = $full.Substring($source.Length).TrimStart('\\')
                $targetPath = Join-Path $destination $relative
                if ($_.PSIsContainer) {
                    if (-not (Test-Path $targetPath)) { New-Item -ItemType Directory -Path $targetPath -Force | Out-Null }
                } else {
                    $targetDir = Split-Path -Parent $targetPath
                    if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
                    Copy-Item -Path $full -Destination $targetPath -Force
                }
            }
        } else {
            $destDir = Split-Path -Parent $destination
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item -Path $source -Destination $destination -Force
        }
    }

    foreach ($configFile in (Get-ConfigFiles $root)) {
        Copy-Item -Path $configFile.FullName -Destination (Join-Path $tempDir $configFile.Name) -Force
    }

    if (Test-Path $backupPath) { Remove-Item -Path $backupPath -Force }
    Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $backupPath -CompressionLevel Optimal

    $size = Format-FileSize ((Get-Item $backupPath).Length)
    Write-Host "[Успех] Бэкап создан: $backupPath"
    Write-Host "Размер: $size"
    Write-ToolLog -ProjectRoot $root -Action $action -Command $commandText -ExitCode 0 -Result 'success' -Details $backupPath
    exit 0
} catch {
    Write-Host "[Ошибка] Не удалось создать бэкап." -ForegroundColor Red
    Write-Host "Что делать дальше: проверьте права доступа и свободное место на диске."
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -ProjectRoot $root -Action $action -Command $commandText -ExitCode 1 -Result 'error' -Details $_.Exception.Message
    Show-LogHint -ProjectRoot $root
    exit 1
} finally {
    if ($tempDir -and (Test-Path $tempDir)) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
