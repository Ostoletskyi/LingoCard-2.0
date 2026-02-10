# LingoCard Toolbox

## Entry point
Run from project root:

```bat
TOOLBOX.bat
```

## Structure
- `_tools/ps/` PowerShell 5.1 scripts
- `_reports/toolbox/YYYY-MM-DD/` runtime logs (`.md` + `.json`)
- `_tools/backups/` backup archives
- `_tools/tmp/` temporary restore/output data

## Main menu
- Backup
- Git + Smoke
- Dev server
- Diagnostics / Self-test

## Notes
- All scripts use `Set-StrictMode -Version Latest` and `try/catch` with `exit 0/1/2`.
- Default launcher command format:
  `powershell -NoProfile -ExecutionPolicy Bypass -File "_tools\ps\<script>.ps1"`
