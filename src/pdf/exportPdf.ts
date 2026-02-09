import { jsPDF } from "jspdf";
import type { Card } from "../model/cardSchema";
import type { Layout } from "../model/layoutSchema";
import { getCardFieldValue } from "../utils/cardFields";
import { logger } from "../utils/logger";

export type PdfExportOptions = {
  pageFormat?: "a4" | "a5";
  cardsPerRow: number;
  cardsPerColumn: number;
  marginMm: number;
};

export const exportCardsToPdf = (
  cards: Card[],
  layout: Layout,
  options: PdfExportOptions
) => {
  const { cardsPerRow, cardsPerColumn, marginMm, pageFormat = "a4" } = options;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: pageFormat
  });

  const cardWidth = layout.widthMm;
  const cardHeight = layout.heightMm;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const requiredWidth = marginMm * 2 + cardsPerRow * cardWidth;
  const requiredHeight = marginMm * 2 + cardsPerColumn * cardHeight;

  if (requiredWidth > pageWidth || requiredHeight > pageHeight) {
    logger.warn(
      "Cards grid exceeds page size",
      `required ${requiredWidth}x${requiredHeight}mm, page ${pageWidth}x${pageHeight}mm`
    );
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

    doc.rect(x, y, cardWidth, cardHeight);

    layout.boxes.forEach((box) => {
      const value = getCardFieldValue(card, box.fieldId);
      if (box.style.visible === false) return;
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

  doc.save("cards.pdf");
};
