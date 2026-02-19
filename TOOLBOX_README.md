# LingoCard Toolbox (Windows)

This folder adds a small, **Windows-friendly** control panel for common dev tasks:

- Git sync (pull --rebase) / push
- Backup / restore
- Preflight / Smoke
- Dev server
- Troubleshooting / Auto-fix common issues (Git locks, broken node_modules, etc.)

## How to run

1. Put this folder into the **repo root** (same level as `package.json`).
2. Double-click: **TOOLBOX.bat**

## Troubleshooting menu (new)

**Auto-fix common issues** does this in a safe order:

1) stash local changes (if any)
2) `git fetch --all --prune` + `git pull --rebase`
3) stop common Node processes (best-effort)
4) remove `node_modules` and run `npm ci` with retry for Windows EPERM locks
5) run `npm run tsc`, `npm run tools:preflight`, `npm run tools:smoke`

## Notes

- If `npm ci` fails with `EPERM unlink ... esbuild.exe`, it's almost always:
  - Vite/dev server still running, or
  - Windows Defender / Antivirus locking the file.
  The toolbox stops common processes and retries, but you may still need an AV exclusion.

- Reports are written to `_reports/`.
