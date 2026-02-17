const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

const FIELD_ALIASES: Record<string, string> = {
  infinitive: "inf",
  infinitiv: "inf",
  tr1ru: "tr_1_ru",
  tr2ru: "tr_2_ru",
  tr3ru: "tr_3_ru",
  tr4ru: "tr_4_ru",
  tr1ctx: "tr_1_ctx",
  tr2ctx: "tr_2_ctx",
  tr3ctx: "tr_3_ctx",
  tr4ctx: "tr_4_ctx",
  p3: "forms_p3",
  prat: "forms_prat",
  partizip2: "forms_p2",
  aux: "forms_aux",
  frequency: "freq",

  // LingoCard semantic box aliases
  tr: "hero_translations",
  translations: "hero_translations",
  translation: "hero_translations",
  forms: "forms",
  form: "forms",
  syn: "synonyms",
  synonym: "synonyms",
  synonyms: "synonyms",
  ex: "examples",
  examples: "examples",
};

export const normalizeFieldId = (input: string) => {
  const normalized = normalizeToken(input);
  const compact = normalized.replace(/_/g, "");
  return FIELD_ALIASES[normalized] ?? FIELD_ALIASES[compact] ?? normalized;
};
