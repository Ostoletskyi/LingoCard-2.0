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
        exit 1
    }

    Push-Location $root
    try {
        git init

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

        Write-Host '[Успех] Локальный git-репозиторий создан.' -ForegroundColor Green
        Write-ToolLog -ProjectRoot $root -Action $action -Command 'git init + initial commit' -ExitCode 0 -Result 'success'
        exit 0
    } finally { Pop-Location }
} catch {
    Write-Host '[Ошибка] Не удалось создать локальный git-репозиторий.' -ForegroundColor Red
    Write-Host 'Что делать дальше: проверьте git config user.name/user.email и повторите.'
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -ProjectRoot $root -Action $action -Command 'git init' -ExitCode 1 -Result 'error' -Details $_.Exception.Message
    exit 1
}
