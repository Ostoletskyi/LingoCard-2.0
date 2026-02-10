param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$action='git_init_local'

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git не найден. Установите Git for Windows.' }

    if (Test-Path (Join-Path $root '.git')) {
        Write-Host '.git уже существует. Инициализация не требуется.' -ForegroundColor Yellow
        Write-ToolLog -ProjectRoot $root -Action $action -Command 'git init' -ExitCode 1 -Result 'warning' -Details '.git exists'
        Show-LogHint -ProjectRoot $root
        exit 1
    }

    Push-Location $root
    try {
        git init
        if ($LASTEXITCODE -ne 0) { throw 'git init завершился с ошибкой.' }

        $gitignorePath = Join-Path $root '.gitignore'
        if (-not (Test-Path $gitignorePath)) {
            @(
                'node_modules/'
                'dist/'
                '_tools/backups/'
                '_tools/reports/'
            ) | Set-Content -Path $gitignorePath -Encoding UTF8
        }

        git add -A
        git commit -m 'chore: initial local repository'

        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Commit не выполнен. Возможно, нет изменений или не настроены user.name/user.email.' -ForegroundColor Yellow
            Write-Host 'Проверьте: git config --global user.name "Your Name" и git config --global user.email "you@example.com"'
        }

        Write-Host '[Успех] Локальный git-репозиторий создан.' -ForegroundColor Green
        Write-ToolLog -ProjectRoot $root -Action $action -Command 'git init + initial commit' -ExitCode 0 -Result 'success'
        Show-LogHint -ProjectRoot $root
        exit 0
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host '[Ошибка] Не удалось создать локальный git-репозиторий.' -ForegroundColor Red
    Write-Host 'Что делать дальше: проверьте git config user.name/user.email и повторите.'
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -ProjectRoot $root -Action $action -Command 'git init' -ExitCode 1 -Result 'error' -Details $_.Exception.Message
    Show-LogHint -ProjectRoot $root
    exit 1
}
