param([string]$ProjectRoot)

# Legacy wrapper kept for compatibility.
& (Join-Path $PSScriptRoot 'git_pull.ps1') -ProjectRoot $ProjectRoot
exit $LASTEXITCODE
