# LingoCard Toolbox

## Entry point
Run from project root:

```bat
TOOLBOX.bat
```

## Functional modules (PowerShell 5.1)
All scripts are in `_tools/ps/` and run through the BAT menu.

1. `git_pull.ps1` - update local project from git (`pull --rebase`)
2. `git_push.ps1` - commit/push local project state to git
3. `backup_create.ps1` - create project backup (`_tools/backups/backup_*.zip`)
4. `backup_restore.ps1` - restore project from selected backup
5. `smoke.ps1` - run project smoke checks
6. `dev_start.ps1` - start local dev server and open browser automatically
7. `common.ps1` - shared helper functions (paths, logs, checks)

## Reports and artifacts
- `_tools/backups/` - backups
- `_tools/reports/` - action logs
- `_tools/tmp/` - temporary restore folders

## Notes
- Menu and scripts are English-only.
- PowerShell launch format:
  `powershell -NoProfile -ExecutionPolicy Bypass -File "_tools\ps\<script>.ps1"`
