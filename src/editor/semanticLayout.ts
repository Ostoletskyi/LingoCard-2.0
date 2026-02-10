import type { Card } from "../model/cardSchema";
import type { Box } from "../model/layoutSchema";

const MIN_FONT_PT = 5;
const MAX_FONT_PT = 36;
const MM_PER_PT = 0.3528;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const hasText = (value: string | undefined | null) => Boolean(value && value.trim().length > 0);

const joinPresent = (parts: Array<string | undefined | null>, separator = " · ") =>
  parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(separator);

const wrapText = (text: string, charsPerLine: number): string[] => {
  if (!text.trim()) return [""];
  const rows = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  rows.forEach((row) => {
    const words = row.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      return;
    }
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= charsPerLine) {
        line = candidate;
      } else {
        if (line) out.push(line);
        line = word;
      }
    });
    if (line) out.push(line);
  });

  return out.length ? out : [""];
};

const fitTextToBox = (
  rawText: string,
  widthMm: number,
  heightMm: number,
  baseFontPt: number,
  minFontPt = MIN_FONT_PT,
  maxFontPt = MAX_FONT_PT,
  lineHeight = 1.2,
  paddingMm = 0.8
) => {
  const clean = rawText.trim();
  const text = clean.length ? clean : "—";
  const availableWidth = Math.max(4, widthMm - paddingMm * 2);
  const availableHeight = Math.max(3, heightMm - paddingMm * 2);
  let fontPt = clamp(baseFontPt, minFontPt, maxFontPt);

  const measure = (pt: number) => {
    const charsPerLine = Math.max(8, Math.floor((availableWidth * 2.35) / Math.max(6, pt)));
    const lines = wrapText(text, charsPerLine);
    const lineMm = pt * MM_PER_PT * lineHeight;
    const maxLines = Math.max(1, Math.floor(availableHeight / Math.max(0.5, lineMm)));
    return { charsPerLine, lines, maxLines };
  };

  let measured = measure(fontPt);
  while (fontPt > minFontPt && measured.lines.length > measured.maxLines) {
    fontPt = Math.max(minFontPt, fontPt - 0.5);
    measured = measure(fontPt);
  }

  let fittedLines = measured.lines;
  if (fittedLines.length > measured.maxLines) {
    fittedLines = fittedLines.slice(0, measured.maxLines);
    const lastIndex = fittedLines.length - 1;
    const lastLine = fittedLines[lastIndex] ?? "";
    const truncated = lastLine.length > 1 ? `${lastLine.slice(0, Math.max(1, lastLine.length - 1))}…` : "…";
    fittedLines[lastIndex] = truncated;
  }

  return {
    fontPt: clamp(fontPt, minFontPt, maxFontPt),
    text: fittedLines.join("\n")
  };
};

type Zone = { xMm: number; yMm: number; wMm: number; hMm: number };

const makeBox = (params: {
  id: string;
  fieldId: string;
  text: string;
  zone: Zone;
  baseFontPt: number;
  minFontPt?: number;
  maxFontPt?: number;
  lineHeight?: number;
  weight?: "normal" | "bold";
  label: string;
  textMode?: "static" | "dynamic";
}) => {
  const fitted = fitTextToBox(
    params.text,
    params.zone.wMm,
    params.zone.hMm,
    params.baseFontPt,
    params.minFontPt,
    params.maxFontPt,
    params.lineHeight ?? 1.2
  );

  const box: Box = {
    id: params.id,
    fieldId: params.fieldId,
    xMm: params.zone.xMm,
    yMm: params.zone.yMm,
    wMm: params.zone.wMm,
    hMm: params.zone.hMm,
    z: 1,
    style: {
      fontSizePt: fitted.fontPt,
      fontWeight: params.weight ?? "normal",
      align: "left",
      lineHeight: params.lineHeight ?? 1.2,
      paddingMm: 0.8,
      border: false,
      visible: true
    },
    textMode: params.textMode ?? "static",
    staticText: fitted.text,
    label: params.label
  };

  return box;
};

