param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$action='git_pull_rebase'

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git не найден. Установите Git for Windows.' }
    if (-not (Test-Path (Join-Path $root '.git'))) { throw 'Текущая папка не является git-репозиторием (.git отсутствует).' }

    $logPath = Join-Path $root ("_tools\\reports\\git_pull_{0}.log" -f (Get-Date -Format 'yyyyMMdd_HHmm'))
    Push-Location $root
    try {
        "=== git status ===" | Tee-Object -FilePath $logPath
        git status 2>&1 | Tee-Object -FilePath $logPath -Append

        $dirty = git status --porcelain
        if ($dirty) {
            Write-Host 'Есть незакоммиченные изменения.' -ForegroundColor Yellow
            Write-Host '1) Сделать stash'
            Write-Host '2) Отменить операцию'
            $opt = Read-Host 'Выберите вариант (1/2)'
            if ($opt -eq '1') {
                git stash push -u -m ("toolbox-auto-stash-{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')) 2>&1 | Tee-Object -FilePath $logPath -Append
            } else {
                Write-Host 'Операция отменена пользователем.'
                Write-ToolLog -ProjectRoot $root -Action $action -Command 'git pull --rebase' -ExitCode 1 -Result 'cancelled' -Details 'dirty tree'
                exit 1
            }
        }

        "=== git pull --rebase ===" | Tee-Object -FilePath $logPath -Append
        git pull --rebase 2>&1 | Tee-Object -FilePath $logPath -Append
        if ($LASTEXITCODE -ne 0) { throw 'git pull --rebase завершился с ошибкой.' }

        "=== npm run tools:smoke ===" | Tee-Object -FilePath $logPath -Append
        npm run tools:smoke 2>&1 | Tee-Object -FilePath $logPath -Append
        $smokeExit = $LASTEXITCODE

        if ($smokeExit -eq 0) {
            Write-Host '[Успех] pull --rebase и smoke test выполнены.' -ForegroundColor Green
            Write-Host "Лог: $logPath"
            Write-Host "Smoke report: $(Join-Path $root '_tools\\reports\\smoke_report.md')"
            Write-ToolLog -ProjectRoot $root -Action $action -Command 'git pull --rebase + npm run tools:smoke' -ExitCode 0 -Result 'success' -Details $logPath
            exit 0
        }

        Write-Host '[Ошибка] Smoke test завершился неуспешно после pull.' -ForegroundColor Red
        Write-Host "Проверьте отчёт: $(Join-Path $root '_tools\\reports\\smoke_report.md')"
        Write-ToolLog -ProjectRoot $root -Action $action -Command 'npm run tools:smoke' -ExitCode $smokeExit -Result 'error' -Details $logPath
        exit $smokeExit
    } finally { Pop-Location }
} catch {
    Write-Host '[Ошибка] Не удалось обновить проект из GitHub.' -ForegroundColor Red
    Write-Host 'Что делать дальше: проверьте интернет/доступ к remote и повторите попытку.'
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -ProjectRoot $root -Action $action -Command 'git pull --rebase' -ExitCode 1 -Result 'error' -Details $_.Exception.Message
    Show-LogHint -ProjectRoot $root
    exit 1
}
