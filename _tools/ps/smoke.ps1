param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$action='smoke_test'

try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node не найден. Установите Node.js LTS.' }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm не найден. Переустановите Node.js.' }

    $nodeModules = Join-Path $root 'node_modules'
    Push-Location $root
    try {
        if (-not (Test-Path $nodeModules)) {
            $install = Read-Host 'Папка node_modules отсутствует. Запустить npm install? (Y/N)'
            if ($install -match '^(Y|y|Д|д)$') { npm install } else { throw 'node_modules отсутствует, smoke test отменён.' }
        }

        npm run tools:smoke
        $code = $LASTEXITCODE

        $reportPath = Join-Path $root '_tools\reports\smoke_report.md'
        if ($code -eq 0) {
            Write-Host "PASS (exit code 0). Отчёт: $reportPath" -ForegroundColor Green
            Write-ToolLog -ProjectRoot $root -Action $action -Command 'npm run tools:smoke' -ExitCode 0 -Result 'PASS' -Details $reportPath
            exit 0
        }

        Write-Host "FAIL (exit code $code). Отчёт: $reportPath" -ForegroundColor Red
        Write-ToolLog -ProjectRoot $root -Action $action -Command 'npm run tools:smoke' -ExitCode $code -Result 'FAIL' -Details $reportPath
        exit $code
    } finally { Pop-Location }
} catch {
    Write-Host '[Ошибка] Не удалось запустить smoke test.' -ForegroundColor Red
    Write-Host 'Что делать дальше: проверьте Node.js/npm и зависимости проекта.'
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -ProjectRoot $root -Action $action -Command 'npm run tools:smoke' -ExitCode 1 -Result 'error' -Details $_.Exception.Message
    Show-LogHint -ProjectRoot $root
    exit 1
}
