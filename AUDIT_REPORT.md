# AUDIT_REPORT

## Critical
- Lint configuration produced dozens of false positives (`no-undef`, TS type names) and masked real issues; fixed with TS-aware ESLint rules and globals.
- Import path had a legacy branch that dropped imported `boxes` and caused canvas to render only a subset of blocks.
- PDF text pipeline was unstable for Cyrillic in vector text mode; replaced with canvas text rasterization pipeline for reliable UTF-8 output.

## Major
- Store persistence and runtime concerns were partially mixed. Kept a single source of truth in Zustand state and explicit persisted subset in localStorage serializer.
- Wheel handling in "View" could leak scroll behavior to page containers. Added explicit capture lifecycle and non-passive wheel prevention when editing numeric fields.
- Box schema lacked explicit fields for static/dynamic text modes and labels used by imported samples.

## Minor
- Import diagnostics were missing; added import card/box counts logs for quick regression checks.
- Import format documentation did not describe unknown-box fallback rendering behavior.

## Dead code
- Removed legacy import branch that created minimal cards from `{id, boxes}` and silently discarded block geometry/content.
- Removed unused `isCardBoxSource` variable from `EditorCanvas`.

## Architecture smells
- Rendering logic depended on implicit assumptions about known `fieldId` values; added fallback text/label resolution (`staticText`, `text`, `label`, `label_i18n`).
- PDF and canvas rendering had diverging data sources (`layout.boxes` only). Now PDF prefers `card.boxes` when present to keep preview/export parity.

## Baseline status after stabilization
- `npm run tsc`: PASS
- `npm run tools:smoke`: PASS
- `npm run lint`: PASS

## Notes on mm -> px consistency
- Canvas/editor visual conversion remains based on `mmToPx(mm, pxPerMm)` where `pxPerMm = DEFAULT_PX_PER_MM * zoom`.
- PDF export now uses fixed print conversion for raster stage: `px = mm / 25.4 * 300` (300 DPI), then maps image back to exact mm page size in jsPDF.
