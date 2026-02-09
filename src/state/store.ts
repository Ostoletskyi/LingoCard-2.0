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
  selectedBoxId: string | null;
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
    gridIntensity: "low" | "medium" | "high";
    showOnlyCmLines: boolean;
    debugOverlays: boolean;
    rulersPlacement: "outside" | "inside";
    isExporting: boolean;
    exportStartedAt: number | null;
    exportLabel: string | null;
    selectedBoxId: string | null;
    isEditingLayout: boolean;
    setZoom: (value: number) => void;
    selectCard: (id: string | null, side: ListSide) => void;
    selectBox: (id: string | null) => void;
    addCard: (card: Partial<Card>, side: ListSide) => void;
    updateCard: (card: Card, side: ListSide) => void;
    removeCard: (id: string, side: ListSide) => void;
    moveCard: (id: string, from: ListSide) => void;
    setLayout: (layout: Layout) => void;
    updateBox: (boxId: string, update: Partial<Layout["boxes"][number]>) => void;
    beginLayoutEdit: () => void;
    endLayoutEdit: () => void;
    toggleGrid: () => void;
    toggleRulers: () => void;
    toggleSnap: () => void;
    setGridIntensity: (value: "low" | "medium" | "high") => void;
    toggleOnlyCmLines: () => void;
    toggleDebugOverlays: () => void;
    setRulersPlacement: (value: "outside" | "inside") => void;
    startExport: (label: string) => void;
    finishExport: () => void;
    pushHistory: () => void;
    undo: () => void;
    redo: () => void;
  };

const HISTORY_LIMIT = 100;

const cloneCards = (cards: Card[]) => cards.map((card) => structuredClone(card));

const snapshotState = (state: AppState): AppStateSnapshot => ({
  cardsA: cloneCards(state.cardsA),
  cardsB: cloneCards(state.cardsB),
  selectedId: state.selectedId,
  selectedSide: state.selectedSide,
  layout: structuredClone(state.layout),
  selectedBoxId: state.selectedBoxId
});

const recordHistory = (state: AppState, current: AppState) => {
  state.past.push(snapshotState(current));
  if (state.past.length > HISTORY_LIMIT) {
    state.past.shift();
  }
  state.future = [];
};

const applySnapshot = (state: AppState, snapshot: AppStateSnapshot) => {
  state.cardsA = cloneCards(snapshot.cardsA);
  state.cardsB = cloneCards(snapshot.cardsB);
  state.selectedId = snapshot.selectedId;
  state.selectedSide = snapshot.selectedSide;
  state.layout = structuredClone(snapshot.layout);
  state.selectedBoxId = snapshot.selectedBoxId;
  state.isEditingLayout = false;
};

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
    gridIntensity: "low",
    showOnlyCmLines: false,
    debugOverlays: false,
    rulersPlacement: "outside",
    isExporting: false,
    exportStartedAt: null,
    exportLabel: null,
    selectedBoxId: null,
    isEditingLayout: false,
    setZoom: (value) => set((state) => {
      state.zoom = Math.min(2, Math.max(0.25, value));
    }),
    selectCard: (id, side) => set((state) => {
      state.selectedId = id;
      state.selectedSide = side;
    }),
    selectBox: (id) => set((state) => {
      state.selectedBoxId = id;
    }),
    addCard: (card, side) => set((state) => {
      recordHistory(state, get());
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
      recordHistory(state, get());
      const list = side === "A" ? state.cardsA : state.cardsB;
      const index = list.findIndex((item) => item.id === card.id);
      if (index >= 0) {
        list[index] = card;
      }
    }),
    removeCard: (id, side) => set((state) => {
      recordHistory(state, get());
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
      recordHistory(state, get());
      const fromList = from === "A" ? state.cardsA : state.cardsB;
      const toList = from === "A" ? state.cardsB : state.cardsA;
      const index = fromList.findIndex((item) => item.id === id);
      if (index >= 0) {
        const card = fromList[index];
        if (!card) return;
        fromList.splice(index, 1);
        toList.push(card);
        state.selectedId = card.id;
        state.selectedSide = from === "A" ? "B" : "A";
      }
    }),
    setLayout: (layout) => set((state) => {
      recordHistory(state, get());
      state.layout = layout;
    }),
    updateBox: (boxId, update) => set((state) => {
      if (!state.isEditingLayout) {
        recordHistory(state, get());
        state.isEditingLayout = true;
      }
      const box = state.layout.boxes.find((item) => item.id === boxId);
      if (box) {
        Object.assign(box, update);
      }
    }),
    beginLayoutEdit: () => set((state) => {
      if (!state.isEditingLayout) {
        recordHistory(state, get());
        state.isEditingLayout = true;
      }
    }),
    endLayoutEdit: () => set((state) => {
      state.isEditingLayout = false;
    }),
    toggleGrid: () => set((state) => {
      state.gridEnabled = !state.gridEnabled;
    }),
    toggleRulers: () => set((state) => {
      state.rulersEnabled = !state.rulersEnabled;
    }),
    toggleSnap: () => set((state) => {
      state.snapEnabled = !state.snapEnabled;
    }),
    setGridIntensity: (value) => set((state) => {
      state.gridIntensity = value;
    }),
    toggleOnlyCmLines: () => set((state) => {
      state.showOnlyCmLines = !state.showOnlyCmLines;
    }),
    toggleDebugOverlays: () => set((state) => {
      state.debugOverlays = !state.debugOverlays;
    }),
    setRulersPlacement: (value) => set((state) => {
      state.rulersPlacement = value;
    }),
    startExport: (label) => set((state) => {
      state.isExporting = true;
      state.exportStartedAt = Date.now();
      state.exportLabel = label;
    }),
    finishExport: () => set((state) => {
      state.isExporting = false;
      state.exportStartedAt = null;
      state.exportLabel = null;
    }),
    pushHistory: () => set((state) => {
      recordHistory(state, get());
    }),
    undo: () => set((state) => {
      const previous = state.past.pop();
      if (previous) {
        state.future.unshift(snapshotState(get()));
        applySnapshot(state, previous);
      }
    }),
    redo: () => set((state) => {
      const next = state.future.shift();
      if (next) {
        state.past.push(snapshotState(get()));
        applySnapshot(state, next);
      }
    })
  }))
);
