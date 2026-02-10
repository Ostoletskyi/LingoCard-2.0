# Toolbox Utilities Audit

## Issues found
1. Two launcher names existed across history (`LC_TOOLBOX.bat` and `TOOLBOX.bat`) causing entry-point confusion.
2. Several scripts relied on mixed output language and encoding-sensitive text, increasing parser risk on PS 5.1.
3. Logging was fragmented under `_tools/logs`; requested standardized reports under `_reports/toolbox/...` were missing.
4. Node smoke utilities previously used shell-based execution patterns that may trigger future runtime warnings (DEP0190 style concerns).
5. Error recovery UX was inconsistent (no unified next-step guidance + log location in some branches).

## Future risks
- Any script committed without UTF-8 BOM can break PowerShell 5.1 parsing.
- Running long commands without clear progress messaging may look like hangs.
- Dependency drift (`git/node/npm`) can silently fail workflows if startup checks are skipped.

## Patch plan
- Keep exactly one root launcher (`TOOLBOX.bat`) and route every action through `_tools/ps`.
- Standardize logging and diagnostics via shared `common.ps1` helper.
- Enforce strict try/catch and exit code contract (`0/1/2`) for all toolbox scripts.
- Add self-check command to validate parser safety and dependencies.
- Keep smoke runner free from shell command injection patterns.

## Fixed in this PR
- Confirmed single launcher in root (`TOOLBOX.bat` only).
- Added startup environment checks and debug mode (`TOOLBOX_DEBUG=1`) handling.
- Standardized logs to `_reports/toolbox/YYYY-MM-DD/*.md` + `*.json`.
- Updated toolbox scripts to use common logging and hinting strategy.
- Added/retained self-check flow and parser/BOM checks.
