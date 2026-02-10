param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$action='git_push'

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git не найден. Установите Git for Windows.' }
    if (-not (Test-Path (Join-Path $root '.git'))) { throw 'Текущая папка не является git-репозиторием.' }

    Push-Location $root
    try {
        $dirty = git status --porcelain
        if ($dirty) {
            $add = Read-Host 'Есть изменения. Выполнить git add -A? (Y/N)'
            if ($add -match '^(Y|y|Д|д)$') { git add -A }

            $message = Read-Host 'Введите commit message (обязательно)'
            if ([string]::IsNullOrWhiteSpace($message)) {
                throw 'Commit message не может быть пустым.'
            }

            git commit -m $message
            if ($LASTEXITCODE -ne 0) {
                Write-Host 'Нечего коммитить или commit завершился ошибкой.' -ForegroundColor Yellow
            }
        }

        $pushOutput = git push 2>&1
        $pushOutput | Out-Host
        if ($LASTEXITCODE -ne 0) {
            if ($pushOutput -match 'Authentication failed|Permission denied|could not read Username') {
                Write-Host 'Похоже, проблема с авторизацией GitHub.' -ForegroundColor Yellow
                Write-Host 'Перейдите в пункт меню: "Нет доступа к GitHub — создать связь".'
            }
            throw 'git push завершился с ошибкой.'
        }

        Write-Host '[Успех] Изменения отправлены в GitHub.' -ForegroundColor Green
        Write-ToolLog -ProjectRoot $root -Action $action -Command 'git add/commit/push' -ExitCode 0 -Result 'success'
        exit 0
    } finally { Pop-Location }
} catch {
    Write-Host '[Ошибка] Не удалось выполнить push.' -ForegroundColor Red
    Write-Host 'Что делать дальше: проверьте remote, доступ и корректность commit message.'
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -ProjectRoot $root -Action $action -Command 'git push' -ExitCode 1 -Result 'error' -Details $_.Exception.Message
    exit 1
}
