import type { Card } from "../model/cardSchema";

type FieldTextResult = {
  text: string;
  isPlaceholder: boolean;
};

export const getFieldText = (card: Card | null, fieldId: string): FieldTextResult => {
  if (!card) {
    return { text: `⟪${fieldId}⟫`, isPlaceholder: true };
  }
  if (fieldId === "freq") {
    const count = card.freq ?? 0;
    return { text: "●".repeat(count), isPlaceholder: false };
  }
  if (fieldId === "tags") {
    return {
      text: card.tags.length ? card.tags.join(", ") : "⟪tags⟫",
      isPlaceholder: card.tags.length === 0
    };
  }
  if (Object.prototype.hasOwnProperty.call(card, fieldId)) {
    const value = (card as Record<string, string>)[fieldId];
    if (typeof value === "string" && value.trim().length > 0) {
      return { text: value, isPlaceholder: false };
    }
  }
  return { text: `⟪${fieldId}⟫`, isPlaceholder: true };
};
