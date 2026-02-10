import type { Card } from "../model/cardSchema";
import type { Box } from "../model/layoutSchema";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hasText = (value: string | undefined | null) => Boolean(value && value.trim().length > 0);

const joinPresent = (parts: Array<string | undefined | null>, sep = " · ") =>
  parts.filter((item) => hasText(item ?? "")).map((item) => item!.trim()).join(sep);

const estimateLines = (text: string, widthMm: number, fontPt: number) => {
  const charsPerLine = Math.max(10, Math.floor((widthMm * 2.35) / Math.max(7, fontPt)));
  return Math.max(1, Math.ceil(text.length / charsPerLine));
};

const makeBox = (params: {
  id: string;
  fieldId: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  fontPt: number;
  weight?: "normal" | "bold";
  lineHeight?: number;
  textMode?: "static" | "dynamic";
  staticText?: string;
  label?: string;
}): Box => ({
  id: params.id,
  fieldId: params.fieldId,
  xMm: params.xMm,
  yMm: params.yMm,
  wMm: params.wMm,
  hMm: params.hMm,
  z: 1,
  style: {
    fontSizePt: params.fontPt,
    fontWeight: params.weight ?? "normal",
    align: "left",
    lineHeight: params.lineHeight ?? 1.2,
    paddingMm: 0.8,
    border: false,
    visible: true
  },
  textMode: params.textMode ?? "dynamic",
  staticText: params.staticText,
  label: params.label
});

const collectPairs = (
  card: Card,
  prefix: "tr" | "syn" | "ex" | "rek",
  max: number
): Array<{ fieldId: string; text: string }> => {
  const lines: Array<{ fieldId: string; text: string }> = [];
  for (let i = 1; i <= max; i += 1) {
    if (prefix === "tr") {
      const ru = card[`tr_${i}_ru` as keyof Card] as string;
      const ctx = card[`tr_${i}_ctx` as keyof Card] as string;
      const text = joinPresent([ru, ctx ? `(${ctx})` : ""], " ");
      if (hasText(text)) lines.push({ fieldId: `tr_${i}_ru`, text });
      continue;
    }
    if (prefix === "syn") {
      const de = card[`syn_${i}_de` as keyof Card] as string;
      const ru = card[`syn_${i}_ru` as keyof Card] as string;
      const text = joinPresent([de, ru], " — ");
      if (hasText(text)) lines.push({ fieldId: `syn_${i}_de`, text });
      continue;
    }
    if (prefix === "ex") {
      const de = card[`ex_${i}_de` as keyof Card] as string;
      const ru = card[`ex_${i}_ru` as keyof Card] as string;
      const tag = card[`ex_${i}_tag` as keyof Card] as string;
      const text = joinPresent([de, ru, tag ? `[${tag}]` : ""], " | ");
      if (hasText(text)) lines.push({ fieldId: `ex_${i}_de`, text });
      continue;
    }
    const de = card[`rek_${i}_de` as keyof Card] as string;
    const ru = card[`rek_${i}_ru` as keyof Card] as string;
    const text = joinPresent([de, ru], " → ");
    if (hasText(text)) lines.push({ fieldId: `rek_${i}_de`, text });
  }
  return lines;
};

