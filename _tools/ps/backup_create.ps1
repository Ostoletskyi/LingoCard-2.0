param(
    [string]$ProjectRoot,
    [string]$LogPath
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log = Resolve-LogPaths -ProjectRoot $root -LogPath $LogPath -Prefix 'backup_create'
$action = 'backup_create'

$tempDir = $null
try {
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupName = "backup_${stamp}.zip"
    $backupPath = Join-Path $root ("_tools\backups\{0}" -f $backupName)
    $manifestPath = Join-Path $root '_tools\tmp\manifest.json'

    $tempDir = Join-Path $env:TEMP ("lingocard_backup_" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    $targets = @('src','public','package.json','package-lock.json','tsconfig.json','index.html','README.md')
    foreach ($item in $targets) {
        $src = Join-Path $root $item
        if (-not (Test-Path $src)) { continue }
        Copy-Item -Path $src -Destination (Join-Path $tempDir $item) -Recurse -Force
    }

    foreach ($cfg in (Get-ConfigFiles $root)) {
        Copy-Item -Path $cfg.FullName -Destination (Join-Path $tempDir $cfg.Name) -Force
    }

    $gitHash = 'n/a'
    if (Test-Path (Join-Path $root '.git')) {
        Push-Location $root
        try { $gitHash = (git rev-parse --short HEAD 2>$null) } finally { Pop-Location }
    }

    $nodeVersion = if (Get-Command node -ErrorAction SilentlyContinue) { (node -v) } else { 'not found' }
    $npmVersion = if (Get-Command npm -ErrorAction SilentlyContinue) { (npm -v) } else { 'not found' }

    $manifest = [ordered]@{
        timestamp = (Get-Date).ToString('o')
        commit = $gitHash
        node = $nodeVersion
        npm = $npmVersion
        keyFiles = @(Get-ChildItem -Path $tempDir -Recurse -File | ForEach-Object { $_.FullName.Substring($tempDir.Length).TrimStart('\\') })
    }
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8
    Copy-Item -Path $manifestPath -Destination (Join-Path $tempDir 'manifest.json') -Force

    Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $backupPath -CompressionLevel Optimal -Force
    $size = (Get-Item $backupPath).Length

    Write-Host "Backup created: $backupPath"
    Write-Host "Size (bytes): $size"
    Write-ToolLog -LogPaths $log -Action $action -Command 'Compress-Archive' -Result 'success' -ExitCode 0 -Details $backupPath
    Show-LogHint -LogPaths $log
    exit 0
}
catch {
    Write-Host 'Backup creation failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -LogPaths $log -Action $action -Command 'Compress-Archive' -Result 'error' -ExitCode 1 -Details $_.Exception.Message
    Show-LogHint -LogPaths $log
    exit 1
}
finally {
    if ($tempDir -and (Test-Path $tempDir)) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
