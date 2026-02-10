import { z } from "zod";

const containerSchema = z
  .object({
    cards: z.array(z.unknown())
  })
  .passthrough();

const fullExportSchema = z
  .object({
    version: z.number().optional(),
    kind: z.string().optional(),
    passport: z.unknown().optional(),
    card: z
      .object({
        widthMm: z.number().optional(),
        heightMm: z.number().optional()
      })
      .optional(),
    cards: z.array(z.unknown()),
    verbs: z.array(z.unknown()).optional()
  })
  .passthrough();

export const CardImportFileSchema = z.union([containerSchema, fullExportSchema, z.array(z.unknown())]);

export type CardImportSource = "array" | "cards" | "full";

export type CardImportError = {
  code: "INVALID_ROOT" | "MISSING_CARDS" | "INVALID_CARDS";
  message: string;
  details?: string;
  samplePaths?: string[];
};

export type CardImportParseResult =
  | { ok: true; cards: unknown[]; source: CardImportSource; rootKeys: string[] }
  | { ok: false; error: CardImportError };

export const parseCardImportFile = (data: unknown): CardImportParseResult => {
  if (Array.isArray(data)) {
    return { ok: true, cards: data, source: "array", rootKeys: [] };
  }
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      error: {
        code: "INVALID_ROOT",
        message: "JSON валиден, но верхний уровень должен быть объектом или массивом карточек.",
        details: `Получен тип: ${typeof data}`,
        samplePaths: ["cards"]
      }
    };
  }
  const rootKeys = Object.keys(data);
  if (!("cards" in data)) {
    return {
      ok: false,
      error: {
        code: "MISSING_CARDS",
        message:
          "JSON валиден, но это не файл карточек LingoCard. Ожидали объект с ключом cards или массив карточек.",
        details: `Получены ключи: ${rootKeys.join(", ") || "(пусто)"}`,
        samplePaths: ["cards"]
      }
    };
  }
  const payloadCards = (data as { cards?: unknown }).cards;
  if (!Array.isArray(payloadCards)) {
    return {
      ok: false,
      error: {
        code: "INVALID_CARDS",
        message: "Поле cards должно быть массивом карточек.",
        details: `Получен тип cards: ${typeof payloadCards}`,
        samplePaths: ["cards", "cards[0].id", "cards[0].inf"]
      }
    };
  }
  const hasFullMeta = "version" in data || "kind" in data || "passport" in data || "card" in data;
  return {
    ok: true,
    cards: payloadCards,
    source: hasFullMeta ? "full" : "cards",
    rootKeys
  };
};