const collectTrLines = (card: Card) => {
  const out: Array<{ fieldId: string; text: string }> = [];
  for (let i = 1; i <= 4; i += 1) {
    const ru = card[`tr_${i}_ru` as keyof Card] as string;
    const ctx = card[`tr_${i}_ctx` as keyof Card] as string;
    const line = joinPresent([ru, ctx ? `(${ctx})` : ""], " ");
    if (hasText(line)) out.push({ fieldId: `tr_${i}_ru`, text: line });
  }
  return out;
};

const collectPairLines = (card: Card, prefix: "syn" | "ex" | "rek", max: number) => {
  const out: Array<{ fieldId: string; text: string }> = [];
  for (let i = 1; i <= max; i += 1) {
    if (prefix === "syn") {
      const de = card[`syn_${i}_de` as keyof Card] as string;
      const ru = card[`syn_${i}_ru` as keyof Card] as string;
      const line = joinPresent([de, ru], " — ");
      if (hasText(line)) out.push({ fieldId: `syn_${i}_de`, text: line });
      continue;
    }
    if (prefix === "ex") {
      const de = card[`ex_${i}_de` as keyof Card] as string;
      const ru = card[`ex_${i}_ru` as keyof Card] as string;
      const tag = card[`ex_${i}_tag` as keyof Card] as string;
      const line = joinPresent([de, ru, tag ? `[${tag}]` : ""], " | ");
      if (hasText(line)) out.push({ fieldId: `ex_${i}_de`, text: line });
      continue;
    }
    const de = card[`rek_${i}_de` as keyof Card] as string;
    const ru = card[`rek_${i}_ru` as keyof Card] as string;
    const line = joinPresent([de, ru], " → ");
    if (hasText(line)) out.push({ fieldId: `rek_${i}_de`, text: line });
  }
  return out;
};

const collectFormLines = (card: Card) =>
  [
    { fieldId: "forms_p3", text: joinPresent(["P3", card.forms_p3], ": ") },
    { fieldId: "forms_prat", text: joinPresent(["Prät", card.forms_prat], ": ") },
    { fieldId: "forms_p2", text: joinPresent(["P2", card.forms_p2], ": ") },
    { fieldId: "forms_aux", text: joinPresent(["Aux", card.forms_aux], ": ") }
  ].filter((line) => hasText(line.text));

const buildTemplateZones = (widthMm: number, heightMm: number) => {
  const margin = 4;
  const innerW = widthMm - margin * 2;
  const contentTop = margin + 15;
  const contentBottom = heightMm - margin;
  const contentH = Math.max(20, contentBottom - contentTop);
  const gap = 2;

  const leftW = innerW * 0.62;
  const rightW = innerW - leftW - gap;

  return {
    hero: { xMm: margin, yMm: margin, wMm: innerW, hMm: 9.5 },
    meta: { xMm: margin, yMm: margin + 10.5, wMm: innerW, hMm: 4.2 },
    left: { xMm: margin, yMm: contentTop, wMm: leftW, hMm: contentH },
    rightTop: { xMm: margin + leftW + gap, yMm: contentTop, wMm: rightW, hMm: contentH * 0.44 },
    rightBottom: {
      xMm: margin + leftW + gap,
      yMm: contentTop + contentH * 0.46,
      wMm: rightW,
      hMm: contentH * 0.54
    }
  };
};

