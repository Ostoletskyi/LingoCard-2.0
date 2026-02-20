param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'git_init'

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Assert-Command git

    if (Test-Path (Join-Path $root '.git')) {
        Write-Host 'Repository is already initialized.' -ForegroundColor Yellow
        Write-Log -LogPath $log -Message 'INFO git repository already exists'
        exit 0
    }

    Push-Location $root
    try {
        git init | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'git init failed.' }

        git add -A | Out-Host
        git commit -m 'Initial commit' | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Initial commit skipped (possibly no files to commit).' -ForegroundColor Yellow
            Write-Log -LogPath $log -Message 'WARN initial commit skipped'
        }

        Write-Host 'Local git repository initialized.'
        Write-Log -LogPath $log -Message 'SUCCESS git_init_local'
        exit 0
    }
    finally { Pop-Location }
}
catch {
    Write-Host 'Local git initialization failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR git_init_local $($_.Exception.Message)"
    exit 1
}
