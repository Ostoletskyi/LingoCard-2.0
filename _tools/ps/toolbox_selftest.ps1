param(
    [string]$ProjectRoot,
    [switch]$Quick
)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'selftest'

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Log-Info([string]$Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
    Write-Log -LogPath $log -Message "INFO $Message"
}

function Log-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
    Write-Log -LogPath $log -Message "OK $Message"
}

function Log-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
    Write-Log -LogPath $log -Message "WARN $Message"
}

function Log-Fail([string]$Message) {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    Write-Log -LogPath $log -Message "FAIL $Message"
}

function Test-Bom([string]$Path) {
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    return ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
}

$failed = 0

try {
    Push-Location $root
    try {
        Log-Info 'Starting toolbox self-test.'

        foreach ($cmd in @('git', 'node', 'npm')) {
            if (Get-Command $cmd -ErrorAction SilentlyContinue) {
                Log-Ok "Command available: $cmd"
            }
            else {
                Log-Fail "Command missing: $cmd"
                $failed += 1
            }
        }

        $psDir = Join-Path $root '_tools\ps'
        $required = @(
            'git_pull.ps1','git_push.ps1','backup_create.ps1','backup_restore.ps1',
            'smoke.ps1','dev_start.ps1','recover_and_verify.ps1','help_repair.ps1','auto_problem_solver.ps1','toolbox_selftest.ps1'
        )

        foreach ($name in $required) {
            $path = Join-Path $psDir $name
            if (Test-Path $path) {
                Log-Ok "Script found: $name"
            }
            else {
                Log-Fail "Script missing: $name"
                $failed += 1
            }
        }

        $psFiles = Get-ChildItem -Path $psDir -Filter '*.ps1' -File
        foreach ($file in $psFiles) {
            if (Test-Bom -Path $file.FullName) {
                Log-Ok "Encoding BOM: $($file.Name)"
            }
            else {
                Log-Warn "Encoding BOM missing: $($file.Name)"
            }

            try {
                [ScriptBlock]::Create((Get-Content -Path $file.FullName -Raw)) | Out-Null
                Log-Ok "Parse OK: $($file.Name)"
            }
            catch {
                Log-Fail "Parse error: $($file.Name) - $($_.Exception.Message)"
                $failed += 1
            }
        }

        foreach ($bin in @('node_modules/.bin/tsc','node_modules/.bin/vite','node_modules/.bin/eslint')) {
            if (Test-Path $bin) {
                Log-Ok ".bin exists: $bin"
            }
            else {
                Log-Warn ".bin missing: $bin"
            }
        }

        if (-not $Quick) {
            Log-Info 'Running npm run tools:preflight'
            & npm run tools:preflight | Out-Host
            if ($LASTEXITCODE -ne 0) {
                Log-Fail 'Preflight failed during self-test.'
                $failed += 1
            }

            Log-Info 'Running npm run tools:smoke'
            & npm run tools:smoke | Out-Host
            if ($LASTEXITCODE -ne 0) {
                Log-Fail 'Smoke failed during self-test.'
                $failed += 1
            }
        }

        if ($failed -eq 0) {
            Log-Ok 'TOOLBOX SELF-TEST RESULT: PASS'
            exit 0
        }

        Log-Fail "TOOLBOX SELF-TEST RESULT: FAIL ($failed issues)"
        exit 1
    }
    finally {
        Pop-Location
    }
}
catch {
    Log-Fail "Self-test crashed: $($_.Exception.Message)"
    exit 1
}
