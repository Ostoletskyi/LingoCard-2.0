param([string]$ProjectRoot)

. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-ProjectRoot $ProjectRoot
Ensure-ToolDirs $root

$processes = @('node','esbuild','vite','npm','git')
foreach ($name in $processes) {
    try {
        $items = Get-Process -Name $name -ErrorAction SilentlyContinue
        if ($items) {
            $items | Stop-Process -Force -ErrorAction SilentlyContinue
            Write-Host "[UNLOCK] Stopped process: $name"
        }
    }
    catch {
        Write-Host (("[UNLOCK] Skip process {0}: " -f $name) + $_.Exception.Message)
    }
}

Start-Sleep -Milliseconds 300
Write-Host '[UNLOCK] Process unlock pass finished.'
