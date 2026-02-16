export type CanonicalBox = {
  id: string;
  fieldId: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  fontPt?: number;
  lineHeight?: number;
  paddingMm?: number;
  align?: "left" | "center" | "right";
  autoH?: boolean;
  reservedRightMm?: number;
};

export type CanonicalCard = {
  id: string;
  title: string;
  inf: string;
  freq: number | null;
  tags: string[];
  tr: Array<{ value: string; ctx?: string }>;
  forms: { p3?: string; praet?: string; p2?: string; aux?: "haben" | "sein" | "" };
  synonyms: Array<{ de: string; ru?: string }>;
  examples: Array<{ de: string; ru?: string; tag?: string }>;
  recommendations: Array<{ de: string; ru?: string }>;
  boxes: CanonicalBox[];
};
