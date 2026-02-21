const DIGRAPHS = ["sch", "ch", "ei", "ie", "au", "eu", "äu"] as const;

type BaseShape = "ring" | "square" | "triangle" | "diamond";
type SuffixMarker = "" | "en" | "ern" | "eln" | "ieren";
type SoundToken = "V" | "H" | "S";

const normalizeGerman = (value: string) =>
  (value || "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zäöü]/g, "");

const baseShapeFromFirstLetter = (word: string): BaseShape => {
  const first = word[0] || "a";
  if (first >= "a" && first <= "f") return "ring";
  if (first >= "g" && first <= "l") return "square";
  if (first >= "m" && first <= "r") return "triangle";
  return "diamond";
};

const suffixMarker = (word: string): SuffixMarker => {
  if (word.endsWith("ieren")) return "ieren";
  if (word.endsWith("eln")) return "eln";
  if (word.endsWith("ern")) return "ern";
  if (word.endsWith("en")) return "en";
  return "";
};

const tokenizeGerman = (word: string): string[] => {
  const out: string[] = [];
  let index = 0;
  while (index < word.length) {
    const digraph = DIGRAPHS.find((part) => word.startsWith(part, index));
    if (digraph) {
      out.push(digraph);
      index += digraph.length;
      continue;
    }
    out.push(word[index]!);
    index += 1;
  }
  return out;
};

const tokensToPattern = (tokens: string[]): SoundToken[] => {
  const vowels = new Set(["a", "e", "i", "o", "u", "ä", "ö", "ü", "ei", "ie", "au", "eu", "äu"]);
  const hard = new Set(["k", "t", "p", "g", "d", "b", "z"]);
  return tokens.map((token) => {
    if (vowels.has(token)) return "V";
    if (hard.has(token)) return "H";
    return "S";
  });
};

const circlePath = (cx: number, cy: number, r: number) =>
  `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`;

const roundedRectPath = (x: number, y: number, w: number, h: number, r: number) => {
  const x2 = x + w;
  const y2 = y + h;
  return `M ${x + r} ${y} L ${x2 - r} ${y} Q ${x2} ${y} ${x2} ${y + r} L ${x2} ${y2 - r} Q ${x2} ${y2} ${x2 - r} ${y2} L ${x + r} ${y2} Q ${x} ${y2} ${x} ${y2 - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
};

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const x0 = cx + Math.cos(a0) * r;
  const y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
};

const buildBasePath = (shape: BaseShape, cx: number, cy: number, r: number) => {
  if (shape === "ring") {
    return circlePath(cx, cy, r);
  }
  if (shape === "square") {
    return roundedRectPath(cx - r, cy - r, r * 2, r * 2, r * 0.22);
  }
  if (shape === "triangle") {
    const p1 = [cx, cy - r];
    const p2 = [cx - r * 0.95, cy + r * 0.85];
    const p3 = [cx + r * 0.95, cy + r * 0.85];
    return `M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} Z`;
  }
  const p1 = [cx, cy - r];
  const p2 = [cx + r, cy];
  const p3 = [cx, cy + r];
  const p4 = [cx - r, cy];
  return `M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} L ${p4[0]} ${p4[1]} Z`;
};

const buildInnerMarks = (pattern: SoundToken[], cx: number, cy: number, r: number, stroke: number) => {
  const count = Math.min(pattern.length, 7);
  const step = (Math.PI * 2) / 7;
  let out = "";

  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + i * step;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const token = pattern[i];

    if (token === "V") {
      out += `<circle cx="${x}" cy="${y}" r="${r * 0.1}" fill="none" stroke="#111827" stroke-width="${stroke * 0.9}"/>`;
      continue;
    }

    if (token === "H") {
      const dx = Math.cos(angle) * r * 0.18;
      const dy = Math.sin(angle) * r * 0.18;
      out += `<path d="M ${x - dx} ${y - dy} L ${x} ${y} L ${x + dy} ${y - dx}" fill="none" stroke="#111827" stroke-width="${stroke * 0.9}" stroke-linecap="round" stroke-linejoin="round"/>`;
      continue;
    }

    out += `<path d="${arcPath(x, y, r * 0.16, angle - 0.9, angle + 0.9)}" fill="none" stroke="#111827" stroke-width="${stroke * 0.9}" stroke-linecap="round"/>`;
  }

  return out;
};

const buildSuffixMarks = (suffix: SuffixMarker, cx: number, cy: number, r: number, stroke: number) => {
  if (!suffix) return "";
  const y = cy + r * 0.98;
  const x = cx;
  const len = r * 0.55;
  let svg = `<path d="M ${x - len / 2} ${y} L ${x + len / 2} ${y}" fill="none" stroke="#111827" stroke-width="${stroke}" stroke-linecap="round"/>`;

  if (suffix === "ern") {
    svg += `<circle cx="${x}" cy="${y + r * 0.18}" r="${r * 0.06}" fill="#111827"/>`;
  } else if (suffix === "eln") {
    svg += `<circle cx="${x - r * 0.1}" cy="${y + r * 0.18}" r="${r * 0.06}" fill="#111827"/>`;
    svg += `<circle cx="${x + r * 0.1}" cy="${y + r * 0.18}" r="${r * 0.06}" fill="#111827"/>`;
  } else if (suffix === "ieren") {
    svg += `<path d="M ${x - len / 2} ${y + r * 0.16} L ${x + len / 2} ${y + r * 0.16}" fill="none" stroke="#111827" stroke-width="${stroke}" stroke-linecap="round"/>`;
  }

  return svg;
};

export const makeVerbGlyphSVG = (infinitive: string, sizePx = 26) => {
  const width = sizePx;
  const height = sizePx;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.42;
  const stroke = 2.2;

  const normalized = normalizeGerman(infinitive);
  const shape = baseShapeFromFirstLetter(normalized);
  const suffix = suffixMarker(normalized);
  const pattern = tokensToPattern(tokenizeGerman(normalized));

  const basePath = buildBasePath(shape, cx, cy, radius);
  const inner = buildInnerMarks(pattern, cx, cy, radius * 0.78, stroke);
  const marks = buildSuffixMarks(suffix, cx, cy, radius, stroke);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <path d="${basePath}" fill="none" stroke="#111827" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
  ${inner}
  ${marks}
</svg>`.trim();
};

export const buildVerbBadgeDataUri = (infinitive: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(makeVerbGlyphSVG(infinitive, 26))}`;
