import type { CanonicalBox } from "../normalizer/canonicalTypes";

export const DEFAULT_TEMPLATE_BOXES: CanonicalBox[] = [
  { id: "hero_inf", fieldId: "inf", xMm: 4, yMm: 4, wMm: 87, hMm: 10, fontPt: 20, lineHeight: 1.05, autoH: false },
  { id: "hero_translations", fieldId: "tr_1_ru", xMm: 4, yMm: 15, wMm: 142, hMm: 9.5, fontPt: 10, lineHeight: 1.2, autoH: true },
  { id: "forms", fieldId: "forms_p3", xMm: 95, yMm: 26, wMm: 51, hMm: 16, fontPt: 12, lineHeight: 1.16, autoH: true },
  { id: "synonyms", fieldId: "syn_1_de", xMm: 95, yMm: 43, wMm: 51, hMm: 15, fontPt: 12, lineHeight: 1.16, autoH: true },
  { id: "examples", fieldId: "ex_1_de", xMm: 4, yMm: 26, wMm: 89, hMm: 24, fontPt: 12, lineHeight: 1.25, autoH: true },
  { id: "freq", fieldId: "freq", xMm: 93, yMm: 4, wMm: 53, hMm: 4.8, fontPt: 12, lineHeight: 1, autoH: false, reservedRightMm: 6.5 },
  { id: "meta", fieldId: "tags", xMm: 93, yMm: 9.4, wMm: 53, hMm: 4.6, fontPt: 8, lineHeight: 1.1, autoH: false },
  { id: "recommendations", fieldId: "rek_1_de", xMm: 4, yMm: 51, wMm: 89, hMm: 50, fontPt: 11, lineHeight: 1.18, autoH: true }
];
