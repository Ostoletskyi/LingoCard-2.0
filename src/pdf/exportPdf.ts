import { jsPDF } from "jspdf";
import type { Card } from "../model/cardSchema";
import type { Layout } from "../model/layoutSchema";
import { getFieldText } from "../utils/cardFields";

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
  _options: PdfExportOptions,
  fileName: string = "cards.pdf"
) => {
  const cardWidth = layout.widthMm;
  const cardHeight = layout.heightMm;

  const doc = new jsPDF({
    orientation: cardWidth >= cardHeight ? "landscape" : "portrait",
    unit: "mm",
    format: [cardWidth, cardHeight]
  });

  cards.forEach((card, index) => {
    if (index > 0) {
      doc.addPage([cardWidth, cardHeight], cardWidth >= cardHeight ? "landscape" : "portrait");
    }

    layout.boxes.forEach((box) => {
      if (box.style.visible === false) return;
      const value = getFieldText(card, box.fieldId).text;
      const textX = box.xMm + box.style.paddingMm;
      const textY = box.yMm + box.style.paddingMm + box.style.fontSizePt * 0.3527;
      const maxWidth = Math.max(1, box.wMm - box.style.paddingMm * 2);
      const wrapped = doc.splitTextToSize(value, maxWidth);

      doc.setFontSize(box.style.fontSizePt);
      doc.setLineHeightFactor(box.style.lineHeight);
      if (box.style.fontWeight === "bold") {
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
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
