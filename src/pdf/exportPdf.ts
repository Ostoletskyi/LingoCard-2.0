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
    if (pdfDebug) {
      doc.setLineWidth(0.2);
      doc.setDrawColor(60, 60, 60);
      doc.rect(x, y, cardWidth, cardHeight);
    }

    layout.boxes.forEach((box) => {
      const value = getFieldText(card, box.fieldId).text;
      if (box.style.visible === false) return;
      if (pdfDebug) {
        doc.setLineWidth(0.1);
        doc.setDrawColor(90, 90, 90);
        doc.rect(x + box.xMm, y + box.yMm, box.wMm, box.hMm);
      }
      const textX = x + box.xMm + box.style.paddingMm;
      const textY = y + box.yMm + box.style.paddingMm + box.style.fontSizePt * 0.3527;
      const maxWidth = Math.max(1, box.wMm - box.style.paddingMm * 2);
      const wrapped = doc.splitTextToSize(value, maxWidth);
      doc.setFontSize(box.style.fontSizePt);
      doc.setLineHeightFactor(box.style.lineHeight);
      if (box.style.fontWeight === "bold") {
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }
      doc.text(wrapped, textX, textY, {
        maxWidth,
        align: box.style.align
      });
    });
  });

  doc.save(fileName);
};