export const buildSemanticLayoutBoxes = (card: Card, widthMm: number, heightMm: number): Box[] => {
  const zones = buildTemplateZones(widthMm, heightMm);
  const boxes: Box[] = [];

  boxes.push(
    makeBox({
      id: "hero_inf",
      fieldId: "inf",
      text: card.inf || "—",
      zone: zones.hero,
      baseFontPt: clamp(widthMm * 0.11, 16, 24),
      minFontPt: 12,
      maxFontPt: 28,
      lineHeight: 1.05,
      weight: "bold",
      label: "Infinitiv",
      textMode: "dynamic"
    })
  );

  const metaLine = joinPresent([card.freq ? `Freq ${card.freq}` : "", card.tags.join(", ")]);
  boxes.push(
    makeBox({
      id: "meta",
      fieldId: "freq",
      text: metaLine || "—",
      zone: zones.meta,
      baseFontPt: 8.5,
      minFontPt: 6,
      maxFontPt: 10,
      lineHeight: 1.1,
      label: "Meta",
      textMode: "static"
    })
  );

  const placeSection = (
    sectionId: string,
    title: string,
    lines: Array<{ fieldId: string; text: string }>,
    zone: Zone,
    baseFontPt: number,
    titleFontPt: number
  ) => {
    if (!lines.length) return;
    const headerH = 4.2;
    const gap = 0.7;
    let cursorY = zone.yMm;

    boxes.push(
      makeBox({
        id: `${sectionId}_title`,
        fieldId: lines[0]!.fieldId,
        text: title,
        zone: { xMm: zone.xMm, yMm: cursorY, wMm: zone.wMm, hMm: headerH },
        baseFontPt: titleFontPt,
        minFontPt: 6,
        maxFontPt: 10,
        weight: "bold",
        lineHeight: 1.1,
        label: title,
        textMode: "static"
      })
    );
    cursorY += headerH + gap;

    const remainingH = Math.max(4, zone.yMm + zone.hMm - cursorY);
    const rowH = Math.max(4.5, (remainingH - gap * Math.max(0, lines.length - 1)) / lines.length);

    lines.forEach((line, idx) => {
      if (cursorY + rowH > zone.yMm + zone.hMm + 0.001) return;
      boxes.push(
        makeBox({
          id: `${sectionId}_${idx + 1}`,
          fieldId: line.fieldId,
          text: line.text,
          zone: { xMm: zone.xMm, yMm: cursorY, wMm: zone.wMm, hMm: rowH },
          baseFontPt,
          minFontPt: 5,
          maxFontPt: 18,
          lineHeight: 1.18,
          label: line.fieldId,
          textMode: "static"
        })
      );
      cursorY += rowH + gap;
    });
  };

  const trLines = collectTrLines(card);
  const exLines = collectPairLines(card, "ex", 5);
  const formsLines = collectFormLines(card);
  const synLines = collectPairLines(card, "syn", 3);
  const rekLines = collectPairLines(card, "rek", 5);

  const leftTopH = zones.left.hMm * 0.42;
  placeSection(
    "tr",
    "Переводы",
    trLines,
    { xMm: zones.left.xMm, yMm: zones.left.yMm, wMm: zones.left.wMm, hMm: leftTopH },
    clamp(widthMm * 0.062, 9, 12),
    9.5
  );
  placeSection(
    "ex",
    "Примеры",
    exLines,
    {
      xMm: zones.left.xMm,
      yMm: zones.left.yMm + leftTopH + 1,
      wMm: zones.left.wMm,
      hMm: zones.left.hMm - leftTopH - 1
    },
    clamp(widthMm * 0.05, 7, 9),
    8.5
  );

  const rightTopHalf = zones.rightTop.hMm * 0.52;
  placeSection(
    "forms",
    "Формы",
    formsLines,
    { xMm: zones.rightTop.xMm, yMm: zones.rightTop.yMm, wMm: zones.rightTop.wMm, hMm: rightTopHalf },
    clamp(widthMm * 0.052, 7.5, 10),
    8.5
  );
  placeSection(
    "syn",
    "Синонимы",
    synLines,
    {
      xMm: zones.rightTop.xMm,
      yMm: zones.rightTop.yMm + rightTopHalf + 1,
      wMm: zones.rightTop.wMm,
      hMm: zones.rightTop.hMm - rightTopHalf - 1
    },
    clamp(widthMm * 0.052, 7.5, 10),
    8.5
  );

  placeSection(
    "rek",
    "Рекомендации",
    rekLines,
    zones.rightBottom,
    clamp(widthMm * 0.05, 7, 9),
    8.5
  );

  return boxes.map((box, index) => ({ ...box, z: index + 1 }));
};

export const applySemanticLayoutToCard = (card: Card, widthMm: number, heightMm: number): Card => ({
  ...card,
  boxes: buildSemanticLayoutBoxes(card, widthMm, heightMm)
});
