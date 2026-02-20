import type { CanonicalBox } from "../normalizer/canonicalTypes";

export const DEFAULT_TEMPLATE_BOXES: CanonicalBox[] = [
  { id: "freq", fieldId: "freq", xMm: 4, yMm: 4, wMm: 20, hMm: 7.2, fontPt: 12, lineHeight: 1, autoH: false, reservedRightMm: 0 },
  { id: "meta", fieldId: "meta", xMm: 25.5, yMm: 4, wMm: 60.5, hMm: 10, fontPt: 8.8, lineHeight: 1.18, autoH: true },
  { id: "synonyms", fieldId: "synonyms", xMm: 86.5, yMm: 4, wMm: 59.5, hMm: 18.5, fontPt: 9.8, lineHeight: 1.22, autoH: true },
  { id: "hero_inf", fieldId: "inf", xMm: 4, yMm: 16, wMm: 58, hMm: 14, fontPt: 20, lineHeight: 1.05, autoH: false },
  { id: "forms", fieldId: "forms", xMm: 4, yMm: 32.2, wMm: 142, hMm: 7.8, fontPt: 9.8, lineHeight: 1.15, autoH: true },
  { id: "hero_translations", fieldId: "hero_translations", xMm: 4, yMm: 42.2, wMm: 142, hMm: 10.5, fontPt: 9.8, lineHeight: 1.2, autoH: true },
  { id: "examples", fieldId: "examples", xMm: 4, yMm: 54.4, wMm: 84, hMm: 46.6, fontPt: 8.8, lineHeight: 1.25, autoH: true },
  { id: "recommendations", fieldId: "recommendations", xMm: 90.5, yMm: 74, wMm: 55.5, hMm: 27, fontPt: 8.8, lineHeight: 1.22, autoH: true }
];
