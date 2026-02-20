import type { Card } from "../model/cardSchema";
import type { Box } from "../model/layoutSchema";

const MIN_FONT_PT = 5;
const MAX_FONT_PT = 36;
const MM_PER_PT = 0.3528;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const hasText = (value: string | undefined | null) => Boolean(value && value.trim().length > 0);

const sanitizeInline = (value: string | undefined | null) => (value ?? "").replace(/\s+/g, " ").trim();

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

  const fittedLines = measured.lines;

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
  autoH?: boolean;
  reservedRightPx?: number;
  semanticKey?: string;
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
    autoH: params.autoH,
    reservedRightPx: params.reservedRightPx,
    staticText: fitted.text,
    label: params.label,
    type: params.semanticKey ?? params.id
  };

  return box;
};

const collectTrLines = (card: Card) => {
  const out: Array<{ fieldId: string; text: string }> = [];
  for (let i = 1; i <= 4; i += 1) {
    const ru = sanitizeInline(card[`tr_${i}_ru` as keyof Card] as string);
    const ctx = sanitizeInline(card[`tr_${i}_ctx` as keyof Card] as string);
    const line = joinPresent([ru, ctx ? `(${ctx})` : ""], " ");
    if (hasText(line)) out.push({ fieldId: `tr_${i}_ru`, text: line });
  }
  return out;
};

const collectPairLines = (card: Card, prefix: "syn" | "ex" | "rek", max: number) => {
  const out: Array<{ fieldId: string; text: string }> = [];
  for (let i = 1; i <= max; i += 1) {
    if (prefix === "syn") {
      const de = sanitizeInline(card[`syn_${i}_de` as keyof Card] as string);
      const ru = sanitizeInline(card[`syn_${i}_ru` as keyof Card] as string);
      const line = joinPresent([de, ru], " — ");
      if (hasText(line)) out.push({ fieldId: `syn_${i}_de`, text: line });
      continue;
    }
    if (prefix === "ex") {
      const de = sanitizeInline(card[`ex_${i}_de` as keyof Card] as string);
      const ru = sanitizeInline(card[`ex_${i}_ru` as keyof Card] as string);
      const tag = card[`ex_${i}_tag` as keyof Card] as string;
      const line = [
        joinPresent([tag ? `[${tag}]` : "", de], " "),
        ru ? `— ${ru}` : ""
      ]
        .filter(Boolean)
        .join("\n");
      if (hasText(line)) out.push({ fieldId: `ex_${i}_de`, text: line });
      continue;
    }
    const de = sanitizeInline(card[`rek_${i}_de` as keyof Card] as string);
    const ru = sanitizeInline(card[`rek_${i}_ru` as keyof Card] as string);
    const line = joinPresent([de, ru], " → ");
    if (hasText(line)) out.push({ fieldId: `rek_${i}_de`, text: line });
  }
  return out;
};

const collectFormLines = (card: Card) => {
  const p3 = sanitizeInline(card.forms_p3);
  const prat = sanitizeInline(card.forms_prat);
  const p2 = sanitizeInline(card.forms_p2);
  const aux = sanitizeInline(card.forms_aux);
  const perfekt = joinPresent([aux, p2], " ");
  const compact = joinPresent([p3, prat, perfekt], " - ");
  if (hasText(compact)) return [{ fieldId: "forms_p3", text: compact }];

  return [
    { fieldId: "forms_p3", text: joinPresent(["P3", p3], ": ") },
    { fieldId: "forms_prat", text: joinPresent(["Prät", prat], ": ") },
    { fieldId: "forms_p2", text: joinPresent(["P2", p2], ": ") },
    { fieldId: "forms_aux", text: joinPresent(["Aux", aux], ": ") }
  ].filter((line) => hasText(line.text));
};

