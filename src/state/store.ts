import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Card } from "../model/cardSchema";
import { defaultLayout, type Layout } from "../model/layoutSchema";
import { normalizeCard } from "../model/cardSchema";

export type ListSide = "A" | "B";

export type AppStateSnapshot = {
  cardsA: Card[];
  cardsB: Card[];
  selectedId: string | null;
  selectedSide: ListSide;
  layout: Layout;
};

export type HistoryState = {
  past: AppStateSnapshot[];
  future: AppStateSnapshot[];
};

export type AppState = AppStateSnapshot &
  HistoryState & {
    zoom: number;
    gridEnabled: boolean;
    rulersEnabled: boolean;
    snapEnabled: boolean;
    setZoom: (value: number) => void;
    selectCard: (id: string | null, side: ListSide) => void;
    addCard: (card: Partial<Card>, side: ListSide) => void;
    updateCard: (card: Card, side: ListSide) => void;
    removeCard: (id: string, side: ListSide) => void;
    moveCard: (id: string, from: ListSide) => void;
    setLayout: (layout: Layout) => void;
    pushHistory: () => void;
    undo: () => void;
    redo: () => void;
  };

const HISTORY_LIMIT = 100;

const snapshotState = (state: AppState): AppStateSnapshot => ({
  cardsA: state.cardsA,
  cardsB: state.cardsB,
  selectedId: state.selectedId,
  selectedSide: state.selectedSide,
  layout: state.layout
});

export const useAppStore = create<AppState>()(
  immer((set, get) => ({
    cardsA: [],
    cardsB: [],
    selectedId: null,
    selectedSide: "A",
    layout: defaultLayout,
    past: [],
    future: [],
    zoom: 1,
    gridEnabled: true,
    rulersEnabled: true,
    snapEnabled: true,
    setZoom: (value) => set((state) => {
      state.zoom = Math.min(2, Math.max(0.25, value));
    }),
    selectCard: (id, side) => set((state) => {
      state.selectedId = id;
      state.selectedSide = side;
    }),
    addCard: (card, side) => set((state) => {
      const normalized = normalizeCard(card);
      if (side === "A") {
        state.cardsA.push(normalized);
      } else {
        state.cardsB.push(normalized);
      }
      state.selectedId = normalized.id;
      state.selectedSide = side;
    }),
    updateCard: (card, side) => set((state) => {
      const list = side === "A" ? state.cardsA : state.cardsB;
      const index = list.findIndex((item) => item.id === card.id);
      if (index >= 0) {
        list[index] = card;
      }
    }),
    removeCard: (id, side) => set((state) => {
      const list = side === "A" ? state.cardsA : state.cardsB;
      const index = list.findIndex((item) => item.id === id);
      if (index >= 0) {
        list.splice(index, 1);
      }
      if (state.selectedId === id) {
        state.selectedId = null;
      }
    }),
    moveCard: (id, from) => set((state) => {
      const fromList = from === "A" ? state.cardsA : state.cardsB;
      const toList = from === "A" ? state.cardsB : state.cardsA;
      const index = fromList.findIndex((item) => item.id === id);
      if (index >= 0) {
        const [card] = fromList.splice(index, 1);
        toList.push(card);
        state.selectedId = card.id;
        state.selectedSide = from === "A" ? "B" : "A";
      }
    }),
    setLayout: (layout) => set((state) => {
      state.layout = layout;
    }),
    pushHistory: () => set((state) => {
      state.past.push(snapshotState(get()));
      if (state.past.length > HISTORY_LIMIT) {
        state.past.shift();
      }
      state.future = [];
    }),
    undo: () => set((state) => {
      const previous = state.past.pop();
      if (previous) {
        state.future.unshift(snapshotState(get()));
        state.cardsA = previous.cardsA;
        state.cardsB = previous.cardsB;
        state.selectedId = previous.selectedId;
        state.selectedSide = previous.selectedSide;
        state.layout = previous.layout;
      }
    }),
    redo: () => set((state) => {
      const next = state.future.shift();
      if (next) {
        state.past.push(snapshotState(get()));
        state.cardsA = next.cardsA;
        state.cardsB = next.cardsB;
        state.selectedId = next.selectedId;
        state.selectedSide = next.selectedSide;
        state.layout = next.layout;
      }
    })
  }))
);
