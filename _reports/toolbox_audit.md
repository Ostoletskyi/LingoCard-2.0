# Toolbox Utilities Audit (Deep Dive)

## What was broken and why

1. **Core logging object mismatch broke multiple scripts**
   - `Resolve-LogPaths` returns a hashtable (`Md`, `Json`).
   - Several scripts piped command output with `Tee-Object -FilePath $log` instead of `$log.Md`.
   - Result: runtime errors when executing backup/restore/git/smoke flows.

2. **Restore flow reliability gaps**
   - Restore worked without pre-restore safety snapshot in all paths.
   - Replace operation did not explicitly avoid risky folders in every scenario.

3. **Git flows were not resilient enough**
   - Pull flow lacked robust handling for dirty worktree in current implementation.
   - Push flow did not always produce clear auth remediation path and stable logging in all modes.

4. **Self-check was incomplete as a production gate**
   - Did not reliably validate presence of all required toolbox scripts.
   - Version output path could fail when dependency command was missing.

## Root causes

- Refactor drift after changing log API from single path string to `{ Md, Json }` object.
- Partial updates across many scripts without end-to-end execution validation per action.
- Missing strict consistency checks for utility contract.

## Fixes applied in this PR

1. **Standardized log piping**
   - Replaced all `Tee-Object -FilePath $log` with `Tee-Object -FilePath $log.Md`.

2. **Hardened backup restore**
   - Added pre-restore backup trigger.
   - Kept restore-to-temp behavior.
   - Added safer replace copying with exclusions (`.git`, `node_modules`, `dist`).

3. **Hardened git pull/push**
   - Pull now handles dirty tree with explicit stash/abort choice and runs smoke after successful pull.
   - Push now supports clear mode selection and auth guidance.

4. **Upgraded self-check**
   - Validates required script set.
   - Keeps BOM + parser checks.
   - Validates dependencies and safely prints versions only when command exists.
   - Runs smoke when npm is available.

## Current role coverage

- **Backup:** create + restore + safety snapshot + temp extraction.
- **Git:** status, pull/rebase, push, remote access diagnostics, local init.
- **Smoke:** project smoke wrapper with logs.
- **Diagnostics:** parser/dependency/required-file checks.

## Remaining risk and mitigation

- **Windows-only runtime not fully reproducible in Linux CI shell.**
  - Mitigation: keep parser checks and command guards in `toolbox_selftest.ps1`.
- **External auth/network issues for git push/pull remain environment-dependent.**
  - Mitigation: explicit next-step guidance + logs in every failure path.
