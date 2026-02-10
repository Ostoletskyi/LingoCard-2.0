param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$action='git_fix_remote_access'

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git не найден. Установите Git for Windows.' }
    if (-not (Test-Path (Join-Path $root '.git'))) { throw 'Текущая папка не является git-репозиторием.' }

    Push-Location $root
    try {
        $remote = git remote -v
        if (-not $remote) { throw 'Не найден git remote. Добавьте remote вручную: git remote add origin <url>' }

        Write-Host "Текущие remote:`n$remote"
        $firstUrl = (git remote get-url origin 2>$null)
        $instructions = @()

        if ($firstUrl -match '^https://') {
            Write-Host 'Обнаружен HTTPS remote.'
            $instructions += 'Используется HTTPS. Для GitHub нужен Personal Access Token (PAT), обычный пароль не работает.'
            $instructions += 'Шаги: GitHub -> Settings -> Developer settings -> Personal access tokens -> Generate token.'
            $instructions += 'При запросе пароля в git используйте PAT как пароль.'
        } elseif ($firstUrl -match 'git@github.com:') {
            Write-Host 'Обнаружен SSH remote.'
            $sshDir = Join-Path $env:USERPROFILE '.ssh'
            $keys = @()
            if (Test-Path $sshDir) {
                $keys = Get-ChildItem -Path $sshDir -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^id_(rsa|ed25519)$' }
            }
            if ($keys.Count -gt 0) {
                Write-Host ('SSH-ключи найдены: ' + (($keys | Select-Object -ExpandProperty Name) -join ', '))
            } else {
                Write-Host 'SSH-ключи не найдены.' -ForegroundColor Yellow
            }

            $instructions += 'Используется SSH remote.'
            $instructions += 'Проверьте ключи в ~/.ssh. Если ключей нет: ssh-keygen -t ed25519 -C "your_email@example.com"'
            $instructions += 'Добавьте публичный ключ в GitHub: Settings -> SSH and GPG keys.'
            $instructions += 'Проверьте соединение: ssh -T git@github.com'
        } else {
            Write-Host 'Тип remote не распознан автоматически.' -ForegroundColor Yellow
            $instructions += 'Проверьте URL remote и убедитесь, что он указывает на GitHub (HTTPS или SSH).'
        }

        $instructions += 'После исправления доступа повторите git push или git pull --rebase.'
        $text = ($instructions -join [Environment]::NewLine)
        Write-Host "`nРекомендуемые шаги:`n$text"

        $copy = Read-Host 'Скопировать инструкцию в буфер обмена? (Y/N)'
        if ($copy -match '^(Y|y|Д|д)$') {
            Set-Clipboard -Value $text
            Write-Host 'Инструкция скопирована в буфер.'
        }

        Write-ToolLog -ProjectRoot $root -Action $action -Command 'git remote -v analysis' -ExitCode 0 -Result 'success'
        exit 0
    } finally { Pop-Location }
} catch {
    Write-Host '[Ошибка] Не удалось собрать диагностику доступа к GitHub.' -ForegroundColor Red
    Write-Host 'Что делать дальше: проверьте git remote -v и сетевое подключение.'
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -ProjectRoot $root -Action $action -Command 'git remote -v' -ExitCode 1 -Result 'error' -Details $_.Exception.Message
    exit 1
}
