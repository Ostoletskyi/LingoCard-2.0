import { CardSchema, normalizeCard, type Card } from "../model/cardSchema";

export type ImportMode = "skip" | "overwrite" | "keep";

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
