import { useMemo } from "react";
import { useAppStore } from "../state/store";
import { DEFAULT_PX_PER_MM, mmToPx } from "../utils/mmPx";
import { selectCardById } from "../utils/selectCard";

export const EditorCanvas = () => {
  const { layout, zoom, selectedId, selectedSide, cardsA, cardsB } = useAppStore((state) => ({
    layout: state.layout,
    zoom: state.zoom,
    selectedId: state.selectedId,
    selectedSide: state.selectedSide,
    cardsA: state.cardsA,
    cardsB: state.cardsB
  }));

  const card = useMemo(() => {
    if (!selectedId) return null;
    return selectCardById(selectedId, selectedSide, cardsA, cardsB);
  }, [selectedId, selectedSide, cardsA, cardsB]);

  const pxPerMm = DEFAULT_PX_PER_MM * zoom;
  const widthPx = mmToPx(layout.widthMm, pxPerMm);
  const heightPx = mmToPx(layout.heightMm, pxPerMm);

  return (
    <div className="mt-3">
      <div
        className="relative bg-white border rounded shadow-inner"
        style={{ width: widthPx, height: heightPx }}
      >
        {layout.boxes.map((box) => {
          const value = card ? (card as Record<string, string>)[box.fieldId] ?? "" : "";
          return (
            <div
              key={box.id}
              className="absolute overflow-hidden"
              style={{
                left: mmToPx(box.xMm, pxPerMm),
                top: mmToPx(box.yMm, pxPerMm),
                width: mmToPx(box.wMm, pxPerMm),
                height: mmToPx(box.hMm, pxPerMm),
                fontSize: box.style.fontSizePt * 1.333 * zoom,
                fontWeight: box.style.fontWeight,
                textAlign: box.style.align as "left" | "center" | "right",
                lineHeight: box.style.lineHeight,
                padding: mmToPx(box.style.paddingMm, pxPerMm),
                border: box.style.border ? "1px dashed #cbd5f5" : "none",
                display: box.style.visible === false ? "none" : "block"
              }}
            >
              {value}
            </div>
          );
        })}
      </div>
    </div>
  );
};
