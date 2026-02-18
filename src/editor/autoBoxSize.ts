import type { Card } from "../model/cardSchema";
import type { Box } from "../model/layoutSchema";
import { measureWrappedHeight } from "../layout/textMeasure";
import { mmToPx, pxToMm } from "../utils/mmPx";
import { getFieldText } from "../utils/cardFields";
import { normalizeFieldId } from "../utils/fieldAlias";

const DEFAULT_RESERVED_BY_FIELD: Record<string, number> = {
  freq: 24
};

const TEXT_AUTO_FIELDS = new Set([
  "tr_1_ru",
  "tr_2_ru",
  "tr_3_ru",
  "tr_4_ru",
  "forms_p3",
  "forms_prat",
  "forms_p2",
  "forms_aux",
  "forms_rek",
  "syn_1_de",
  "syn_2_de",
  "syn_3_de",
  "synonyms",
  "ex_1_de",
  "ex_2_de",
  "ex_3_de",
  "ex_4_de",
  "ex_5_de",
  "examples",
  "rek_1_de",
  "rek_2_de",
  "rek_3_de",
  "rek_4_de",
  "rek_5_de",
  "custom_text"
]);

const resolveReservedRightPx = (box: Box) => {
  const explicit = (box as Box & { reservedRightPx?: number }).reservedRightPx;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return Math.max(0, explicit);
  return DEFAULT_RESERVED_BY_FIELD[normalizeFieldId(box.fieldId)] ?? 0;
};

const shouldAutoHeight = (box: Box) => {
  const explicit = (box as Box & { autoH?: boolean }).autoH;
  if (typeof explicit === "boolean") return explicit;
  return TEXT_AUTO_FIELDS.has(normalizeFieldId(box.fieldId));
};

export const autoResizeCardBoxes = (card: Card, pxPerMm: number): Card => {
  if (!card.boxes?.length) return card;

  let changed = false;
  const nextBoxes = card.boxes.map((box) => {
    if (!shouldAutoHeight(box)) return box;
    const dynamic = getFieldText(card, box.fieldId).text;
    const staticValue = box.staticText || box.text || "";
    const text = box.textMode === "static" ? staticValue : (box.text || dynamic);
    const reservedRightPx = resolveReservedRightPx(box);
    const widthPx = Math.max(1, mmToPx(box.wMm, pxPerMm) - reservedRightPx);
    const fontPx = box.style.fontSizePt * 1.333;
    const fontCss = `${box.style.fontWeight === "bold" ? "700" : "400"} ${fontPx}px Inter, Arial, sans-serif`;
    const paddingPx = mmToPx(box.style.paddingMm, pxPerMm);
    const nextHeightPx = measureWrappedHeight(text, fontCss, widthPx, box.style.lineHeight, {
      xPx: paddingPx,
      yPx: paddingPx
    });
    const minH = typeof (box as Box & { minH?: number }).minH === "number" ? (box as Box & { minH?: number }).minH ?? 0 : 0;
    const maxH = typeof (box as Box & { maxH?: number }).maxH === "number" ? (box as Box & { maxH?: number }).maxH : undefined;
    const measuredMm = pxToMm(nextHeightPx, pxPerMm);
    const clampedMm = Math.max(minH || 0, maxH ? Math.min(maxH, measuredMm) : measuredMm);

    if (Math.abs(clampedMm - box.hMm) < 0.15) return box;
    changed = true;
    return { ...box, hMm: clampedMm };
  });

  return changed ? { ...card, boxes: nextBoxes } : card;
};
