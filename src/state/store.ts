import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Card } from "../model/cardSchema";
import { defaultLayout, type Layout } from "../model/layoutSchema";
import { normalizeCard } from "../model/cardSchema";
import { applySemanticLayoutToCard } from "../editor/semanticLayout";

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

type PersistedState = {
  version: 1;
  state: {
    cardsA: Card[];
    cardsB: Card[];
    selectedId: string | null;
    selectedSide: ListSide;
    layout: Layout;
    selectedBoxId: string | null;
    selectedCardIdsA: string[];
    selectedCardIdsB: string[];
    zoom: number;
    gridEnabled: boolean;
    rulersEnabled: boolean;
    snapEnabled: boolean;
    gridIntensity: "low" | "medium" | "high";
    showOnlyCmLines: boolean;
    debugOverlays: boolean;
    rulersPlacement: "outside" | "inside";
  };
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
    selectedCardIdsA: string[];
    selectedCardIdsB: string[];
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
    setCardSizeMm: (widthMm: number, heightMm: number) => void;
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
    toggleCardSelection: (id: string, side: ListSide) => void;
    selectAllCards: (side: ListSide) => void;
    clearCardSelection: (side: ListSide) => void;
    updateCardSilent: (card: Card, side: ListSide) => void;
    autoLayoutAllCards: (side: ListSide) => void;
    resetState: () => void;
    pushHistory: () => void;
    undo: () => void;
    redo: () => void;
  };

const HISTORY_LIMIT = 100;
const STORAGE_KEY = "lc_state_v1";

const cloneCards = (cards: Card[]) => cards.map((card) => structuredClone(card));

const createBaseState = () => ({
  cardsA: [] as Card[],
  cardsB: [] as Card[],
  selectedId: null as string | null,
  selectedSide: "A" as ListSide,
  layout: structuredClone(defaultLayout),
  selectedBoxId: null as string | null,
  selectedCardIdsA: [] as string[],
  selectedCardIdsB: [] as string[],
  zoom: 1,
  gridEnabled: true,
  rulersEnabled: true,
  snapEnabled: true,
  gridIntensity: "low" as const,
  showOnlyCmLines: false,
  debugOverlays: false,
  rulersPlacement: "outside" as const
});

const loadPersistedState = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed?.version !== 1 || !parsed.state) return null;
    return parsed.state;
  } catch {
    return null;
  }
};

