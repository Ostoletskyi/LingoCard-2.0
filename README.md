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
_tools/              # Backup/restore/smoke/dev/preflight scripts
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
- `_tools/*`: CLI utilities for backup/restore/smoke/dev.

## Getting started
```bash
npm install
npm run dev
```

## Smoke/backup/restore
```bash
# Preflight (проверка окружения для тестирования)
npm run tools:preflight

# Smoke test
npm run tools:smoke

# Backup
npm run tools:backup -- my_tag

# Restore (list backups or restore by name)
npm run tools:restore
npm run tools:restore -- 2024-01-01T00-00-00-000Z_my_tag
```
