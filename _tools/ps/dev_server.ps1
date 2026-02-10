param(
    [string]$ProjectRoot,
    [switch]$OpenBrowser
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$action='dev_server'

try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node не найден. Установите Node.js LTS.' }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm не найден. Переустановите Node.js.' }

    Push-Location $root
    try {
        if (-not (Test-Path (Join-Path $root 'node_modules'))) {
            $install = Read-Host 'Папка node_modules отсутствует. Запустить npm install? (Y/N)'
            if ($install -match '^(Y|y|Д|д)$') { npm install } else { throw 'Без node_modules запуск сервера невозможен.' }
        }

        if ($OpenBrowser) {
            Start-Process 'http://localhost:5173' | Out-Null
        }

        Write-Host 'Запуск dev-сервера. Для остановки нажмите Ctrl+C.'
        npm run dev
        $code = $LASTEXITCODE
        Write-ToolLog -ProjectRoot $root -Action $action -Command 'npm run dev' -ExitCode $code -Result 'finished'
        exit $code
    } finally { Pop-Location }
} catch {
    Write-Host '[Ошибка] Не удалось запустить dev-сервер.' -ForegroundColor Red
    Write-Host 'Что делать дальше: проверьте зависимости и скрипт npm run dev.'
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -ProjectRoot $root -Action $action -Command 'npm run dev' -ExitCode 1 -Result 'error' -Details $_.Exception.Message
    Show-LogHint -ProjectRoot $root
    exit 1
}
