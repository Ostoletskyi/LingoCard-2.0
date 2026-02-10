import { jsPDF } from "jspdf";
import type { Card } from "../model/cardSchema";
import type { Layout } from "../model/layoutSchema";
import { getFieldText } from "../utils/cardFields";

export type PdfExportOptions = {
  pageFormat?: "a4" | "a5";
  cardsPerRow: number;
  cardsPerColumn: number;
  marginMm: number;
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
      doc.text(wrapped, textX, textY, {
        maxWidth,
        align: box.style.align
      });
    });
  });

  doc.save(fileName);
};
