# LingoCard 2.0 — REVIEW / FIX REQUEST (DO NOT REGRESS)

## 0) Non-negotiable invariants (do not “improve” back)
We recently fixed a critical UX bug: mouse wheel font-size changes were saved but not visible in non-edit mode.
Root cause was CSS overriding inheritance (Tailwind `text-sm` on non-edit text node).
✅ Fix: non-edit text must inherit `fontSize` from its box/container (`fontSize: inherit`), and must NOT set a fixed Tailwind font size.

Also, we fixed a wheel event hijack issue:
- Toolbar was capturing `wheel` globally (`window.addEventListener("wheel", capture: true)`) and preventing default
- This blocked canvas/editor wheel logic
✅ Fix: Toolbar may handle wheel only when the wheel event happens inside the View panel element (ref.contains(event.target)); otherwise it must not preventDefault/stopPropagation.

Do not revert these two fixes. They are correct.

## 1) Current state (what works now)
- Wheel over selected block changes the stored font size and is now visible in both edit and non-edit mode.
- History changes are recorded (at least for font-size actions).
- Blocks can be selected (blue) and edited (green) via “enter edit mode”.

## 2) Known issue A: Text overflows outside blocks (frames look meaningless)
Problem:
- Card consists of positioned blocks (boxes). Text can overflow beyond block boundaries.
Goal:
- Block frames must visually and logically contain the text.

Requirements:
- In non-edit mode, text rendering must respect the box boundaries.
- Minimal required behavior: no overflow outside the box (clip/hidden) and proper word wrapping.
- Preferred behavior: optional auto-height so frame can “hug” content (controlled via a flag, see below).

Implementation guidance:
- Box container should apply:
  - `overflow: hidden`
  - `whiteSpace: pre-wrap`
  - `overflowWrap: anywhere` (or equivalent)
  - `wordBreak: break-word`
  - `lineHeight` consistent with editor
- Non-edit text node must inherit font settings from box container:
  - `fontSize: inherit`, `lineHeight: inherit`, `fontWeight: inherit`

Optional feature:
- Add `box.autoH` (boolean).
  - If true, compute `box.h` from text+font+wrap width and update store/layout.
  - Must be deterministic so PDF and UI match.

## 3) Known issue B: “Edit mode” currently does not persist most changes
Observed:
- Green edit mode shows correct content and size.
- After leaving edit mode, many changes (text edits, formatting, positioning) are lost.
- Only font-size seems to persist (because it is already wired to store/history).

Goal:
- All edits must persist to the canonical in-app state (store) and survive re-render and reload.

Requirements:
- Text editing must write to store onChange.
- Exiting edit mode (onBlur / confirm) should commit a history snapshot (pushHistory).
- Formatting changes (bold/italic/alignment/lineHeight/padding/etc.) must also update store.
- No “local-only” edits that disappear after re-render.

Implementation guidance:
- Provide store actions:
  - `setBoxText(boxId, text)`
  - `setBoxStyle(boxId, stylePatch)`
  - `setBoxRect(boxId, rectPatch)`
  - `pushHistory(label)` or equivalent commit
- UI wiring:
  - textarea onChange -> setBoxText
  - textarea onBlur/confirm -> pushHistory("Edit text")
  - formatting buttons/shortcuts -> setBoxStyle + pushHistory on commit

## 4) Import pipeline: Normalize external JSON into internal contract
Context:
- Users import JSON files with verbs/cards. External formats may vary.
- App must store an internal canonical representation and render via boxes.

Goal:
- When importing JSON, create an internal “normalized” dataset file/state.
- If external JSON does not match our internal contract, run normalization:
  - map known fields directly
  - if boxes missing, infer layout boxes deterministically
  - keep raw/original data for debugging

Important: do NOT use naive heuristics like only “string length” to decide fields. That fails on many verbs.
Prefer:
- direct mapping when keys exist (inf/forms/tr/examples)
- pattern heuristics when needed (aux=haben/sein, Partizip II patterns ge-...-t/en, sentence pronouns ich/du/er..., punctuation suggests examples)
- adapter-per-format if multiple input schemas exist

Desired pipeline:
1) `importRaw(json)` → store raw input (for debug)
2) `normalizeToInternal(raw)` → internal card object (fields arrays, etc.)
3) `ensureBoxes(internal)`:
   - if `boxes` present and valid → keep
   - else create from a template / inference rules
4) `validateInternal(internal)` → mark errors but keep best-effort import
5) write internal dataset to app storage (the “in-program file” you mentioned)

## 5) Deliverables requested from you (Codex)
- Re-scan the project codebase and identify where:
  - non-edit text rendering occurs (must inherit font size)
  - wheel events are captured (must not steal from canvas)
  - edit mode updates are not persisted to store
  - import & normalization logic exists and needs refactor to the above pipeline
- Provide a plan + patches (minimal diffs) that:
  - enforce no-overflow / wrap
  - implement persistent editing (text + style + position)
  - implement normalization pipeline with clear internal schema boundary

Keep changes minimal and avoid refactors that risk regressions.