const snapshotState = (state: AppState): AppStateSnapshot => ({
  cardsA: cloneCards(state.cardsA),
  cardsB: cloneCards(state.cardsB),
  selectedId: state.selectedId,
  selectedSide: state.selectedSide,
  layout: structuredClone(state.layout),
  selectedBoxId: state.selectedBoxId,
  selectedCardIdsA: [...state.selectedCardIdsA],
  selectedCardIdsB: [...state.selectedCardIdsB]
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
  state.selectedCardIdsA = [...snapshot.selectedCardIdsA];
  state.selectedCardIdsB = [...snapshot.selectedCardIdsB];
  state.isEditingLayout = false;
};

const persistState = (state: AppState) => {
  if (typeof window === "undefined") return;
  const payload: PersistedState = {
    version: 1,
    state: {
      cardsA: cloneCards(state.cardsA),
      cardsB: cloneCards(state.cardsB),
      selectedId: state.selectedId,
      selectedSide: state.selectedSide,
      layout: structuredClone(state.layout),
      selectedBoxId: state.selectedBoxId,
      selectedCardIdsA: [...state.selectedCardIdsA],
      selectedCardIdsB: [...state.selectedCardIdsB],
      zoom: state.zoom,
      gridEnabled: state.gridEnabled,
      rulersEnabled: state.rulersEnabled,
      snapEnabled: state.snapEnabled,
      gridIntensity: state.gridIntensity,
      showOnlyCmLines: state.showOnlyCmLines,
      debugOverlays: state.debugOverlays,
      rulersPlacement: state.rulersPlacement
    }
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const persisted = loadPersistedState();
const baseState = createBaseState();
const initialState = persisted ? { ...baseState, ...persisted } : baseState;

export const useAppStore = create<AppState>()(
  immer((set, get) => ({
    cardsA: initialState.cardsA,
    cardsB: initialState.cardsB,
    selectedId: initialState.selectedId,
    selectedSide: initialState.selectedSide,
    layout: initialState.layout,
    past: [],
    future: [],
    zoom: initialState.zoom,
    gridEnabled: initialState.gridEnabled,
    rulersEnabled: initialState.rulersEnabled,
    snapEnabled: initialState.snapEnabled,
    gridIntensity: initialState.gridIntensity,
    showOnlyCmLines: initialState.showOnlyCmLines,
    debugOverlays: initialState.debugOverlays,
    rulersPlacement: initialState.rulersPlacement,
    isExporting: false,
    exportStartedAt: null,
    exportLabel: null,
    selectedCardIdsA: initialState.selectedCardIdsA,
    selectedCardIdsB: initialState.selectedCardIdsB,
    selectedBoxId: initialState.selectedBoxId,
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
    updateCardSilent: (card, side) => set((state) => {
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
    setCardSizeMm: (widthMm, heightMm) => set((state) => {
      recordHistory(state, get());
      state.layout.widthMm = Math.min(400, Math.max(50, widthMm));
      state.layout.heightMm = Math.min(400, Math.max(50, heightMm));
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
    toggleCardSelection: (id, side) => set((state) => {
      const list = side === "A" ? state.selectedCardIdsA : state.selectedCardIdsB;
      const next = new Set(list);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (side === "A") {
        state.selectedCardIdsA = Array.from(next);
      } else {
        state.selectedCardIdsB = Array.from(next);
      }
    }),
    selectAllCards: (side) => set((state) => {
      const source = side === "A" ? state.cardsA : state.cardsB;
      const next = source.map((card) => card.id);
      if (side === "A") {
        state.selectedCardIdsA = next;
      } else {
        state.selectedCardIdsB = next;
      }
    }),
    clearCardSelection: (side) => set((state) => {
      if (side === "A") {
        state.selectedCardIdsA = [];
      } else {
        state.selectedCardIdsB = [];
      }
    }),
    autoLayoutAllCards: (side) => set((state) => {
      recordHistory(state, get());
      const source = side === "A" ? state.cardsA : state.cardsB;
      const next = source.map((card) => applySemanticLayoutToCard(card, state.layout.widthMm, state.layout.heightMm));
      if (side === "A") {
        state.cardsA = next;
      } else {
        state.cardsB = next;
      }
    }),
    resetState: () => set((state) => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      const next = createBaseState();
      state.cardsA = next.cardsA;
      state.cardsB = next.cardsB;
      state.selectedId = next.selectedId;
      state.selectedSide = next.selectedSide;
      state.layout = next.layout;
      state.selectedBoxId = next.selectedBoxId;
      state.selectedCardIdsA = next.selectedCardIdsA;
      state.selectedCardIdsB = next.selectedCardIdsB;
      state.zoom = next.zoom;
      state.gridEnabled = next.gridEnabled;
      state.rulersEnabled = next.rulersEnabled;
      state.snapEnabled = next.snapEnabled;
      state.gridIntensity = next.gridIntensity;
      state.showOnlyCmLines = next.showOnlyCmLines;
      state.debugOverlays = next.debugOverlays;
      state.rulersPlacement = next.rulersPlacement;
      state.past = [];
      state.future = [];
      state.isEditingLayout = false;
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

if (typeof window !== "undefined") {
  let persistTimer: number | null = null;
  useAppStore.subscribe((state) => {
    if (persistTimer) {
      window.clearTimeout(persistTimer);
    }
    persistTimer = window.setTimeout(() => {
      persistState(state);
    }, 150);
  });
}
