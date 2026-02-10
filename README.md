# LingoCard 2.0

Structured web-based German verb flashcard editor with AI panel, LM Studio integration, JSON-driven architecture, PDF export and modular state management.

## Project structure
```
src/
  ai/                # LM Studio client, prompt builder, validators
  editor/            # Box editing helpers
  io/                # Import/export utilities
  model/             # Card + Layout schemas and normalizers
  pdf/               # PDF export logic
  state/             # Zustand store + undo/redo
  ui/                # React components
  utils/             # Shared utilities
_tools/              # Toolbox scripts, backups and reports
_tests/              # (reserved)
tests/               # Smoke/preflight helpers
```

## Key modules
- `src/model/cardSchema.ts`: Card schema + runtime validation (Zod).
- `src/model/layoutSchema.ts`: Layout/Box schema + defaults.
- `src/state/store.ts`: Store with history and list management.
- `src/ui/EditorCanvas.tsx`: WYSIWYG preview with mm-based sizing.
- `src/io/importExport.ts`: Import/export helpers (JSON/TXT).
- `src/pdf/exportPdf.ts`: PDF export aligned with layout boxes.
- `src/ai/lmStudioClient.ts`: LM Studio HTTP client.
- `src/ai/promptBuilder.ts`: Prompt contract builder.
- `LC_TOOLBOX.bat`: единая точка входа для tools-меню (Windows).
- `_tools/ps/*`: PowerShell 5.1 утилиты меню (backup/git/smoke/dev).

## Getting started
```bash
npm install
npm run dev
```

## Smoke/backup/restore
```bash
# Smoke test
npm run tools:smoke
```

Для backup/restore и Git-операций используйте меню `LC_TOOLBOX.bat`.

## Windows toolbox menu
```bat
LC_TOOLBOX.bat
```

Документация по пунктам меню и логам: `_tools/README_TOOLS.md`.
