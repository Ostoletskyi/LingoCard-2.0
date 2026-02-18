param(
    [string]$ProjectRoot,
    [string]$LogPath,
    [switch]$VersionsOnly
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirectories $root
$log = Resolve-LogPaths -ProjectRoot $root -LogPath $LogPath -Prefix 'selftest'
$action = 'toolbox_selftest'

function Test-Bom {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    return ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
}

try {
    $errors = 0
    $psDir = Join-Path $root '_tools\ps'
    $requiredScripts = @(
        'backup_create.ps1','backup_restore.ps1','git_pull_rebase.ps1','git_push.ps1',
        'git_fix_remote_access.ps1','git_init_local.ps1','smoke_run.ps1','dev_start.ps1','toolbox_selftest.ps1'
    )

    Write-Host '--- Required files check ---'
    foreach ($script in $requiredScripts) {
        $full = Join-Path $psDir $script
        if (Test-Path $full) { Write-Host "OK: $script" }
        else { Write-Host "MISSING: $script" -ForegroundColor Red; $errors += 1 }
    }

    $psFiles = Get-ChildItem -Path $psDir -Filter '*.ps1' -File

    Write-Host '--- Encoding check (UTF-8 BOM) ---'
    foreach ($file in $psFiles) {
        if (Test-Bom -Path $file.FullName) { Write-Host "OK: $($file.Name)" }
        else { Write-Host "WARN: $($file.Name) has no BOM" -ForegroundColor Yellow; $errors += 1 }
    }

    Write-Host '--- PowerShell parser check ---'
    foreach ($file in $psFiles) {
        try {
            [ScriptBlock]::Create((Get-Content -Path $file.FullName -Raw)) | Out-Null
            Write-Host "OK: $($file.Name)"
        }
        catch {
            Write-Host "FAIL: $($file.Name)" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            $errors += 1
        }
    }

    Write-Host '--- Dependency check ---'
    foreach ($cmd in @('git','node','npm')) {
        if (Get-Command $cmd -ErrorAction SilentlyContinue) {
            Write-Host "OK: $cmd"
        } else {
            Write-Host "MISSING: $cmd" -ForegroundColor Yellow
            $errors += 1
        }
    }

    if ($VersionsOnly) {
        if (Get-Command git -ErrorAction SilentlyContinue) { git --version }
        if (Get-Command node -ErrorAction SilentlyContinue) { node -v }
        if (Get-Command npm -ErrorAction SilentlyContinue) { npm -v }
        Write-ToolLog -LogPaths $log -Action $action -Command 'versions only' -Result 'success' -ExitCode 0
        Show-LogHint -LogPaths $log
        exit 0
    }

    if (Get-Command npm -ErrorAction SilentlyContinue) {
        Write-Host '--- tools:smoke ---'
        Push-Location $root
        try {
            npm run tools:smoke 2>&1 | Tee-Object -FilePath $log.Md -Append
            if ($LASTEXITCODE -ne 0) { $errors += 1 }
        }
        finally { Pop-Location }
    }

    if ($errors -eq 0) {
        Write-Host 'SELF-TEST RESULT: PASS' -ForegroundColor Green
        Write-ToolLog -LogPaths $log -Action $action -Command 'full selftest' -Result 'PASS' -ExitCode 0
        Show-LogHint -LogPaths $log
        exit 0
    }

    Write-Host 'SELF-TEST RESULT: FAIL' -ForegroundColor Red
    Write-ToolLog -LogPaths $log -Action $action -Command 'full selftest' -Result 'FAIL' -ExitCode 1
    Show-LogHint -LogPaths $log
    exit 1
}
catch {
    Write-Host 'Self-test execution failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-ToolLog -LogPaths $log -Action $action -Command 'selftest' -Result 'error' -ExitCode 1 -Details $_.Exception.Message
    Show-LogHint -LogPaths $log
    exit 1
}
