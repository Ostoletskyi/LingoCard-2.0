import { useMemo, useState } from "react";
import { useAppStore } from "../state/store";
import { DEFAULT_PX_PER_MM, mmToPx, pxToMm } from "../utils/mmPx";
import { selectCardById } from "../utils/selectCard";
import { getCardFieldValue } from "../utils/cardFields";
import type { Box } from "../model/layoutSchema";

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

export const EditorCanvas = () => {
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
    selectBox,
    updateBox,
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
    selectBox: state.selectBox,
    updateBox: state.updateBox,
    beginLayoutEdit: state.beginLayoutEdit,
    endLayoutEdit: state.endLayoutEdit
  }));

  const [dragState, setDragState] = useState<DragState | null>(null);

  const card = useMemo(() => {
    if (!selectedId) return null;
    return selectCardById(selectedId, selectedSide, cardsA, cardsB);
  }, [selectedId, selectedSide, cardsA, cardsB]);

  const pxPerMm = DEFAULT_PX_PER_MM * zoom;
  const widthPx = mmToPx(layout.widthMm, pxPerMm);
  const heightPx = mmToPx(layout.heightMm, pxPerMm);

  const handlePointerDown = (event: React.PointerEvent, box: Box, mode: DragMode) => {
    if (box.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
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
      const nextX = applySnap(dragState.startBox.xMm + deltaXMm, snapEnabled);
      const nextY = applySnap(dragState.startBox.yMm + deltaYMm, snapEnabled);
      updateBox(dragState.boxId, { xMm: nextX, yMm: nextY });
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

    updateBox(dragState.boxId, { xMm: nextX, yMm: nextY, wMm: nextW, hMm: nextH });
  };

  const handlePointerUp = () => {
    if (dragState?.hasApplied) {
      endLayoutEdit();
    }
    setDragState(null);
  };

  const renderRulers = () => (
    <>
      <div
        className="absolute -top-6 left-0 right-0 h-6 bg-slate-100 border-b border-slate-200"
        style={{ backgroundSize: `${mmToPx(10, pxPerMm)}px 100%` }}
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.4) 1px, transparent 1px)",
            backgroundSize: `${mmToPx(1, pxPerMm)}px 100%`
          }}
        />
      </div>
      <div
        className="absolute -left-6 top-0 bottom-0 w-6 bg-slate-100 border-r border-slate-200"
        style={{ backgroundSize: `100% ${mmToPx(10, pxPerMm)}px` }}
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(148,163,184,0.4) 1px, transparent 1px)",
            backgroundSize: `100% ${mmToPx(1, pxPerMm)}px`
          }}
        />
      </div>
    </>
  );

  return (
    <div className="mt-3 relative">
      <div
        className="relative bg-white border rounded shadow-inner"
        style={{ width: widthPx, height: heightPx }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerDown={() => selectBox(null)}
      >
        {rulersEnabled && renderRulers()}
        {gridEnabled && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(226,232,240,0.8) 1px, transparent 1px), linear-gradient(to bottom, rgba(226,232,240,0.8) 1px, transparent 1px)",
              backgroundSize: `${mmToPx(GRID_STEP_MM, pxPerMm)}px ${mmToPx(
                GRID_STEP_MM,
                pxPerMm
              )}px`
            }}
          />
        )}
        {layout.boxes.map((box) => {
          const value = getCardFieldValue(card, box.fieldId);
          const isSelected = selectedBoxId === box.id;
          return (
            <div
              key={box.id}
              className="absolute group"
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
                border: isSelected
                  ? "1px solid #38bdf8"
                  : box.style.border
                    ? "1px dashed #cbd5f5"
                    : "none",
                outline: isSelected ? "2px solid rgba(56,189,248,0.3)" : "none",
                display: box.style.visible === false ? "none" : "block"
              }}
              onPointerDown={(event) => handlePointerDown(event, box, { type: "move" })}
            >
              {value}
              {isSelected && (
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
                      className="absolute h-2 w-2 bg-sky-500"
                      style={{
                        ...(handle.includes("n") ? { top: -4 } : {}),
                        ...(handle.includes("s") ? { bottom: -4 } : {}),
                        ...(handle.includes("e") ? { right: -4 } : {}),
                        ...(handle.includes("w") ? { left: -4 } : {}),
                        ...(handle === "n" || handle === "s" ? { left: "50%", marginLeft: -4 } : {}),
                        ...(handle === "e" || handle === "w" ? { top: "50%", marginTop: -4 } : {})
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
      </div>
    </div>
  );
};
