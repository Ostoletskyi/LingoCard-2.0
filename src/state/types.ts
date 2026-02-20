import type { Card } from "../model/cardSchema";
import type { Layout } from "../model/layoutSchema";

export type ListSide = "A" | "B";

export type AppStateSnapshot = {
  cardsA: Card[];
  cardsB: Card[];
  selectedId: string | null;
  selectedSide: ListSide;
  layout: Layout;
  selectedBoxId: string | null;
  selectedCardIdsA: string[];
  selectedCardIdsB: string[];
};

export type HistoryState = {
  past: AppStateSnapshot[];
  future: AppStateSnapshot[];
};

export type HistoryBookmark = {
  id: string;
  createdAt: string;
  action: string;
  snapshot: AppStateSnapshot;
};

export type ChangeLogEntry = {
  id: string;
  at: string;
  action: string;
};
