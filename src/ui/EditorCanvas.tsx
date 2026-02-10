import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../state/store";
import { getPxPerMm, mmToPx, pxToMm } from "../utils/mmPx";
import { selectCardById } from "../utils/selectCard";
import { getFieldEditValue, getFieldLabel, getFieldText } from "../utils/cardFields";
import type { Box } from "../model/layoutSchema";
import { emptyCard, type Card } from "../model/cardSchema";
import { buildSemanticLayoutBoxes } from "../editor/semanticLayout";

const GRID_STEP_MM = 1;
const MIN_BOX_SIZE_MM = 5;

type DragMode =
  | { type: "move" }
  | { type: "resize"; handle: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" };

type DragState = {
  boxId: string;
  startX: number;
  startY: number;
  startBox: Box;
  mode: DragMode;
  hasApplied: boolean;
};

const applySnap = (valueMm: number, enabled: boolean) =>
  enabled ? Math.round(valueMm / GRID_STEP_MM) * GRID_STEP_MM : valueMm;

const RULER_SIZE_MM = 7;
const RULER_GAP_MM = 1;

const buildRulerTicks = (maxMm: number) => {
  const full = Array.from({ length: Math.floor(maxMm) + 1 }, (_, i) => i);
  const last = full.at(-1) ?? 0;
  const hasEndpoint = Math.abs(last - maxMm) < 0.001;
  return hasEndpoint ? full : [...full, maxMm];
};


type RenderMode = "editor" | "print";


type EditorCanvasProps = {
  renderMode?: RenderMode;
};

export const EditorCanvas = ({ renderMode = "editor" }: EditorCanvasProps) => {
  const {
    layout,
    zoom,
    selectedId,
    selectedSide,
    cardsA,
    cardsB,
    selectedBoxId,
    gridEnabled,
    rulersEnabled,
    snapEnabled,
    gridIntensity,
    showOnlyCmLines,
    debugOverlays,
    rulersPlacement,
    selectBox,
    updateCardSilent,
    beginLayoutEdit,
    endLayoutEdit
  } = useAppStore((state) => ({
    layout: state.layout,
    zoom: state.zoom,
    selectedId: state.selectedId,
    selectedSide: state.selectedSide,
    cardsA: state.cardsA,
    cardsB: state.cardsB,
    selectedBoxId: state.selectedBoxId,
    gridEnabled: state.gridEnabled,
    rulersEnabled: state.rulersEnabled,
    snapEnabled: state.snapEnabled,
    gridIntensity: state.gridIntensity,
    showOnlyCmLines: state.showOnlyCmLines,
    debugOverlays: state.debugOverlays,
    rulersPlacement: state.rulersPlacement,
    selectBox: state.selectBox,
    updateCardSilent: state.updateCardSilent,
    beginLayoutEdit: state.beginLayoutEdit,
    endLayoutEdit: state.endLayoutEdit
  }));

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [cursorMm, setCursorMm] = useState<{ x: number; y: number } | null>(null);
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");
  const editRef = useRef<HTMLTextAreaElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isDarkTheme = document.documentElement.classList.contains("dark");

  const card = useMemo(() => {
    if (!selectedId) return null;
    return selectCardById(selectedId, selectedSide, cardsA, cardsB);
  }, [selectedId, selectedSide, cardsA, cardsB]);

  const pxPerMm = getPxPerMm(zoom);
  const rulerSizePx = mmToPx(RULER_SIZE_MM, pxPerMm);
  const widthPx = mmToPx(layout.widthMm, pxPerMm);
  const heightPx = mmToPx(layout.heightMm, pxPerMm);
  const rulerGapPx = mmToPx(RULER_GAP_MM, pxPerMm);
  const cardOffsetPx =
    rulersEnabled && rulersPlacement === "outside" ? rulerSizePx + rulerGapPx : 0;
  const stageWidthPx = widthPx + cardOffsetPx;
  const stageHeightPx = heightPx + cardOffsetPx;
  const hasCardBoxes = Boolean(card?.boxes?.length);
  const generatedFallbackBoxes = useMemo(() => {
    if (!card || hasCardBoxes) return [];
    return buildSemanticLayoutBoxes(card, layout.widthMm, layout.heightMm);
  }, [card, hasCardBoxes, layout.widthMm, layout.heightMm]);
  const activeBoxes = hasCardBoxes ? (card?.boxes ?? []) : generatedFallbackBoxes;
  const visibleBoxes = activeBoxes.filter((box) => box.style.visible !== false);
  const canEditLayoutGeometry = hasCardBoxes;

  const updateActiveBox = (boxId: string, update: Partial<Box>) => {
    if (!canEditLayoutGeometry || !card || !card.boxes || card.boxes.length === 0) {
      return;
    }
    const nextBoxes = card.boxes.map((box) =>
      box.id === boxId ? { ...box, ...update } : box
    );
    updateCardSilent({ ...card, boxes: nextBoxes }, selectedSide);
  };

  const handlePointerDown = (event: React.PointerEvent, box: Box, mode: DragMode) => {
    if (editingBoxId) return;
    if (!canEditLayoutGeometry) return;
    if (box.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.focus();
    }
    selectBox(box.id);
    setDragState({
      boxId: box.id,
      startX: event.clientX,
      startY: event.clientY,
      startBox: structuredClone(box),
      mode,
      hasApplied: false
    });
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / pxPerMm;
      const y = (event.clientY - rect.top) / pxPerMm;
      if (x >= 0 && y >= 0 && x <= layout.widthMm && y <= layout.heightMm) {
        setCursorMm({ x, y });
      } else {
        setCursorMm(null);
      }
    }
    if (!dragState) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const deltaXMm = pxToMm(deltaX, pxPerMm);
    const deltaYMm = pxToMm(deltaY, pxPerMm);

    if (!dragState.hasApplied) {
      beginLayoutEdit();
      setDragState((prev) => (prev ? { ...prev, hasApplied: true } : prev));
    }

    if (dragState.mode.type === "move") {
      const nextXRaw = applySnap(dragState.startBox.xMm + deltaXMm, snapEnabled);
      const nextYRaw = applySnap(dragState.startBox.yMm + deltaYMm, snapEnabled);
      const nextX = Math.min(Math.max(0, nextXRaw), Math.max(0, layout.widthMm - dragState.startBox.wMm));
      const nextY = Math.min(Math.max(0, nextYRaw), Math.max(0, layout.heightMm - dragState.startBox.hMm));
      updateActiveBox(dragState.boxId, { xMm: nextX, yMm: nextY });
      return;
    }

    const { handle } = dragState.mode;
    const start = dragState.startBox;
    let nextX = start.xMm;
    let nextY = start.yMm;
    let nextW = start.wMm;
    let nextH = start.hMm;

    if (handle.includes("e")) {
      nextW = Math.max(MIN_BOX_SIZE_MM, start.wMm + deltaXMm);
    }
    if (handle.includes("s")) {
      nextH = Math.max(MIN_BOX_SIZE_MM, start.hMm + deltaYMm);
    }
    if (handle.includes("w")) {
      const clampedDeltaX = Math.min(deltaXMm, start.wMm - MIN_BOX_SIZE_MM);
      nextW = Math.max(MIN_BOX_SIZE_MM, start.wMm - clampedDeltaX);
      nextX = start.xMm + clampedDeltaX;
    }
    if (handle.includes("n")) {
      const clampedDeltaY = Math.min(deltaYMm, start.hMm - MIN_BOX_SIZE_MM);
      nextH = Math.max(MIN_BOX_SIZE_MM, start.hMm - clampedDeltaY);
      nextY = start.yMm + clampedDeltaY;
    }

    nextX = applySnap(nextX, snapEnabled);
    nextY = applySnap(nextY, snapEnabled);
    nextW = applySnap(nextW, snapEnabled);
    nextH = applySnap(nextH, snapEnabled);

    nextX = Math.max(0, nextX);
    nextY = Math.max(0, nextY);
    nextW = Math.min(nextW, layout.widthMm - nextX);
    nextH = Math.min(nextH, layout.heightMm - nextY);
    nextW = Math.max(MIN_BOX_SIZE_MM, nextW);
    nextH = Math.max(MIN_BOX_SIZE_MM, nextH);

    updateActiveBox(dragState.boxId, { xMm: nextX, yMm: nextY, wMm: nextW, hMm: nextH });
  };

  const handlePointerUp = () => {
    if (dragState?.hasApplied) {
      endLayoutEdit();
    }
    setDragState(null);
  };

  const handleBeginEdit = (box: Box) => {
    if (!card) return;
    const fieldValue = getFieldEditValue(card, box.fieldId);
    setEditingBoxId(box.id);
    setOriginalValue(fieldValue);
    setEditValue(fieldValue);
  };

  type StringCardField = Exclude<keyof Card, "freq" | "tags" | "forms_aux" | "boxes">;
  const isStringCardField = (fieldId: string): fieldId is StringCardField =>
    fieldId !== "freq" && fieldId !== "tags" && fieldId !== "boxes" && fieldId in emptyCard;

  const updateCardField = (current: Card, fieldId: string, value: string): Card => {
    const next: Card = { ...current };
    if (fieldId === "tags") {
      next.tags = value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      return next;
    }
    if (fieldId === "freq") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        next.freq = Math.min(5, Math.max(1, parsed)) as Card["freq"];
      }
      return next;
    }
    if (fieldId === "forms_aux") {
      if (value === "haben" || value === "sein" || value === "") {
        next.forms_aux = value;
      }
      return next;
    }
    if (isStringCardField(fieldId)) {
      next[fieldId] = value;
    }
    return next;
  };

  const commitEdit = (shouldSave: boolean) => {
    if (!editingBoxId || !card) {
      setEditingBoxId(null);
      return;
    }
    if (shouldSave && editValue !== originalValue) {
      const box = activeBoxes.find((item) => item.id === editingBoxId);
      if (box) {
        const updated = updateCardField(card, box.fieldId, editValue);
        useAppStore.getState().updateCard(updated, selectedSide);
      }
    }
    setEditingBoxId(null);
  };

  useEffect(() => {
    if (!editingBoxId) return;
    const id = window.requestAnimationFrame(() => editRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [editingBoxId]);

  const handlePointerLeave = () => {
    setCursorMm(null);
    handlePointerUp();
  };

  const cursorX = cursorMm ? Math.round(cursorMm.x) : null;
  const cursorY = cursorMm ? Math.round(cursorMm.y) : null;
  const intensityMap = {
    low: 0.05,
    medium: 0.1,
    high: 0.16
  } as const;
  const intensityBase = intensityMap[gridIntensity];
  const intensityScale = isDarkTheme ? 0.6 : 1;
  const minorOpacity = intensityBase * 0.6 * intensityScale;
  const mediumOpacity = intensityBase * 0.9 * intensityScale;
  const majorOpacity = intensityBase * 1.2 * intensityScale;
  const gridBackground = showOnlyCmLines
    ? `linear-gradient(to right, rgba(148,163,184,${majorOpacity}) 1px, transparent 1px),
       linear-gradient(to bottom, rgba(148,163,184,${majorOpacity}) 1px, transparent 1px)`
    : `linear-gradient(to right, rgba(148,163,184,${minorOpacity}) 1px, transparent 1px),
       linear-gradient(to bottom, rgba(148,163,184,${minorOpacity}) 1px, transparent 1px),
       linear-gradient(to right, rgba(148,163,184,${mediumOpacity}) 1px, transparent 1px),
       linear-gradient(to bottom, rgba(148,163,184,${mediumOpacity}) 1px, transparent 1px),
       linear-gradient(to right, rgba(148,163,184,${majorOpacity}) 1px, transparent 1px),
       linear-gradient(to bottom, rgba(148,163,184,${majorOpacity}) 1px, transparent 1px)`;

  const renderHorizontalRuler = () => (
    <div
      className="absolute left-0"
      style={{
        height: rulerSizePx,
        width: widthPx,
        left: cardOffsetPx,
        top: 0
      }}
    >
      {buildRulerTicks(layout.widthMm).map((mm) => {
        const isCm = Math.round(mm) % 10 === 0;
        const isMid = Math.round(mm) % 5 === 0;
        const height = isCm ? 14 : isMid ? 10 : 6;
        return (
          <div
            key={`h-${mm}`}
            className="absolute bottom-0"
            style={{
              left: mmToPx(mm, pxPerMm),
              width: 1,
              height,
              backgroundColor: "rgba(100,116,139,0.7)"
            }}
          >
            {isCm && (
              <span
                className="absolute -top-4 text-[10px] text-slate-500 bg-slate-50 px-1 rounded dark:bg-slate-900 dark:text-slate-200"
                style={{ transform: "translateX(-4px)" }}
              >
                {Number((mm / 10).toFixed(1))}
              </span>
            )}
            {cursorX === mm && (
              <span className="absolute -top-1 h-1 w-1 rounded-full bg-sky-400" />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderVerticalRuler = () => (
    <div
      className="absolute left-0"
      style={{
        width: rulerSizePx,
        height: heightPx,
        left: 0,
        top: cardOffsetPx
      }}
    >
      {buildRulerTicks(layout.heightMm).map((mm) => {
        const isCm = Math.round(mm) % 10 === 0;
        const isMid = Math.round(mm) % 5 === 0;
        const width = isCm ? 14 : isMid ? 10 : 6;
        return (
          <div
            key={`v-${mm}`}
            className="absolute right-0"
            style={{
              top: mmToPx(mm, pxPerMm),
              height: 1,
              width,
              backgroundColor: "rgba(100,116,139,0.7)"
            }}
          >
            {isCm && (
              <span className="absolute left-0 -translate-x-full -translate-y-2 text-[10px] text-slate-500 bg-slate-50 px-1 rounded dark:bg-slate-900 dark:text-slate-200">
                {Number((mm / 10).toFixed(1))}
              </span>
            )}
            {cursorY === mm && (
              <span className="absolute -left-1 h-1 w-1 rounded-full bg-sky-400" />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderRulers = () => (
    <div
      className="absolute left-0 top-0 z-20 pointer-events-none"
      style={{ width: stageWidthPx, height: stageHeightPx }}
    >
      {rulersPlacement === "outside" && (
        <div
          className="absolute left-0 top-0 bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-700"
          style={{ width: rulerSizePx, height: rulerSizePx }}
        />
      )}
      {renderHorizontalRuler()}
      {renderVerticalRuler()}
    </div>
  );

  return (
    <div className="mt-3 relative flex justify-center">
      <div
        className={[
          "relative rounded-[22px] bg-slate-100/70 p-6 dark:bg-slate-900/70",
          snapEnabled ? "ring-2 ring-sky-100" : "ring-1 ring-slate-200"
        ].join(" ")}
      >
        <div
          className="absolute inset-0 rounded-[22px] bg-gradient-to-br from-white via-white to-slate-100/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/40"
          aria-hidden
        />
        {renderMode === "editor" && (
          <div className="mb-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Карточка {layout.widthMm}×{layout.heightMm} мм</span>
          <span>
            {gridEnabled ? "Сетка включена" : "Сетка выключена"} · Двойной клик = редактирование ·
            Блоки: {activeBoxes.length} / {visibleBoxes.length}
          </span>
          </div>
        )}
        <div className="relative" style={{ width: stageWidthPx, height: stageHeightPx }}>
          {renderMode === "editor" && rulersEnabled && renderRulers()}
          <div
            ref={cardRef}
            className="absolute z-10 bg-white border border-slate-200 rounded-2xl shadow-card dark:bg-slate-950 dark:border-slate-700"
            style={{
              width: widthPx,
              height: heightPx,
              left: cardOffsetPx,
              top: cardOffsetPx
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerDown={() => {
              if (editingBoxId) {
                commitEdit(true);
                return;
              }
              selectBox(null);
            }}
          >
            {renderMode === "editor" && gridEnabled && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: gridBackground,
                  backgroundSize: showOnlyCmLines
                    ? `${mmToPx(10, pxPerMm)}px ${mmToPx(10, pxPerMm)}px`
                    : `${mmToPx(1, pxPerMm)}px ${mmToPx(1, pxPerMm)}px, ${mmToPx(
                        1,
                        pxPerMm
                      )}px ${mmToPx(1, pxPerMm)}px, ${mmToPx(5, pxPerMm)}px ${mmToPx(
                        5,
                        pxPerMm
                      )}px, ${mmToPx(5, pxPerMm)}px ${mmToPx(5, pxPerMm)}px, ${mmToPx(
                        10,
                        pxPerMm
                      )}px ${mmToPx(10, pxPerMm)}px, ${mmToPx(10, pxPerMm)}px ${mmToPx(
                        10,
                        pxPerMm
                      )}px`
                }}
              />
            )}
            {activeBoxes.map((box) => {
              const fieldText = getFieldText(card, box.fieldId);
              const staticValue = box.staticText || box.text || "";
              const dynamicValue = box.text || fieldText.text;
              const resolvedText = box.textMode === "static" ? staticValue : dynamicValue;
              const isPlaceholder =
                box.textMode === "static"
                  ? staticValue.trim().length === 0
                  : fieldText.isPlaceholder && dynamicValue.trim().length === 0;
              const label = box.label || box.label_i18n || getFieldLabel(box.fieldId);
              const isSelected = selectedBoxId === box.id;
              const isEditing = editingBoxId === box.id;
              return (
                <div
                  key={box.id}
                  className={`absolute group ${canEditLayoutGeometry ? "cursor-move" : "cursor-text"}`}
                  tabIndex={renderMode === "editor" ? 0 : -1}
                  style={{
                    left: mmToPx(box.xMm, pxPerMm),
                    top: mmToPx(box.yMm, pxPerMm),
                    width: mmToPx(box.wMm, pxPerMm),
                    height: mmToPx(box.hMm, pxPerMm),
                    fontSize: box.style.fontSizePt * 1.333 * zoom,
                    fontWeight: box.style.fontWeight,
                    textAlign: box.style.align,
                    lineHeight: box.style.lineHeight,
                    padding: mmToPx(box.style.paddingMm, pxPerMm),
                    color: isPlaceholder ? "rgba(100,116,139,0.8)" : undefined,
                    border:
                      renderMode === "editor"
                        ? isEditing
                          ? "1px solid #22c55e"
                          : isSelected
                            ? "1px solid #38bdf8"
                            : "1px solid rgba(148,163,184,0.4)"
                        : "none",
                    outline: isEditing
                      ? "2px solid rgba(34,197,94,0.25)"
                      : isSelected
                        ? "2px solid rgba(14,165,233,0.25)"
                        : "none",
                    display: box.style.visible === false ? "none" : "block"
                  }}
                  onPointerDown={(event) => handlePointerDown(event, box, { type: "move" })}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    handleBeginEdit(box);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !editingBoxId) {
                      event.preventDefault();
                      handleBeginEdit(box);
                    }
                  }}
                >
                  {renderMode === "editor" && (
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                      {label}
                    </div>
                  )}
                  {isEditing ? (
                    <textarea
                      ref={editRef}
                      className="w-full h-full resize-none bg-white/80 text-sm text-slate-800 outline-none cursor-text dark:bg-slate-900/80 dark:text-slate-100"
                      style={{ padding: mmToPx(2, pxPerMm) }}
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      onBlur={() => commitEdit(true)}
                      onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                          event.preventDefault();
                          commitEdit(true);
                          return;
                        }
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          commitEdit(true);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setEditValue(originalValue);
                          commitEdit(false);
                        }
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    />
                  ) : (
                    <div className={isPlaceholder ? "text-sm text-slate-400" : "text-sm"}>
                      {resolvedText || fieldText.text}
                    </div>
                  )}
                  {renderMode === "editor" && debugOverlays && (
                    <span className="absolute right-1 top-1 rounded bg-white/80 px-1 text-[9px] text-slate-500 shadow-sm dark:bg-slate-900/80 dark:text-slate-300">
                      {box.fieldId}
                    </span>
                  )}
                  {renderMode === "editor" && dragState?.boxId === box.id && (
                    <span className="absolute right-1 bottom-1 rounded bg-white/80 px-1 text-[10px] text-slate-600 shadow-sm dark:bg-slate-900/80 dark:text-slate-200">
                      X:{box.xMm.toFixed(1)} Y:{box.yMm.toFixed(1)}
                    </span>
                  )}
                  {renderMode === "editor" && isSelected && (
                    <span className="absolute left-1 bottom-1 rounded bg-white/80 px-1 text-[10px] text-slate-600 shadow-sm dark:bg-slate-900/80 dark:text-slate-200">
                      {box.wMm.toFixed(1)}×{box.hMm.toFixed(1)} мм
                    </span>
                  )}
                  {renderMode === "editor" && canEditLayoutGeometry && isSelected && (
                    <>
                      {([
                        "nw",
                        "n",
                        "ne",
                        "e",
                        "se",
                        "s",
                        "sw",
                        "w"
                      ] as const).map((handle) => (
                        <div
                          key={handle}
                          className="absolute h-2 w-2 rounded-full bg-sky-500 shadow-sm"
                          style={{
                            ...(handle.includes("n") ? { top: -4 } : {}),
                            ...(handle.includes("s") ? { bottom: -4 } : {}),
                            ...(handle.includes("e") ? { right: -4 } : {}),
                            ...(handle.includes("w") ? { left: -4 } : {}),
                            ...(handle === "n" || handle === "s"
                              ? { left: "50%", marginLeft: -4 }
                              : {}),
                            ...(handle === "e" || handle === "w"
                              ? { top: "50%", marginTop: -4 }
                              : {})
                          }}
                          onPointerDown={(event) =>
                            handlePointerDown(event, box, { type: "resize", handle })
                          }
                        />
                      ))}
                    </>
                  )}
                </div>
              );
            })}
            {renderMode === "editor" && cursorMm && (
              <>
                <div
                  className="absolute top-0 bottom-0 w-px bg-sky-200/60 pointer-events-none"
                  style={{ left: mmToPx(cursorMm.x, pxPerMm) }}
                />
                <div
                  className="absolute left-0 right-0 h-px bg-sky-200/60 pointer-events-none"
                  style={{ top: mmToPx(cursorMm.y, pxPerMm) }}
                />
              </>
            )}
            {renderMode === "editor" && (
              <div className="absolute bottom-2 right-2 rounded-full bg-white/80 px-2 py-1 text-[11px] text-slate-500 shadow-sm dark:bg-slate-900/80 dark:text-slate-300">
              {cursorMm
                ? `X: ${cursorMm.x.toFixed(1)} мм · Y: ${cursorMm.y.toFixed(1)} мм`
                : "Наведите на холст"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
