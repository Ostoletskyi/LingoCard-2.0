param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root
$log = New-LogPath -ProjectRoot $root -Prefix 'troubleshoot'

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Show-Menu {
    Clear-Host
    Write-Host '================================================' -ForegroundColor DarkCyan
    Write-Host '          LingoCard Troubleshooting / Auto-fix   ' -ForegroundColor Cyan
    Write-Host '================================================' -ForegroundColor DarkCyan
    Write-Host ("Project: {0}" -f $root) -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '[1] Quick diagnostics (versions, git status, reports)' -ForegroundColor Gray
    Write-Host '[2] Repair node_modules (best-effort clean reinstall)' -ForegroundColor Gray
    Write-Host '[3] Run Preflight (verbose)' -ForegroundColor Gray
    Write-Host '[4] Run Smoke test (verbose + show failing steps)' -ForegroundColor Gray
    Write-Host '[5] Git rebase rescue (detect + suggest actions)' -ForegroundColor Gray
    Write-Host '[0] Back' -ForegroundColor Gray
    Write-Host '------------------------------------------------'
}

function Get-ReportPath {
    param([string]$Name)
    return (Join-Path $root (Join-Path '_reports' $Name))
}

function Show-FailingStepsFromSmoke {
    $json = Get-ReportPath 'smoke_report.json'
    if (-not (Test-Path $json)) {
        Write-Host "No smoke_report.json found at: $json" -ForegroundColor Yellow
        return
    }

    try {
        $report = Get-Content $json -Raw | ConvertFrom-Json
        $fails = @($report.steps | Where-Object { $_.status -eq 'FAIL' })
        if ($fails.Count -eq 0) {
            Write-Host 'Smoke report has no FAIL steps.' -ForegroundColor Green
            return
        }

        Write-Host 'Failing steps:' -ForegroundColor Red
        foreach ($s in $fails) {
            $details = ($s.details | Out-String).Trim()
            if ($details.Length -gt 500) { $details = $details.Substring(0, 500) + ' …' }
            Write-Host (" - {0}: {1}" -f $s.label, $details) -ForegroundColor Red
        }
    } catch {
        Write-Host 'Failed to parse smoke_report.json' -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

function Quick-Diagnostics {
    Write-Host ''
    Write-Host '== Versions ==' -ForegroundColor Cyan
    try { git --version | Out-Host } catch { Write-Host 'git not found' -ForegroundColor Yellow }
    try { node --version | Out-Host } catch { Write-Host 'node not found' -ForegroundColor Yellow }
    try { npm --version | Out-Host } catch { Write-Host 'npm not found' -ForegroundColor Yellow }

    Write-Host ''
    Write-Host '== Git status ==' -ForegroundColor Cyan
    try { git -C $root status --short | Out-Host } catch { Write-Host 'Unable to read git status' -ForegroundColor Yellow }

    Write-Host ''
    Write-Host '== Reports ==' -ForegroundColor Cyan
    $preMd = Get-ReportPath 'preflight_report.md'
    $smkMd = Get-ReportPath 'smoke_report.md'
    if (Test-Path $preMd) { Write-Host "- $preMd" -ForegroundColor Gray } else { Write-Host "- (missing) $preMd" -ForegroundColor Yellow }
    if (Test-Path $smkMd) { Write-Host "- $smkMd" -ForegroundColor Gray } else { Write-Host "- (missing) $smkMd" -ForegroundColor Yellow }
    Show-FailingStepsFromSmoke

    Write-Log -LogPath $log -Message 'INFO diagnostics'
}

function Repair-NodeModules {
    Write-Host ''
    Write-Host '== Repair node_modules ==' -ForegroundColor Cyan
    Write-Host 'This is best-effort. If Windows says EPERM/unlink (esbuild.exe), close editors/terminal tabs and temporarily pause antivirus.' -ForegroundColor Yellow

    Push-Location $root
    try {
        if (Test-Path 'node_modules') {
            Write-Host 'Removing node_modules...' -ForegroundColor Gray
            try {
                Remove-Item 'node_modules' -Recurse -Force -ErrorAction Stop
            } catch {
                Write-Host 'Failed to remove node_modules (likely locked file).' -ForegroundColor Red
                Write-Host $_.Exception.Message -ForegroundColor Red
                Write-Host 'Tip: close VS Code, stop dev server, retry. You can also reboot to release locks.' -ForegroundColor Yellow
                throw
            }
        }

        if (Test-Path 'package-lock.json') {
            Write-Host 'Restoring package-lock.json from git (if available)...' -ForegroundColor Gray
            try { git checkout -- package-lock.json | Out-Null } catch { }
        }

        Write-Host 'Running npm ci...' -ForegroundColor Gray
        npm ci | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }

        Write-Host 'node_modules repaired.' -ForegroundColor Green
        Write-Log -LogPath $log -Message 'SUCCESS repair_node_modules'
    } finally {
        Pop-Location
    }
}

function Run-Preflight {
    Write-Host ''
    Write-Host '== Preflight ==' -ForegroundColor Cyan
    Push-Location $root
    try {
        npm run tools:preflight | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "Preflight failed (exit $LASTEXITCODE)" }
        Write-Host 'Preflight passed.' -ForegroundColor Green
        Write-Log -LogPath $log -Message 'SUCCESS preflight'
    } finally { Pop-Location }
}

