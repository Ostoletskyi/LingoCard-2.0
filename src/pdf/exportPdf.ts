import { jsPDF } from "jspdf";
import type { Card } from "../model/cardSchema";
import type { Layout } from "../model/layoutSchema";
import { getFieldText } from "../utils/cardFields";
import { logger } from "../utils/logger";

export type PdfExportOptions = {
  cardsPerRow?: number;
  cardsPerColumn?: number;
  marginMm?: number;
};

const MM_PER_INCH = 25.4;
const CANVAS_DPI = 300;

const mmToCanvasPx = (mm: number) => Math.round((mm / MM_PER_INCH) * CANVAS_DPI);

const wrapText = (
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidthPx: number
): string[] => {
  const source = value.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  source.forEach((row) => {
    if (!row) {
      lines.push("");
      return;
    }
    const words = row.split(/\s+/);
    let current = "";
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidthPx) {
        current = candidate;
        return;
      }
      if (current) {
        lines.push(current);
      }
      current = word;
    });
    if (current) lines.push(current);
  });
  return lines;
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

export const exportCardsToPdf = (
  cards: Card[],
  layout: Layout,
  options: PdfExportOptions,
  fileName: string = "cards.pdf"
) => {
  const { cardsPerRow = 1, cardsPerColumn = 1, marginMm = 0 } = options;
  const pdfDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("pdfDebug") === "1";

  const doc = new jsPDF({
    orientation: layout.widthMm >= layout.heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [layout.widthMm, layout.heightMm]
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

  cards.forEach((card, index) => {
    const localIndex = index % (cardsPerRow * cardsPerColumn);
    if (index > 0 && localIndex === 0) {
      doc.addPage();
    }
    const row = Math.floor(localIndex / cardsPerRow);
    const col = localIndex % cardsPerRow;
    const x = marginMm + col * cardWidth;
    const y = marginMm + row * cardHeight;

    if (marginMm > 0) {
      logger.warn("PDF export uses margin", `${marginMm}mm margin applied`);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const activeBoxes = card.boxes?.length ? card.boxes : layout.boxes;
    activeBoxes.forEach((box) => {
      if (box.style.visible === false) return;
      const fontPx = (box.style.fontSizePt / 72) * CANVAS_DPI;
      const paddingPx = mmToCanvasPx(box.style.paddingMm);
      const boxX = mmToCanvasPx(box.xMm);
      const boxY = mmToCanvasPx(box.yMm);
      const boxW = Math.max(1, mmToCanvasPx(box.wMm));
      const boxH = Math.max(1, mmToCanvasPx(box.hMm));
      const maxWidth = Math.max(1, boxW - paddingPx * 2);
      const text = resolveBoxText(card, box.fieldId, box.textMode, box.text, box.staticText);

      ctx.font = `${box.style.fontWeight === "bold" ? "700" : "400"} ${fontPx}px "DejaVu Sans", "Noto Sans", "Arial", sans-serif`;
      ctx.fillStyle = "#111827";
      ctx.textBaseline = "top";

      if (pdfDebug) {
        ctx.strokeStyle = "rgba(75,85,99,0.75)";
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
      }

      const lines = wrapText(ctx, text, maxWidth);
      const lineHeightPx = fontPx * box.style.lineHeight;
      lines.forEach((line, lineIndex) => {
        const textY = boxY + paddingPx + lineIndex * lineHeightPx;
        if (textY > boxY + boxH - lineHeightPx) return;

        const measured = ctx.measureText(line).width;
        let textX = boxX + paddingPx;
        if (box.style.align === "center") {
          textX = boxX + (boxW - measured) / 2;
        }
        if (box.style.align === "right") {
          textX = boxX + boxW - paddingPx - measured;
        }
        ctx.fillText(line, textX, textY);
      });
    });

    if (pdfDebug) {
      ctx.strokeStyle = "rgba(30,64,175,0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }

    const image = canvas.toDataURL("image/png");
    doc.addImage(image, "PNG", x, y, cardWidth, cardHeight);
  });

  doc.save(fileName);
};
