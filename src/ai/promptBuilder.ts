import type { Card } from "../model/cardSchema";

export type AiMode = "generate" | "patch";
export type AiInputLanguage = "ALL" | "RU" | "DE" | "EN";
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const CARD_SCHEMA_GUIDE = `{
  "id": "string",
  "inf": "string",
  "freq": "number 1..5",
  "tags": ["string"],
  "tr_1_ru": "string", "tr_1_ctx": "string",
  "tr_2_ru": "string", "tr_2_ctx": "string",
  "tr_3_ru": "string", "tr_3_ctx": "string",
  "tr_4_ru": "string", "tr_4_ctx": "string",
  "forms_p3": "string", "forms_prat": "string", "forms_p2": "string", "forms_aux": "haben|sein|\"\"", "forms_service": "string",
  "syn_1_de": "string", "syn_1_ru": "string",
  "syn_2_de": "string", "syn_2_ru": "string",
  "syn_3_de": "string", "syn_3_ru": "string",
  "ex_1_de": "string", "ex_1_ru": "string", "ex_1_tag": "string",
  "ex_2_de": "string", "ex_2_ru": "string", "ex_2_tag": "string",
  "ex_3_de": "string", "ex_3_ru": "string", "ex_3_tag": "string",
  "ex_4_de": "string", "ex_4_ru": "string", "ex_4_tag": "string",
  "ex_5_de": "string", "ex_5_ru": "string", "ex_5_tag": "string",
  "rek_1_de": "string", "rek_1_ru": "string",
  "rek_2_de": "string", "rek_2_ru": "string",
  "rek_3_de": "string", "rek_3_ru": "string",
  "rek_4_de": "string", "rek_4_ru": "string",
  "rek_5_de": "string", "rek_5_ru": "string"
}`;

const SYSTEM_GENERATE = `You are LingoCard AI. Output ONLY one valid JSON object. No markdown. No comments. No backticks. No extra keys. No text around JSON.\nIf unknown use \"\" or [].\nThe JSON must strictly match this schema:\n${CARD_SCHEMA_GUIDE}`;

const SYSTEM_REPAIR = `You are a JSON repair tool. Output ONLY one valid JSON object. No markdown, comments or extra keys. Keep already-correct values and fix only what is necessary to match schema.`;

const languageHint = (lang: AiInputLanguage) => {
  if (lang === "RU") return "Input language is Russian. Map to the best German infinitive first.";
  if (lang === "DE") return "Input language is German. Keep/normalize the German infinitive.";
  if (lang === "EN") return "Input language is English. Map to the best German infinitive first.";
  return "Input language can be mixed RU/DE/EN. Detect and map to the best German infinitive.";
};

export const buildGenerateMessages = (inputVerb: string, inputLanguage: AiInputLanguage = "ALL"): ChatMessage[] => [
  { role: "system", content: SYSTEM_GENERATE },
  {
    role: "user",
    content:
      `Generate one German verb card for input: \"${inputVerb}\".\n` +
      `${languageHint(inputLanguage)}\n` +
      `Requirements:\n` +
      `- Final inf must be German infinitive.\n` +
      `- id format: auto-{inf} lowercase, spaces removed.\n` +
      `- freq in range 1..5.\n` +
      `- tags must include \"praesens\" and add others only when applicable.\n` +
      `- Provide 3-4 RU translations with contexts (tr_1..tr_4 + ctx).\n` +
      `- Provide forms: forms_p3, forms_prat, forms_p2, forms_aux (haben/sein).\n` +
      `- Provide 3 synonyms (DE+RU).\n` +
      `- Provide examples: ex_1=Praesens, ex_2=Modalverb, ex_3=Praeteritum, ex_4=Perfekt, B2-level DE with RU translation.\n` +
      `- Fill remaining schema keys with \"\" where needed.\n` +
      `Output ONLY the JSON object.`
  }
];

export const buildRepairMessages = (rawContent: string): ChatMessage[] => [
  { role: "system", content: SYSTEM_REPAIR },
  {
    role: "user",
    content:
      `Fix the following RAW output into one valid card JSON object strictly matching schema.\n` +
      `Do not add any text around JSON.\n` +
      `Schema:\n${CARD_SCHEMA_GUIDE}\n\nRAW:\n${rawContent}`
  }
];

export const buildPrompt = (infinitiv: string, mode: AiMode, card?: Card) => {
  if (mode === "patch" && card) {
    return {
      role: "user",
      content: `Patch the following card. Return JSON: {"patch": Partial<Card>, "errors"?: string[]} only. Existing card: ${JSON.stringify(
        card
      )}`
    };
  }
  return {
    role: "user",
    content: `Generate a German verb flashcard for infinitiv "${infinitiv}". Return ONLY valid JSON Card according to schema.`
  };
};
