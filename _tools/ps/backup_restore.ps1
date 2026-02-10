param(
    [string]$ProjectRoot
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root

$action = 'backup_restore'
$commandText = 'Expand-Archive selected backup and copy to project'

try {
    $backupRoot = Join-Path $root '_tools\\backups'
    $backups = Get-ChildItem -Path $backupRoot -Filter '*.zip' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending

    if (-not $backups -or $backups.Count -eq 0) {
        Write-Host 'Бэкапы не найдены в _tools\backups.' -ForegroundColor Yellow
        Write-ToolLog -ProjectRoot $root -Action $action -Command $commandText -ExitCode 1 -Result 'error' -Details 'no backups'
        exit 1
    }

    Write-Host 'Доступные бэкапы:'
    for ($i = 0; $i -lt $backups.Count; $i++) {
        Write-Host ("{0}) {1}" -f ($i + 1), $backups[$i].Name)
    }

    $choice = Read-Host 'Введите номер бэкапа'
    if (-not ($choice -as [int]) -or [int]$choice -lt 1 -or [int]$choice -gt $backups.Count) {
        Write-Host 'Некорректный номер.' -ForegroundColor Yellow
        Write-ToolLog -ProjectRoot $root -Action $action -Command $commandText -ExitCode 1 -Result 'error' -Details 'invalid backup index'
        exit 1
    }

    $selected = $backups[[int]$choice - 1]

    Write-Host 'Создаём pre-restore backup...'
    & (Join-Path $PSScriptRoot 'backup_create.ps1') -ProjectRoot $root -Tag 'pre_restore' | Out-Host

    $tempDir = Join-Path $env:TEMP ("lingocard_restore_" + [Guid]::NewGuid().ToString('N'))
    New-Item -Path $tempDir -ItemType Directory -Force | Out-Null
    Expand-Archive -Path $selected.FullName -DestinationPath $tempDir -Force

    Get-ChildItem -Path $tempDir -Force | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $root $_.Name) -Recurse -Force
    }

    Write-Host "[Успех] Восстановление выполнено из: $($selected.Name)"

    $npmInstall = Read-Host 'Запустить npm install после восстановления? (Y/N)'
    if ($npmInstall -match '^(Y|y|Д|д)$') {
        Push-Location $root
        try { npm install } finally { Pop-Location }
    }

    Write-ToolLog -ProjectRoot $root -Action $action -Command "$commandText: $($selected.Name)" -ExitCode 0 -Result 'success' -Details $selected.FullName
    exit 0
} catch {
    Write-Host '[Ошибка] Не удалось восстановить проект из бэкапа.' -ForegroundColor Red
    Write-Host 'Что делать дальше: проверьте целостность архива и повторите попытку.'
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -ProjectRoot $root -Action $action -Command $commandText -ExitCode 1 -Result 'error' -Details $_.Exception.Message
    Show-LogHint -ProjectRoot $root
    exit 1
} finally {
    if ($tempDir -and (Test-Path $tempDir)) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