const buildTemplateZones = (widthMm: number, heightMm: number, variant: 0 | 1 | 2) => {
  const margin = 4;
  const innerW = widthMm - margin * 2;
  const contentTop = margin + 22;
  const contentBottom = heightMm - margin;
  const contentH = Math.max(20, contentBottom - contentTop);
  const gap = 2;

  const leftW = variant === 1 ? innerW * 0.5 : variant === 2 ? innerW : innerW * 0.62;
  const rightW = innerW - leftW - gap;

  if (variant === 2) {
    const sectionGap = 1.2;
    const sectionH = (contentH - sectionGap * 3) / 4;
    return {
      heroInf: { xMm: margin, yMm: margin, wMm: innerW * 0.62, hMm: 10 },
      heroFreq: { xMm: margin + innerW * 0.62 + gap, yMm: margin, wMm: innerW * 0.38 - gap, hMm: 4.8 },
      heroMeta: { xMm: margin + innerW * 0.62 + gap, yMm: margin + 5.4, wMm: innerW * 0.38 - gap, hMm: 4.6 },
      heroTranslations: { xMm: margin, yMm: margin + 11, wMm: innerW, hMm: 9.5 },
      left: { xMm: margin, yMm: contentTop, wMm: innerW, hMm: sectionH * 2 + sectionGap },
      rightTop: {
        xMm: margin,
        yMm: contentTop + sectionH * 2 + sectionGap * 2,
        wMm: innerW,
        hMm: sectionH
      },
      rightBottom: {
        xMm: margin,
        yMm: contentTop + sectionH * 3 + sectionGap * 3,
        wMm: innerW,
        hMm: sectionH
      }
    };
  }

  return {
    heroInf: { xMm: margin, yMm: margin, wMm: innerW * 0.62, hMm: 10 },
    heroFreq: { xMm: margin + innerW * 0.62 + gap, yMm: margin, wMm: innerW * 0.38 - gap, hMm: 4.8 },
    heroMeta: { xMm: margin + innerW * 0.62 + gap, yMm: margin + 5.4, wMm: innerW * 0.38 - gap, hMm: 4.6 },
    heroTranslations: { xMm: margin, yMm: margin + 11, wMm: innerW, hMm: variant === 1 ? 10.8 : 9.5 },
    left: { xMm: margin, yMm: contentTop, wMm: leftW, hMm: contentH },
    rightTop: { xMm: margin + leftW + gap, yMm: contentTop, wMm: rightW, hMm: variant === 1 ? contentH * 0.5 : contentH * 0.44 },
    rightBottom: {
      xMm: margin + leftW + gap,
      yMm: contentTop + (variant === 1 ? contentH * 0.52 : contentH * 0.46),
      wMm: rightW,
      hMm: variant === 1 ? contentH * 0.48 : contentH * 0.54
    }
  };
};

