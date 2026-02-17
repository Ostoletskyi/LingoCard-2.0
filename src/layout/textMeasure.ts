export type TextMeasurePadding = {
  xPx: number;
  yPx: number;
};

const getCanvasContext = () => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable for text measurement.");
  }
  return ctx;
};

const splitRows = (text: string) => text.replace(/\r\n/g, "\n").split("\n");

export const measureWrappedLines = (
  text: string,
  fontCss: string,
  widthPx: number,
  ctx?: CanvasRenderingContext2D
): string[] => {
  const measureCtx = ctx ?? getCanvasContext();
  measureCtx.font = fontCss;
  const safeWidth = Math.max(1, widthPx);
  const rows = splitRows(text);
  const lines: string[] = [];

  rows.forEach((row) => {
    if (!row) {
      lines.push("");
      return;
    }
    const words = row.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }
    let current = "";
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (measureCtx.measureText(candidate).width <= safeWidth) {
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

  return lines.length ? lines : [""];
};

export const measureWrappedHeight = (
  text: string,
  fontCss: string,
  widthPx: number,
  lineHeight: number,
  padding: TextMeasurePadding,
  ctx?: CanvasRenderingContext2D
): number => {
  const pxMatch = fontCss.match(/(\d+(?:\.\d+)?)px/);
  const fontPx = pxMatch ? Number(pxMatch[1]) : 14;
  const linePx = fontPx * Math.max(1, lineHeight);
  const contentWidthPx = Math.max(1, widthPx - padding.xPx * 2);
  const lines = measureWrappedLines(text, fontCss, contentWidthPx, ctx);
  return padding.yPx * 2 + lines.length * linePx;
};
