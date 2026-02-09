import type { Card } from "../model/cardSchema";

export const getCardFieldValue = (card: Card | null, fieldId: string): string => {
  if (!card) return "";
  if (Object.prototype.hasOwnProperty.call(card, fieldId)) {
    const value = (card as Record<string, string>)[fieldId];
    return typeof value === "string" ? value : "";
  }
  return "";
};
