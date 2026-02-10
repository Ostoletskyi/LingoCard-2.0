import type { Card } from "../model/cardSchema";
import type { ListSide } from "../state/store";

export const selectCardById = (
  id: string,
  side: ListSide,
  cardsA: Card[],
  cardsB: Card[]
): Card | null => {
  const list = side === "A" ? cardsA : cardsB;
  return list.find((card) => card.id === id) ?? null;
};
