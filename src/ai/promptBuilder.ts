import type { Card } from "../model/cardSchema";

export type AiMode = "generate" | "patch";
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
  "forms_p3": "string", "forms_prat": "string", "forms_p2": "string", "forms_aux": "string",
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

const SYSTEM_GENERATE = `You are LingoCard AI. Output ONLY valid JSON. No markdown. No comments. No extra keys. Do not wrap in backticks. If unknown, use empty string \"\" or empty array [].\nReturn exactly ONE card object strictly matching this schema:\n${CARD_SCHEMA_GUIDE}`;

const SYSTEM_REPAIR = `You are a JSON repair tool. Output ONLY valid JSON object. No markdown. No comments. No extra keys. Keep all correct values and only fix what is required to match the schema exactly. Unknown -> \"\" or [].`;

export const buildGenerateMessages = (infinitive: string): ChatMessage[] => [
  { role: "system", content: SYSTEM_GENERATE },
  {
    role: "user",
    content:
      `Generate a German verb card for infinitive: \"${infinitive}\".\n` +
      `Constraints:\n` +
      `- German examples must be natural, B1-B2.\n` +
      `- Russian translations must be accurate.\n` +
      `- forms_aux must be \"haben\" or \"sein\".\n` +
      `- id format: \"auto-{inf}\" (lowercase, spaces removed).\n` +
      `- tags must include \"praesens\" if applicable.\n` +
      `Output ONLY one JSON object.`
  }
];

export const buildRepairMessages = (rawContent: string): ChatMessage[] => [
  { role: "system", content: SYSTEM_REPAIR },
  {
    role: "user",
    content:
      `Fix this into a valid single-card JSON object strictly matching schema.\n` +
      `Do not add text around JSON.\n` +
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