export const buildSemanticLayoutBoxes = (card: Card, widthMm: number, heightMm: number, variant: 0 | 1 | 2 = 0): Box[] => {
  const zones = buildTemplateZones(widthMm, heightMm, variant);
  const boxes: Box[] = [];

  boxes.push(
    makeBox({
      id: "hero_inf",
      semanticKey: "hero_inf",
      fieldId: "inf",
      text: card.inf || "—",
      zone: zones.heroInf,
      baseFontPt: 20,
      minFontPt: 16,
      maxFontPt: 24,
      lineHeight: 1.05,
      weight: "bold",
      label: "Infinitiv",
      textMode: "dynamic",
      autoH: false
    })
  );

  const trLines = collectTrLines(card).map((line) => line.text);
  const exLines = collectPairLines(card, "ex", 5).map((line) => line.text);
  const formsLines = collectFormLines(card).map((line) => line.text);
  const synLines = collectPairLines(card, "syn", 3).map((line) => line.text);
  const rekLines = collectPairLines(card, "rek", 5).map((line) => line.text);

  const trText = trLines.length
    ? trLines.map((line, index) => `${index + 1}. ${line}`).join("\n")
    : "—";
  const exText = exLines.length
    ? exLines.map((line, index) => `${index + 1}. ${line}`).join("\n")
    : "—";
  const formsText = formsLines.length ? formsLines.join("\n") : "—";
  const synText = synLines.length
    ? synLines.map((line, index) => `${index + 1}. ${line}`).join("\n")
    : "—";
  const rekText = rekLines.length
    ? rekLines.map((line, index) => `${index + 1}. ${line}`).join("\n")
    : "—";

  boxes.push(
    makeBox({
      id: "freq",
      semanticKey: "freq",
      fieldId: "freq",
      text: "",
      zone: zones.heroFreq,
      baseFontPt: 12,
      minFontPt: 10,
      maxFontPt: 16,
      lineHeight: 1,
      label: "Частотность",
      textMode: "dynamic",
      autoH: false,
      reservedRightPx: 48
    })
  );

  boxes.push(
    makeBox({
      id: "meta",
      semanticKey: "meta",
      fieldId: "tags",
      text: card.tags.length ? card.tags.join(" · ") : "",
      zone: zones.heroMeta,
      baseFontPt: 8,
      minFontPt: 7,
      maxFontPt: 10,
      lineHeight: 1.1,
      label: "Meta",
      textMode: "dynamic",
      autoH: false
    })
  );

  boxes.push(
    makeBox({
      id: "hero_translations",
      semanticKey: "hero_translations",
      fieldId: "hero_translations",
      text: trText,
      zone: zones.heroTranslations,
      baseFontPt: 10,
      minFontPt: 8,
      maxFontPt: 12,
      lineHeight: 1.2,
      label: "Переводы",
      textMode: "dynamic",
      autoH: true
    })
  );

  const leftTopH = zones.left.hMm * 0.33;
  boxes.push(
    makeBox({
      id: "examples",
      semanticKey: "examples",
      fieldId: "ex_1_de",
      text: exText,
      zone: { xMm: zones.left.xMm, yMm: zones.left.yMm, wMm: zones.left.wMm, hMm: leftTopH },
      baseFontPt: 12,
      minFontPt: 8,
      maxFontPt: 14,
      lineHeight: 1.25,
      label: "Примеры",
      textMode: "static",
      autoH: true
    })
  );

  boxes.push(
    makeBox({
      id: "recommendations",
      semanticKey: "recommendations",
      fieldId: "rek_1_de",
      text: rekText,
      zone: {
        xMm: zones.left.xMm,
        yMm: zones.left.yMm + leftTopH + 1,
        wMm: zones.left.wMm,
        hMm: zones.left.hMm - leftTopH - 1
      },
      baseFontPt: 11,
      minFontPt: 8,
      maxFontPt: 13,
      lineHeight: 1.18,
      label: "Рекомендации",
      textMode: "static",
      autoH: true
    })
  );

  const rightTopHalf = zones.rightTop.hMm * 0.5;
  boxes.push(
    makeBox({
      id: "forms",
      semanticKey: "forms",
      fieldId: "forms_p3",
      text: formsText,
      zone: { xMm: zones.rightTop.xMm, yMm: zones.rightTop.yMm, wMm: zones.rightTop.wMm, hMm: rightTopHalf },
      baseFontPt: 12,
      minFontPt: 9,
      maxFontPt: 14,
      lineHeight: 1.16,
      label: "Формы и рекция",
      textMode: "static",
      autoH: true
    })
  );

  boxes.push(
    makeBox({
      id: "synonyms",
      semanticKey: "synonyms",
      fieldId: "syn_1_de",
      text: synText,
      zone: {
        xMm: zones.rightTop.xMm,
        yMm: zones.rightTop.yMm + rightTopHalf + 1,
        wMm: zones.rightTop.wMm,
        hMm: zones.rightTop.hMm - rightTopHalf - 1
      },
      baseFontPt: 12,
      minFontPt: 9,
      maxFontPt: 14,
      lineHeight: 1.16,
      label: "Синонимы",
      textMode: "static",
      autoH: true
    })
  );

  return boxes.map((box, index) => ({ ...box, z: index + 1 }));
};

export const applySemanticLayoutToCard = (card: Card, widthMm: number, heightMm: number, variant: 0 | 1 | 2 = 0): Card => ({
  ...card,
  boxes: buildSemanticLayoutBoxes(card, widthMm, heightMm, variant)
});
