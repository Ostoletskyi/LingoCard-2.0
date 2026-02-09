import { CardSchema, normalizeCard, type Card } from "../model/cardSchema";
import { z } from "zod";

export type ImportMode = "skip" | "overwrite" | "keep";

export type ImportErrorLog = {
  timestamp: string;
  fileName?: string;
  size?: number;
  errorCode: "INVALID_JSON" | "INVALID_FORMAT" | "NO_VALID_CARDS";
  humanSummary: string;
  technicalDetails?: string;
  samplePaths?: string[];
};

export type ImportResult = {
  status: "ok" | "warning" | "error";
  cards: Card[];
  warnings: string[];
  errorLog?: ImportErrorLog;
};

export const importCardsFromJson = (text: string, mode: ImportMode = "keep") => {
  const parsed = JSON.parse(text);
  const cards: Card[] = [];
  const payloadCards = Array.isArray(parsed) ? parsed : parsed.cards;
  if (!Array.isArray(payloadCards)) {
    throw new Error("Invalid JSON format");
  }
  const seen = new Map<string, Card>();
  payloadCards.forEach((item) => {
    const normalized = normalizeCard(item);
    CardSchema.parse(normalized);
    const existing = seen.get(normalized.inf);
    if (!existing) {
      seen.set(normalized.inf, normalized);
      cards.push(normalized);
      return;
    }
    if (mode === "overwrite") {
      const index = cards.findIndex((card) => card.inf === normalized.inf);
      if (index >= 0) {
        cards[index] = normalized;
      }
    }
    if (mode === "keep") {
      cards.push(normalized);
    }
  });
  return { cards, meta: Array.isArray(parsed) ? null : parsed.meta };
};

export const validateCardsImport = (
  text: string,
  meta?: { fileName?: string; size?: number }
): ImportResult => {
  try {
    const parsed = JSON.parse(text);
    const payloadCards = Array.isArray(parsed) ? parsed : parsed.cards;
    if (!Array.isArray(payloadCards)) {
      return {
        status: "error",
        cards: [],
        warnings: [],
        errorLog: {
          timestamp: new Date().toISOString(),
          fileName: meta?.fileName,
          size: meta?.size,
          errorCode: "INVALID_FORMAT",
          humanSummary: "JSON валиден, но структура не соответствует формату карточек."
        }
      };
    }
    const cards: Card[] = [];
    const warnings: string[] = [];
    payloadCards.forEach((item, index) => {
      try {
        const normalized = normalizeCard(item);
        CardSchema.parse(normalized);
        cards.push(normalized);
      } catch (error) {
        warnings.push(`Карточка #${index + 1} не прошла валидацию.`);
        if (warnings.length < 5 && error instanceof z.ZodError) {
          warnings.push(...error.errors.map((err) => err.path.join(".")));
        }
      }
    });
    if (!cards.length) {
      return {
        status: "error",
        cards: [],
        warnings,
        errorLog: {
          timestamp: new Date().toISOString(),
          fileName: meta?.fileName,
          size: meta?.size,
          errorCode: "NO_VALID_CARDS",
          humanSummary: "Не найдено валидных карточек в файле.",
          technicalDetails: warnings.join("; ")
        }
      };
    }
    return {
      status: warnings.length ? "warning" : "ok",
      cards,
      warnings
    };
  } catch (error) {
    return {
      status: "error",
      cards: [],
      warnings: [],
      errorLog: {
        timestamp: new Date().toISOString(),
        fileName: meta?.fileName,
        size: meta?.size,
        errorCode: "INVALID_JSON",
        humanSummary: "Файл не является корректным JSON.",
        technicalDetails: error instanceof Error ? error.message : String(error)
      }
    };
  }
};

export const importInfinitivesText = (text: string, limit = 25): Card[] => {
  const list = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
  return list.map((inf) => normalizeCard({ inf }));
};

export const exportCardsToJson = (cards: Card[]): Blob => {
  const json = JSON.stringify({ cards }, null, 2);
  return new Blob([json], { type: "application/json" });
};
