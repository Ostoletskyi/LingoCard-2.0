import { jsPDF } from "jspdf";
import type { Card } from "../model/cardSchema";
import type { Layout } from "../model/layoutSchema";
import { getFieldText } from "../utils/cardFields";
import { logger } from "../utils/logger";
import { MM_PER_INCH, mmToPdf } from "../utils/mmPx";
import { buildSemanticLayoutBoxes } from "../editor/semanticLayout";
import { measureWrappedLines } from "../layout/textMeasure";
import { normalizeFieldId } from "../utils/fieldAlias";

export type PdfExportOptions = {
  cardsPerRow?: number;
  cardsPerColumn?: number;
  marginMm?: number;
};

const BASE_CANVAS_DPI = 220;
const BULK_CANVAS_DPI = 140;
const XL_BULK_CANVAS_DPI = 120;

const makeMmToCanvasPx = (dpi: number) => (mm: number) => Math.round((mm / MM_PER_INCH) * dpi);

const resolveReservedRightPx = (fieldId: string, box: { reservedRightPx?: number }) => {
  if (typeof box.reservedRightPx === "number" && Number.isFinite(box.reservedRightPx)) {
    return Math.max(0, box.reservedRightPx);
  }
  return normalizeFieldId(fieldId) === "freq" ? 48 : 0;
};

const FREQ_DOT_COLORS: Record<number, string> = {
  1: "rgb(59 130 246)",
  2: "rgb(239 68 68)",
  3: "rgb(249 115 22)",
  4: "rgb(234 179 8)",
  5: "rgb(34 197 94)"
};

const drawFrequencyDots = (
  ctx: CanvasRenderingContext2D,
  card: Card,
  box: { xMm: number; style: { paddingMm: number } },
  boxY: number,
  boxH: number,
  mmToCanvasPx: (mm: number) => number
) => {
  const dots = Math.max(0, Math.min(5, Math.round(card.freq || 0)));
  if (!dots) return;

  const color = FREQ_DOT_COLORS[dots] ?? "rgb(34 197 94)";
  const radius = Math.max(3, mmToCanvasPx(1.4));
  const gap = Math.max(3, mmToCanvasPx(1.4));
  const startX = mmToCanvasPx(box.xMm) + mmToCanvasPx(box.style.paddingMm) + radius;
  const centerY = boxY + Math.min(boxH / 2, mmToCanvasPx(box.style.paddingMm) + radius + 1);

  for (let index = 0; index < dots; index += 1) {
    const centerX = startX + index * (radius * 2 + gap);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
};

const resolveBoxText = (card: Card, fieldId: string, textMode?: string, text?: string, staticText?: string) => {
  if (textMode === "static") {
    return staticText || text || "";
  }
  if (text && text.trim().length > 0) {
    return text;
  }
  return getFieldText(card, fieldId).text;
};

export const exportCardsToPdf = async (
  cards: Card[],
  layout: Layout,
  options: PdfExportOptions,
  fileName: string = "cards.pdf"
) => {
  const { cardsPerRow = 1, cardsPerColumn = 1, marginMm = 0 } = options;
  const dpi = cards.length > 180 ? XL_BULK_CANVAS_DPI : cards.length > 20 ? BULK_CANVAS_DPI : BASE_CANVAS_DPI;
  const mmToCanvasPx = makeMmToCanvasPx(dpi);
  const useJpeg = cards.length > 40;
  const imageType = useJpeg ? "JPEG" : "PNG";
  logger.info("PDF export start", `cards=${cards.length}, size=${layout.widthMm}x${layout.heightMm}mm, mode=${cardsPerRow}x${cardsPerColumn}, margin=${marginMm}mm, dpi=${dpi}`);

  const pdfDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("pdfDebug") === "1";

  const doc = new jsPDF({
    orientation: layout.widthMm >= layout.heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [mmToPdf(layout.widthMm), mmToPdf(layout.heightMm)],
    compress: true
  });

  const cardWidth = layout.widthMm;
  const cardHeight = layout.heightMm;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, mmToCanvasPx(cardWidth));
  canvas.height = Math.max(1, mmToCanvasPx(cardHeight));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    logger.error("PDF export failed", "Canvas 2D context is unavailable");
    return;
  }

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index]!;
    const localIndex = index % (cardsPerRow * cardsPerColumn);
    if (index > 0 && localIndex === 0) {
      doc.addPage();
    }

    const row = Math.floor(localIndex / cardsPerRow);
    const col = localIndex % cardsPerRow;
    const x = marginMm + col * cardWidth;
    const y = marginMm + row * cardHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const activeBoxes = card.boxes?.length
      ? card.boxes
      : buildSemanticLayoutBoxes(card, layout.widthMm, layout.heightMm);

    activeBoxes.forEach((box) => {
      if (box.style.visible === false) return;
      const fontPx = (box.style.fontSizePt / 72) * dpi;
      const paddingPx = mmToCanvasPx(box.style.paddingMm);
      const boxX = mmToCanvasPx(box.xMm);
      const boxY = mmToCanvasPx(box.yMm);
      const boxW = Math.max(1, mmToCanvasPx(box.wMm));
      const boxH = Math.max(1, mmToCanvasPx(box.hMm));
      const isFrequencyBox = normalizeFieldId(box.fieldId) === "freq";
      const reservedRightPx = resolveReservedRightPx(box.fieldId, box as { reservedRightPx?: number });
      const maxWidth = Math.max(1, boxW - paddingPx * 2 - reservedRightPx);
      const text = resolveBoxText(card, box.fieldId, box.textMode, box.text, box.staticText);

      ctx.font = `${box.style.fontWeight === "bold" ? "700" : "400"} ${fontPx}px "DejaVu Sans", "Noto Sans", "Arial", sans-serif`;
      ctx.fillStyle = "#111827";
      ctx.textBaseline = "top";

      if (pdfDebug) {
        ctx.strokeStyle = "rgba(75,85,99,0.75)";
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
      }

      if (isFrequencyBox) {
        drawFrequencyDots(ctx, card, box, boxY, boxH, mmToCanvasPx);
        return;
      }

      const lines = measureWrappedLines(text, ctx.font, maxWidth, ctx);
      const lineHeightPx = fontPx * box.style.lineHeight;
      lines.forEach((line, lineIndex) => {
        const textY = boxY + paddingPx + lineIndex * lineHeightPx;
        if (textY > boxY + boxH - lineHeightPx) return;

        const measured = ctx.measureText(line).width;
        let textX = boxX + paddingPx;
        if (box.style.align === "center") textX = boxX + (boxW - measured) / 2;
        if (box.style.align === "right") textX = boxX + boxW - paddingPx - measured;
        ctx.fillText(line, textX, textY);
      });
    });

    if (pdfDebug) {
      ctx.strokeStyle = "rgba(30,64,175,0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }

    const image = useJpeg ? canvas.toDataURL("image/jpeg", 0.72) : canvas.toDataURL("image/png");
    doc.addImage(image, imageType, mmToPdf(x), mmToPdf(y), mmToPdf(cardWidth), mmToPdf(cardHeight), undefined, "FAST");

    if (index > 0 && index % 4 === 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }

  logger.info("PDF export done", `file=${fileName}, pages=${doc.getNumberOfPages()}`);
  doc.save(fileName);
};
