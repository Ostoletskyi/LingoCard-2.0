const normalizeVerb = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zäöüß]/g, "")
    .trim();

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const trigramScore = (word: string) => {
  const grams = new Map<string, number>();
  for (let i = 0; i < Math.max(1, word.length - 2); i += 1) {
    const gram = word.slice(i, i + 3) || word;
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  let acc = 0;
  grams.forEach((count, gram) => {
    acc += hashString(gram) * count;
  });
  return acc >>> 0;
};

export const buildVerbBadgeSvg = (infinitive: string) => {
  const word = normalizeVerb(infinitive) || "verb";
  const base = hashString(word);
  const structure = trigramScore(word);
  const hue = base % 360;
  const hue2 = (hue + (structure % 90) + 30) % 360;
  const sat = 58 + (word.length % 22);
  const light = 56 + (structure % 14);
  const shift = (structure % 18) - 9;

  const bg = `hsl(${hue} ${sat}% ${light}%)`;
  const fg = `hsl(${hue2} ${Math.max(42, sat - 10)}% ${Math.max(30, light - 22)}%)`;
  const ring = `hsl(${(hue + 180) % 360} 45% 34%)`;

  const points = Array.from({ length: 4 }, (_, i) => {
    const seed = hashString(`${word}:${i}`);
    return {
      x: 12 + (seed % 76),
      y: 12 + ((seed >>> 8) % 76)
    };
  });

  const [p0, p1, p2, p3] = points;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="verb-badge">
  <rect x="2" y="2" width="96" height="96" rx="16" fill="${bg}" stroke="${ring}" stroke-width="4" />
  <circle cx="${50 + shift}" cy="${34 + shift / 2}" r="20" fill="${fg}" fill-opacity="0.82" />
  <path d="M16 ${74 - shift} Q50 ${48 + shift}, 84 ${74 - shift}" fill="none" stroke="${ring}" stroke-width="7" stroke-linecap="round" />
  <circle cx="${p0?.x ?? 50}" cy="${p0?.y ?? 50}" r="4" fill="${ring}" fill-opacity="0.55" />
  <circle cx="${p1?.x ?? 50}" cy="${p1?.y ?? 50}" r="3" fill="${ring}" fill-opacity="0.45" />
  <circle cx="${p2?.x ?? 50}" cy="${p2?.y ?? 50}" r="2.5" fill="${ring}" fill-opacity="0.4" />
  <circle cx="${p3?.x ?? 50}" cy="${p3?.y ?? 50}" r="2" fill="${ring}" fill-opacity="0.35" />
</svg>`;
};

export const buildVerbBadgeDataUri = (infinitive: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(buildVerbBadgeSvg(infinitive))}`;