export const buildSemanticLayoutBoxes = (card: Card, widthMm: number, heightMm: number): Box[] => {
  const margin = 4;
  const innerWidth = widthMm - margin * 2;
  const contentBottom = heightMm - margin;
  const boxes: Box[] = [];

  const heroFont = clamp(widthMm * 0.1, 16, 24);
  const heroHeight = 10;
  boxes.push(
    makeBox({
      id: "hero_inf",
      fieldId: "inf",
      xMm: margin,
      yMm: margin,
      wMm: innerWidth,
      hMm: heroHeight,
      fontPt: heroFont,
      weight: "bold",
      lineHeight: 1.05,
      label: "Инфинитив"
    })
  );

  const metaText = joinPresent([card.freq ? `Freq ${card.freq}` : "", card.tags.join(", ")]);
  let cursorY = margin + heroHeight + 1;
  if (hasText(metaText)) {
    boxes.push(
      makeBox({
        id: "meta",
        fieldId: "freq",
        xMm: margin,
        yMm: cursorY,
        wMm: innerWidth,
        hMm: 5,
        fontPt: clamp(widthMm * 0.05, 7.5, 10),
        textMode: "static",
        staticText: metaText,
        label: "Мета"
      })
    );
    cursorY += 6;
  }

  const colGap = 2;
  const leftWidth = innerWidth * 0.58;
  const rightWidth = innerWidth - leftWidth - colGap;
  const leftX = margin;
  const rightX = margin + leftWidth + colGap;
  let leftY = cursorY;
  let rightY = cursorY;

  const pushSection = (
    column: "left" | "right",
    key: string,
    title: string,
    lines: Array<{ fieldId: string; text: string }>,
    baseFont: number,
    lineGap = 0.8
  ) => {
    if (!lines.length) return;
    const x = column === "left" ? leftX : rightX;
    const w = column === "left" ? leftWidth : rightWidth;
    let y = column === "left" ? leftY : rightY;

    const titleHeight = 4.5;
    if (y + titleHeight > contentBottom) return;
    boxes.push(
      makeBox({
        id: `${key}_title`,
        fieldId: lines[0]!.fieldId,
        xMm: x,
        yMm: y,
        wMm: w,
        hMm: titleHeight,
        fontPt: clamp(baseFont * 0.86, 7.5, 10),
        weight: "bold",
        textMode: "static",
        staticText: title,
        label: title
      })
    );
    y += titleHeight;

    lines.forEach((line, idx) => {
      const linesCount = estimateLines(line.text, w, baseFont);
      const h = clamp(linesCount * 3.8, 4.4, 12);
      if (y + h > contentBottom) return;
      boxes.push(
        makeBox({
          id: `${key}_${idx + 1}`,
          fieldId: line.fieldId,
          xMm: x,
          yMm: y,
          wMm: w,
          hMm: h,
          fontPt: baseFont,
          lineHeight: 1.22,
          textMode: "static",
          staticText: line.text,
          label: line.fieldId
        })
      );
      y += h + lineGap;
    });

    if (column === "left") leftY = y + 0.8;
    else rightY = y + 0.8;
  };

  pushSection("left", "tr", "Переводы", collectPairs(card, "tr", 4), clamp(widthMm * 0.066, 9, 12));

  const formsLines = [
    { fieldId: "forms_p3", text: joinPresent(["P3", card.forms_p3], ": ") },
    { fieldId: "forms_prat", text: joinPresent(["Prät", card.forms_prat], ": ") },
    { fieldId: "forms_p2", text: joinPresent(["P2", card.forms_p2], ": ") },
    { fieldId: "forms_aux", text: joinPresent(["Aux", card.forms_aux], ": ") }
  ].filter((item) => hasText(item.text));
  pushSection("right", "forms", "Формы", formsLines, clamp(widthMm * 0.056, 8, 10));

  pushSection("right", "syn", "Синонимы", collectPairs(card, "syn", 3), clamp(widthMm * 0.056, 8, 10));
  pushSection("left", "ex", "Примеры", collectPairs(card, "ex", 5), clamp(widthMm * 0.052, 7.5, 9));
  pushSection("right", "rek", "Рекомендации", collectPairs(card, "rek", 5), clamp(widthMm * 0.052, 7.5, 9));

  return boxes.map((box, index) => ({ ...box, z: index + 1 }));
};

export const applySemanticLayoutToCard = (card: Card, widthMm: number, heightMm: number): Card => ({
  ...card,
  boxes: buildSemanticLayoutBoxes(card, widthMm, heightMm)
});
