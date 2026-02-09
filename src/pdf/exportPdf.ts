import { jsPDF } from "jspdf";
import type { Card } from "../model/cardSchema";
import type { Layout } from "../model/layoutSchema";

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

  cards.forEach((card, index) => {
    const pageIndex = Math.floor(index / (cardsPerRow * cardsPerColumn));
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
      const value = (card as Record<string, string>)[box.fieldId] ?? "";
      if (box.style.visible === false) return;
      const textX = x + box.xMm + box.style.paddingMm;
      const textY = y + box.yMm + box.style.paddingMm + box.style.fontSizePt * 0.3527;
      doc.setFontSize(box.style.fontSizePt);
      if (box.style.fontWeight === "bold") {
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }
      doc.text(value, textX, textY, {
        maxWidth: box.wMm,
        align: box.style.align
      });
    });
  });

  doc.save("cards.pdf");
};