function Run-Smoke {
    Write-Host ''
    Write-Host '== Smoke ==' -ForegroundColor Cyan
    Push-Location $root
    try {
        npm run tools:smoke | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Show-FailingStepsFromSmoke
            throw "Smoke failed (exit $LASTEXITCODE)"
        }
        Write-Host 'Smoke passed.' -ForegroundColor Green
        Write-Log -LogPath $log -Message 'SUCCESS smoke'
    } finally { Pop-Location }
}

function Git-Rebase-Rescue {
    Write-Host ''
    Write-Host '== Git rebase rescue ==' -ForegroundColor Cyan
    Push-Location $root
    try {
        $status = git status | Out-String
        if ($status -match 'rebase in progress' -or $status -match 'interactive rebase in progress') {
            Write-Host 'Detected an ongoing rebase.' -ForegroundColor Yellow
            Write-Host 'Common actions:' -ForegroundColor Gray
            Write-Host '  - Resolve conflicts -> git add <files> -> git rebase --continue' -ForegroundColor Gray
            Write-Host '  - Skip patch -> git rebase --skip' -ForegroundColor Gray
            Write-Host '  - Abort -> git rebase --abort' -ForegroundColor Gray
        } else {
            Write-Host 'No rebase in progress.' -ForegroundColor Green
        }

        $short = git status --short | Out-String
        if ($short.Trim().Length -gt 0) {
            Write-Host ''
            Write-Host 'Working tree has local changes:' -ForegroundColor Yellow
            $short | Out-Host
            Write-Host 'Tip: use `git stash push -u -m "wip"` before pull --rebase.' -ForegroundColor Gray
        }

        Write-Log -LogPath $log -Message 'INFO git_rebase_rescue'
    } finally { Pop-Location }
}

try {
    while ($true) {
        Show-Menu
        $choice = Read-Host 'Select option'
        switch ($choice) {
            '1' { Quick-Diagnostics; Pause }
            '2' { Repair-NodeModules; Pause }
            '3' { Run-Preflight; Pause }
            '4' { Run-Smoke; Pause }
            '5' { Git-Rebase-Rescue; Pause }
            '0' { break }
            default { Write-Host 'Invalid option.' -ForegroundColor Yellow; Start-Sleep -Milliseconds 600 }
        }
    }
    exit 0
}
catch {
    Write-Host ''
    Write-Host 'Troubleshooting failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Log -LogPath $log -Message "ERROR troubleshoot $($_.Exception.Message)"
    exit 1
}
