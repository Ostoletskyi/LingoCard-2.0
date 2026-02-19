import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { current } from "immer";
import type { Card } from "../model/cardSchema";
import { defaultLayout, type Layout } from "../model/layoutSchema";
import { normalizeCard } from "../model/cardSchema";
import { applySemanticLayoutToCard } from "../editor/semanticLayout";
import type { Box } from "../model/layoutSchema";
import { applyLayoutTemplate, extractLayoutTemplate, type LayoutTemplate } from "../editor/layoutTemplate";
import {
  STORAGE_KEY,
  loadPersistedTemplate,
  loadPersistedCards,
  persistCards as persistCardsStorage,
  persistActiveTemplate,
  type PersistedCards
} from "./persistence";
import { BOOKMARK_LIMIT, trackStateEvent } from "./history";
import { syncTemplateToSide } from "./templateOps";
import { autoResizeCardBoxes } from "../editor/autoBoxSize";
import { getPxPerMm } from "../utils/mmPx";
import type { ListSide, AppStateSnapshot, HistoryState, HistoryBookmark, ChangeLogEntry } from "./types";
export type { ListSide, AppStateSnapshot, HistoryState, HistoryBookmark, ChangeLogEntry } from "./types";

type AnyPersistedState = { version?: unknown; state?: unknown };

const migratePersistedState = (raw: AnyPersistedState): PersistedState | null => {
  if (raw?.version === 1 && raw.state && typeof raw.state === "object") {
    const state = raw.state as Record<string, unknown>;
    return {
      version: 1,
      state: {
        ...(state as PersistedState["state"]),
        activeTemplate:
          state.activeTemplate && typeof state.activeTemplate === "object"
            ? (state.activeTemplate as LayoutTemplate)
            : null
      }
    };
  }
  if (typeof raw?.version === "number") {
    console.warn("[Persist][Migration] Unsupported persisted version", raw.version);
  }
  return null;
};

type PersistedState = {
  version: 1;
  state: {
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
    showBlockMetrics: boolean;
    rulersPlacement: "outside" | "inside";
    editModeEnabled: boolean;
    activeTemplate: LayoutTemplate | null;
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
    showBlockMetrics: boolean;
    rulersPlacement: "outside" | "inside";
    isExporting: boolean;
    exportStartedAt: number | null;
    exportLabel: string | null;
    selectedCardIdsA: string[];
    selectedCardIdsB: string[];
    selectedBoxId: string | null;
    isEditingLayout: boolean;
    historyBookmarks: HistoryBookmark[];
    changeLog: ChangeLogEntry[];
    editModeEnabled: boolean;
    activeTemplate: LayoutTemplate | null;
    storageWarning: string | null;
    setZoom: (value: number) => void;
    selectCard: (id: string | null, side: ListSide) => void;
    selectBox: (id: string | null) => void;
    addCard: (card: Partial<Card>, side: ListSide) => void;
    updateCard: (card: Card, side: ListSide, reason?: string) => void;
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
    toggleBlockMetrics: () => void;
    setRulersPlacement: (value: "outside" | "inside") => void;
    startExport: (label: string) => void;
    finishExport: () => void;
    toggleCardSelection: (id: string, side: ListSide) => void;
    selectAllCards: (side: ListSide) => void;
    clearCardSelection: (side: ListSide) => void;
    updateCardSilent: (
      card: Card,
      side: ListSide,
      reason?: string,
      options?: { track?: boolean }
    ) => void;
    autoLayoutAllCards: (side: ListSide) => void;
    adjustColumnFontSizeByField: (side: ListSide, fieldIds: string[], deltaPt: number) => void;
    addBlockToCard: (side: ListSide, cardId: string, kind: "inf" | "freq" | "forms_rek" | "synonyms" | "examples" | "simple") => void;
    removeSelectedBoxFromCard: (side: ListSide, cardId: string) => void;
    updateBoxAcrossColumn: (params: { side: ListSide; boxId: string; update: Partial<Box>; reason?: string }) => void;
    recordEvent: (action: string) => void;
    resetState: () => void;
    pushHistory: () => void;
    jumpToHistoryBookmark: (id: string) => void;
    deleteHistoryBookmark: (id: string) => void;
    undo: () => void;
    redo: () => void;
    toggleEditMode: () => void;
    applyCardFormattingToCards: (params: { side: ListSide; sourceCardId: string; mode: "all" | "selected" }) => void;
    applyAutoHeightToCards: (params: { side: ListSide; mode: "all" | "selected" }) => void;
  };

const createBoxTemplate = (
  kind: "inf" | "freq" | "forms_rek" | "synonyms" | "examples" | "simple",
  currentBoxes: Box[]
): Box => {
  const nextZ = Math.max(0, ...currentBoxes.map((box) => box.z ?? 0)) + 1;
  const offset = (currentBoxes.length % 8) * 2;
  const base: Box = {
    id: `${kind}_${crypto.randomUUID().slice(0, 8)}`,
    xMm: 8 + offset,
    yMm: 8 + offset,
    wMm: 58,
    hMm: 14,
    z: nextZ,
    fieldId: "inf",
    style: {
      fontSizePt: 11,
      fontWeight: "normal",
      align: "left",
      lineHeight: 1.2,
      paddingMm: 1,
      border: false,
      visible: true
    },
    textMode: "dynamic",
    autoH: false,
    label: "Блок"
  };

  if (kind === "inf") {
    return {
      ...base,
      fieldId: "inf",
      wMm: 80,
      hMm: 12,
      style: { ...base.style, fontSizePt: 20, fontWeight: "bold" },
      label: "Инфинитив"
    };
  }
  if (kind === "freq") {
    return {
      ...base,
      fieldId: "freq",
      wMm: 24,
      hMm: 8,
      style: { ...base.style, fontSizePt: 12, fontWeight: "bold" },
      label: "Частотность"
    };
  }
  if (kind === "forms_rek") {
    return {
      ...base,
      fieldId: "forms_rek",
      wMm: 66,
      hMm: 20,
      style: { ...base.style, fontSizePt: 12 },
      autoH: true,
      label: "Три времени + рекция"
    };
  }
  if (kind === "synonyms") {
    return {
      ...base,
      fieldId: "synonyms",
      wMm: 66,
      hMm: 18,
      style: { ...base.style, fontSizePt: 12 },
      autoH: true,
      label: "Синонимы"
    };
  }
  if (kind === "examples") {
    return {
      ...base,
      fieldId: "examples",
      wMm: 92,
      hMm: 30,
      style: { ...base.style, fontSizePt: 12, lineHeight: 1.25 },
      autoH: true,
      label: "Примеры"
    };
  }
  return {
    ...base,
    fieldId: "custom_text",
    wMm: 70,
    hMm: 14,
    textMode: "static",
    autoH: true,
    staticText: "",
    label: "Простой блок"
  };
};

const safeClone = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
};

const cloneCards = (cards: Card[]) => cards.map((card) => safeClone(card));

const ensureUniqueCardIds = (cards: Card[]): Card[] => {
  const used = new Set<string>();
  return cards.map((card) => {
    let id = card.id?.trim() || crypto.randomUUID();
    while (used.has(id)) {
      id = crypto.randomUUID();
    }
    used.add(id);
    if (id === card.id) return card;
    return { ...card, id };
  });
};


const ensureCardsHaveBoxes = (cards: Card[], widthMm: number, heightMm: number): Card[] =>
  cards.map((card) => (card.boxes && card.boxes.length ? card : applySemanticLayoutToCard(card, widthMm, heightMm)));

const ensureCardHasBoxes = (card: Card, widthMm: number, heightMm: number): Card =>
  card.boxes && card.boxes.length ? card : applySemanticLayoutToCard(card, widthMm, heightMm);

const makeDemoCard = (id: string): Card =>
  normalizeCard({
    id,
    inf: "ablehnen",
    freq: 5,
    tags: ["отделяемые: ab-"],
    tr_1_ru: "отклонять",
    tr_1_ctx: "",
    tr_2_ru: "отказываться",
    tr_2_ctx: "",
    tr_3_ru: "не принимать",
    tr_3_ctx: "",
    tr_4_ru: "",
    tr_4_ctx: "",
    forms_p3: "lehnt ab",
    forms_prat: "lehnte ab",
    forms_p2: "abgelehnt",
    forms_aux: "haben",
    forms_service: "ablehnen — lehnt ab — lehnte ab — hat abgelehnt",
    syn_1_de: "zurückweisen",
    syn_1_ru: "отклонять",
    syn_2_de: "verweigern",
    syn_2_ru: "отказывать",
    syn_3_de: "verwerfen",
    syn_3_ru: "отвергать",
    ex_1_de: "Ich lehne das Angebot ab, weil es unvorteilhaft ist.",
    ex_1_ru: "Я отказываюсь от предложения, потому что оно невыгодно.",
    ex_1_tag: "praesens",
    ex_2_de: "Man kann ablehnen, ohne unhöflich zu sein.",
    ex_2_ru: "Можно отказать, не будучи грубым.",
    ex_2_tag: "modal",
    ex_3_de: "Er lehnte jede Diskussion ab.",
    ex_3_ru: "Он отказался от любой дискуссии.",
    ex_3_tag: "praeteritum",
    ex_4_de: "Die Behörde hat den Antrag abgelehnt.",
    ex_4_ru: "Ведомство отклонило заявление.",
    ex_4_tag: "perfekt",
    ex_5_de: "Die Kommission wollte den Vorschlag zunächst ablehnen.",
    ex_5_ru: "Комиссия сначала хотела отклонить предложение.",
    ex_5_tag: "konjunktiv",
    rek_1_de: "zur Debatte zulassen",
    rek_1_ru: "допускать к обсуждению",
    rek_2_de: "konsequent zurückweisen",
    rek_2_ru: "последовательно отклонять",
    rek_3_de: "eine Bitte höflich ablehnen",
    rek_3_ru: "вежливо отказывать в просьбе",
    rek_4_de: "nicht vorschnell verwerfen",
    rek_4_ru: "не отвергать поспешно",
    rek_5_de: "einen Antrag offiziell ablehnen",
    rek_5_ru: "официально отклонять заявление"
  });

const createBaseState = () => ({
  cardsA: [applySemanticLayoutToCard(makeDemoCard("demo-a-ablehnen"), defaultLayout.widthMm, defaultLayout.heightMm)] as Card[],
  cardsB: [applySemanticLayoutToCard(makeDemoCard("demo-b-ablehnen"), defaultLayout.widthMm, defaultLayout.heightMm)] as Card[],
  selectedId: "demo-a-ablehnen" as string | null,
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
  showBlockMetrics: false,
  rulersPlacement: "outside" as const,
  historyBookmarks: [] as HistoryBookmark[],
  changeLog: [] as ChangeLogEntry[],
  editModeEnabled: false,
  activeTemplate: null as LayoutTemplate | null,
  storageWarning: null as string | null
});

const sanitizePersistedState = (raw: PersistedState["state"], persistedCards: PersistedCards | null) => {
  const base = createBaseState();
  const cardsASeed = persistedCards?.cardsA ?? base.cardsA;
  const cardsBSeed = persistedCards?.cardsB ?? base.cardsB;
  const cardsA = ensureUniqueCardIds(cardsASeed.map((card) => normalizeCard(card)).filter(Boolean));
  const cardsB = ensureUniqueCardIds(cardsBSeed.map((card) => normalizeCard(card)).filter(Boolean));
  const selectedId =
    typeof raw.selectedId === "string" && [...cardsA, ...cardsB].some((card) => card.id === raw.selectedId)
      ? raw.selectedId
      : cardsA[0]?.id ?? cardsB[0]?.id ?? null;
  const selectedSide: ListSide = raw.selectedSide === "B" ? "B" : "A";
  const widthMm = Number.isFinite(raw.layout?.widthMm) ? raw.layout.widthMm : base.layout.widthMm;
  const heightMm = Number.isFinite(raw.layout?.heightMm) ? raw.layout.heightMm : base.layout.heightMm;

  const cardsAWithBoxes = ensureCardsHaveBoxes(cardsA, widthMm, heightMm);
  const cardsBWithBoxes = ensureCardsHaveBoxes(cardsB, widthMm, heightMm);

  return {
    cardsA: cardsAWithBoxes,
    cardsB: cardsBWithBoxes,
    selectedId,
    selectedSide,
    layout: {
      widthMm: Math.max(50, Math.min(400, widthMm)),
      heightMm: Math.max(50, Math.min(400, heightMm)),
      boxes: Array.isArray(raw.layout?.boxes) ? raw.layout.boxes : base.layout.boxes
    },
    selectedBoxId: typeof raw.selectedBoxId === "string" ? raw.selectedBoxId : null,
    selectedCardIdsA: Array.isArray(raw.selectedCardIdsA) ? raw.selectedCardIdsA.filter((id) => typeof id === "string") : [],
    selectedCardIdsB: Array.isArray(raw.selectedCardIdsB) ? raw.selectedCardIdsB.filter((id) => typeof id === "string") : [],
    zoom: Number.isFinite(raw.zoom) ? Math.max(0.25, Math.min(2, raw.zoom)) : base.zoom,
    gridEnabled: typeof raw.gridEnabled === "boolean" ? raw.gridEnabled : base.gridEnabled,
    rulersEnabled: typeof raw.rulersEnabled === "boolean" ? raw.rulersEnabled : base.rulersEnabled,
    snapEnabled: typeof raw.snapEnabled === "boolean" ? raw.snapEnabled : base.snapEnabled,
    gridIntensity:
      raw.gridIntensity === "low" || raw.gridIntensity === "medium" || raw.gridIntensity === "high"
        ? raw.gridIntensity
        : base.gridIntensity,
    showOnlyCmLines: typeof raw.showOnlyCmLines === "boolean" ? raw.showOnlyCmLines : base.showOnlyCmLines,
    debugOverlays: typeof raw.debugOverlays === "boolean" ? raw.debugOverlays : base.debugOverlays,
    showBlockMetrics: typeof raw.showBlockMetrics === "boolean" ? raw.showBlockMetrics : base.showBlockMetrics,
    rulersPlacement: (raw.rulersPlacement === "inside" ? "inside" : "outside") as "inside" | "outside",
    historyBookmarks: [],
    changeLog: [],
    editModeEnabled: typeof raw.editModeEnabled === "boolean" ? raw.editModeEnabled : base.editModeEnabled,
    activeTemplate:
      raw.activeTemplate && raw.activeTemplate.version === 1 && Array.isArray(raw.activeTemplate.boxes)
        ? raw.activeTemplate
        : base.activeTemplate,
    storageWarning: null
  };
};

const loadPersistedState = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = migratePersistedState(JSON.parse(raw) as AnyPersistedState);
    if (!parsed) return null;
    return sanitizePersistedState(parsed.state, loadPersistedCards());
  } catch {
    return null;
  }
};

const snapshotState = (state: AppState): AppStateSnapshot => ({
  cardsA: cloneCards(state.cardsA),
  cardsB: cloneCards(state.cardsB),
  selectedId: state.selectedId,
  selectedSide: state.selectedSide,
  layout: safeClone(state.layout),
  selectedBoxId: state.selectedBoxId,
  selectedCardIdsA: [...state.selectedCardIdsA],
  selectedCardIdsB: [...state.selectedCardIdsB]
});

const applySnapshot = (state: AppState, snapshot: AppStateSnapshot) => {
  state.cardsA = cloneCards(snapshot.cardsA);
  state.cardsB = cloneCards(snapshot.cardsB);
  state.selectedId = snapshot.selectedId;
  state.selectedSide = snapshot.selectedSide;
  state.layout = safeClone(snapshot.layout);
  state.selectedBoxId = snapshot.selectedBoxId;
  state.selectedCardIdsA = [...snapshot.selectedCardIdsA];
  state.selectedCardIdsB = [...snapshot.selectedCardIdsB];
  state.isEditingLayout = false;
};

const buildPersistPayload = (state: AppState): PersistedState => ({
  version: 1,
  state: {
    selectedId: state.selectedId,
    selectedSide: state.selectedSide,
    layout: safeClone(state.layout),
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
    showBlockMetrics: state.showBlockMetrics,
    rulersPlacement: state.rulersPlacement,
    editModeEnabled: state.editModeEnabled,
    activeTemplate: state.activeTemplate ? safeClone(state.activeTemplate) : null
  }
});

const setStorageWarning = (message: string | null) => {
  if (typeof window === "undefined") return;
  const currentWarning = useAppStore.getState().storageWarning;
  if (currentWarning === message) return;
  useAppStore.setState({ storageWarning: message });
};

const persistState = (state: AppState) => {
  if (typeof window === "undefined") return;
  let failed = false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistPayload(state)));
  } catch (error) {
    failed = true;
    console.warn("[Persist][Quota] fallback to compact/chunks", error);
  }

  try {
    persistCardsStorage(state.cardsA, state.cardsB);
  } catch (error) {
    failed = true;
    console.warn("[Persist][Quota] fallback to compact/chunks", error);
  }

  if (failed) {
    setStorageWarning("Storage full: изменения сохраняются только в RAM. Освободите место в браузере.");
  } else {
    setStorageWarning(null);
  }
};

const persisted = loadPersistedState();
const baseState = createBaseState();
const initialState = persisted ? { ...baseState, ...persisted } : baseState;
const initialTemplate = loadPersistedTemplate();
if (!initialState.activeTemplate && initialTemplate) {
  initialState.activeTemplate = initialTemplate;
}

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
    showBlockMetrics: initialState.showBlockMetrics,
    rulersPlacement: initialState.rulersPlacement,
    historyBookmarks: initialState.historyBookmarks ?? [],
    changeLog: initialState.changeLog ?? [],
    editModeEnabled: initialState.editModeEnabled,
    activeTemplate: initialState.activeTemplate,
    storageWarning: initialState.storageWarning,
    isExporting: false,
    exportStartedAt: null,
    exportLabel: null,
    selectedCardIdsA: initialState.selectedCardIdsA,
    selectedCardIdsB: initialState.selectedCardIdsB,
    selectedBoxId: initialState.selectedBoxId,
    isEditingLayout: false,
    setZoom: (value) => set((state) => {
      trackStateEvent(state, snapshotState(get()), "setZoom");
      state.zoom = Math.min(2, Math.max(0.25, value));
    }),
    selectCard: (id, side) => set((state) => {
      trackStateEvent(state, snapshotState(get()), `selectCard:${side}:${id ?? "none"}`, { undoable: false });
      state.selectedId = id;
      state.selectedSide = side;
      if (!id || !state.activeTemplate) return;
      const list = side === "A" ? state.cardsA : state.cardsB;
      const index = list.findIndex((item) => item.id === id);
      if (index < 0) return;
      const card = list[index];
      if (!card) return;
      list[index] = autoResizeCardBoxes(applyLayoutTemplate(card, state.activeTemplate, { preserveContent: true }), getPxPerMm(1));
    }),
    selectBox: (id) => set((state) => {
      trackStateEvent(state, snapshotState(get()), `selectBox:${id ?? "none"}`, { undoable: false });
      state.selectedBoxId = id;
    }),
    addCard: (card, side) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), `addCard:${side}`);
      const normalizedBase = normalizeCard(card);
      const target = side === "A" ? state.cardsA : state.cardsB;
      let nextId = normalizedBase.id;
      while (target.some((item) => item.id === nextId)) {
        nextId = crypto.randomUUID();
      }
      const normalized = nextId === normalizedBase.id ? normalizedBase : { ...normalizedBase, id: nextId };
      const finalized = autoResizeCardBoxes(
        ensureCardHasBoxes(normalized, state.layout.widthMm, state.layout.heightMm),
        getPxPerMm(1)
      );
      target.push(finalized);
      state.selectedId = finalized.id;
      state.selectedSide = side;
    }),
    updateCard: (card, side, reason) => set((state) => {
      const allowReadOnlyCommit = typeof reason === "string" && reason.startsWith("textEdit:");
      if (!state.editModeEnabled && !allowReadOnlyCommit) return;
      trackStateEvent(state, snapshotState(get()), reason ?? `updateCard:${side}:${card.id}`);
      const list = side === "A" ? state.cardsA : state.cardsB;
      const index = list.findIndex((item) => item.id === card.id);
      if (index >= 0) {
        list[index] = ensureCardHasBoxes(card, state.layout.widthMm, state.layout.heightMm);
        if (state.selectedId === card.id && state.selectedSide === side) {
          syncTemplateToSide(state, side, list[index]);
        }
      }
    }),
    updateCardSilent: (card, side, reason, options) => set((state) => {
      // Text edits can be committed when edit-mode is being turned off.
      // Without this, the UI may show changes while editing, but they are lost
      // as soon as the user exits the green "editing" state.
      const allowReadOnlyCommit = typeof reason === "string" && reason.startsWith("textEdit");
      if (!state.editModeEnabled && !allowReadOnlyCommit) return;
      const track = options?.track ?? true;
      if (track) {
        trackStateEvent(state, snapshotState(get()), reason ?? `updateCardSilent:${side}:${card.id}`);
      }
      const list = side === "A" ? state.cardsA : state.cardsB;
      const index = list.findIndex((item) => item.id === card.id);
      if (index >= 0) {
        list[index] = ensureCardHasBoxes(card, state.layout.widthMm, state.layout.heightMm);
        if (state.selectedId === card.id && state.selectedSide === side) {
          syncTemplateToSide(state, side, list[index]);
        }
      }
    }),
    removeCard: (id, side) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), `removeCard:${side}`);
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
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), `moveCard:${from}`);
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
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), "setLayout");
      state.layout = layout;
    }),
    setCardSizeMm: (widthMm, heightMm) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), "setCardSizeMm");
      state.layout.widthMm = Math.min(400, Math.max(50, widthMm));
      state.layout.heightMm = Math.min(400, Math.max(50, heightMm));
    }),
    updateBox: (boxId, update) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), `updateBox:${boxId}`);
      state.isEditingLayout = true;
      const box = state.layout.boxes.find((item) => item.id === boxId);
      if (box) {
        Object.assign(box, update);
      }
    }),
    beginLayoutEdit: () => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), "beginLayoutEdit");
      state.isEditingLayout = true;
    }),
    endLayoutEdit: () => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), "endLayoutEdit");
      state.isEditingLayout = false;
    }),
    toggleGrid: () => set((state) => {
      trackStateEvent(state, snapshotState(get()), "toggleGrid");
      state.gridEnabled = !state.gridEnabled;
    }),
    toggleRulers: () => set((state) => {
      trackStateEvent(state, snapshotState(get()), "toggleRulers");
      state.rulersEnabled = !state.rulersEnabled;
    }),
    toggleSnap: () => set((state) => {
      trackStateEvent(state, snapshotState(get()), "toggleSnap");
      state.snapEnabled = !state.snapEnabled;
    }),
    setGridIntensity: (value) => set((state) => {
      trackStateEvent(state, snapshotState(get()), `setGridIntensity:${value}`);
      state.gridIntensity = value;
    }),
    toggleOnlyCmLines: () => set((state) => {
      trackStateEvent(state, snapshotState(get()), "toggleOnlyCmLines");
      state.showOnlyCmLines = !state.showOnlyCmLines;
    }),
    toggleDebugOverlays: () => set((state) => {
      trackStateEvent(state, snapshotState(get()), "toggleDebugOverlays");
      state.debugOverlays = !state.debugOverlays;
    }),
    toggleBlockMetrics: () => set((state) => {
      trackStateEvent(state, snapshotState(get()), "toggleBlockMetrics", { undoable: false });
      state.showBlockMetrics = !state.showBlockMetrics;
    }),
    setRulersPlacement: (value) => set((state) => {
      trackStateEvent(state, snapshotState(get()), `setRulersPlacement:${value}`);
      state.rulersPlacement = value;
    }),
    startExport: (label) => set((state) => {
      trackStateEvent(state, snapshotState(get()), `startExport:${label}`, { undoable: false });
      state.isExporting = true;
      state.exportStartedAt = Date.now();
      state.exportLabel = label;
    }),
    finishExport: () => set((state) => {
      trackStateEvent(state, snapshotState(get()), "finishExport", { undoable: false });
      state.isExporting = false;
      state.exportStartedAt = null;
      state.exportLabel = null;
    }),
    toggleCardSelection: (id, side) => set((state) => {
      trackStateEvent(state, snapshotState(get()), `toggleCardSelection:${side}:${id}`);
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
      trackStateEvent(state, snapshotState(get()), `selectAllCards:${side}`);
      const source = side === "A" ? state.cardsA : state.cardsB;
      const next = source.map((card) => card.id);
      if (side === "A") {
        state.selectedCardIdsA = next;
      } else {
        state.selectedCardIdsB = next;
      }
    }),
    clearCardSelection: (side) => set((state) => {
      trackStateEvent(state, snapshotState(get()), `clearCardSelection:${side}`);
      if (side === "A") {
        state.selectedCardIdsA = [];
      } else {
        state.selectedCardIdsB = [];
      }
    }),
    autoLayoutAllCards: (side) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), `autoLayoutAllCards:${side}`);
      const source = side === "A" ? state.cardsA : state.cardsB;
      const next = source.map((card) => applySemanticLayoutToCard(card, state.layout.widthMm, state.layout.heightMm));
      if (side === "A") {
        state.cardsA = next;
      } else {
        state.cardsB = next;
      }

      const templateSource =
        (state.selectedSide === side && state.selectedId
          ? next.find((card) => card.id === state.selectedId)
          : null) ?? next[0];

      if (templateSource) {
        state.activeTemplate = extractLayoutTemplate(templateSource, {
          widthMm: state.layout.widthMm,
          heightMm: state.layout.heightMm
        });
      }
    }),
    adjustColumnFontSizeByField: (side, fieldIds, deltaPt) => set((state) => {
      if (!state.editModeEnabled) return;
      const pxPerMm = getPxPerMm(1);
      const source = side === "A" ? state.cardsA : state.cardsB;
      const targetSet = new Set(fieldIds);
      if (!targetSet.size) {
        return;
      }
      const hasAnyTarget = source.some((card) => {
        const boxes = card.boxes?.length
          ? card.boxes
          : applySemanticLayoutToCard(card, state.layout.widthMm, state.layout.heightMm).boxes;
        return (boxes ?? []).some((box) => targetSet.has(box.fieldId));
      });
      if (!hasAnyTarget) {
        return;
      }
      trackStateEvent(state, snapshotState(get()), `adjustColumnFontSizeByField:${side}`);
      const next = source.map((card) => {
        const baseCard = card.boxes?.length
          ? card
          : applySemanticLayoutToCard(card, state.layout.widthMm, state.layout.heightMm);
        if (!baseCard.boxes?.length) {
          return baseCard;
        }
        const resized = {
          ...baseCard,
          boxes: baseCard.boxes.map((box) => {
            if (!targetSet.has(box.fieldId)) {
              return box;
            }
            return {
              ...box,
              style: {
                ...box.style,
                fontSizePt: Math.min(36, Math.max(5, box.style.fontSizePt + deltaPt))
              }
            };
          })
        };
        return autoResizeCardBoxes(resized, pxPerMm);
      });
      const templateSource =
        state.selectedSide === side && state.selectedId
          ? next.find((card) => card.id === state.selectedId)
          : next[0];
      if (templateSource) {
        state.activeTemplate = extractLayoutTemplate(templateSource, {
          widthMm: state.layout.widthMm,
          heightMm: state.layout.heightMm
        });
        persistActiveTemplate(state.activeTemplate);
      }
      if (side === "A") {
        state.cardsA = next;
      } else {
        state.cardsB = next;
      }
    }),
    updateBoxAcrossColumn: ({ side, boxId, update, reason }) => set((state) => {
      if (!state.editModeEnabled) return;
      const list = side === "A" ? state.cardsA : state.cardsB;
      let changed = false;
      const next = list.map((card) => {
        if (!card.boxes?.length) {
          return card;
        }
        const target = card.boxes.find((box) => box.id === boxId);
        if (!target) {
          return card;
        }
        const hasChanges = Object.entries(update).some(([key, value]) => target[key as keyof Box] !== value);
        if (!hasChanges) {
          return card;
        }
        changed = true;
        return {
          ...card,
          boxes: card.boxes.map((box) => (box.id === boxId ? { ...box, ...update } : box))
        };
      });
      if (!changed) return;

      const sourceCandidate =
        state.selectedSide === side && state.selectedId
          ? next.find((card) => card.id === state.selectedId)
          : undefined;
      const templateSource = sourceCandidate ?? next.find((card) => card.boxes?.some((box) => box.id === boxId));
      if (templateSource) {
        state.activeTemplate = extractLayoutTemplate(templateSource, {
          widthMm: state.layout.widthMm,
          heightMm: state.layout.heightMm
        });
        persistActiveTemplate(state.activeTemplate);
      }

      if (side === "A") {
        state.cardsA = next;
      } else {
        state.cardsB = next;
      }
      if (reason) {
        trackStateEvent(state, snapshotState(get()), reason);
      }
    }),
    addBlockToCard: (side, cardId, kind) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), `addBlockToCard:${side}:${kind}`);
      const list = side === "A" ? state.cardsA : state.cardsB;
      const index = list.findIndex((card) => card.id === cardId);
      if (index < 0) return;
      const current = list[index];
      if (!current) return;
      const prepared = current.boxes?.length
        ? current
        : applySemanticLayoutToCard(current, state.layout.widthMm, state.layout.heightMm);
      const boxes = prepared.boxes ?? [];
      const nextBox = createBoxTemplate(kind, boxes);
      list[index] = { ...prepared, boxes: [...boxes, nextBox] };
      state.selectedBoxId = nextBox.id;
    }),
    removeSelectedBoxFromCard: (side, cardId) => set((state) => {
      if (!state.editModeEnabled || !state.selectedBoxId) return;
      const selectedBoxId = state.selectedBoxId;
      const list = side === "A" ? state.cardsA : state.cardsB;
      const sourceIndex = list.findIndex((card) => card.id === cardId);
      if (sourceIndex < 0) return;
      const sourceCard = list[sourceIndex];
      if (!sourceCard) return;

      const preparedSource = ensureCardHasBoxes(sourceCard, state.layout.widthMm, state.layout.heightMm);
      if (!preparedSource.boxes?.length) return;
      const hasSelectedOnSource = preparedSource.boxes.some((box) => box.id === selectedBoxId);
      if (!hasSelectedOnSource) return;

      const nextSource = {
        ...preparedSource,
        boxes: preparedSource.boxes.filter((box) => box.id !== selectedBoxId)
      };

      const template = extractLayoutTemplate(nextSource, {
        widthMm: state.layout.widthMm,
        heightMm: state.layout.heightMm
      });
      state.activeTemplate = template;
      persistActiveTemplate(template);

      trackStateEvent(state, snapshotState(get()), `removeBox:${side}:${selectedBoxId}:column`);
      const pxPerMm = getPxPerMm(1);
      const nextList = list.map((card) => {
        const base = ensureCardHasBoxes(card, state.layout.widthMm, state.layout.heightMm);
        if (card.id === cardId) {
          return autoResizeCardBoxes(nextSource, pxPerMm);
        }
        return autoResizeCardBoxes(
          applyLayoutTemplate(base, template, { preserveContent: true, pruneUntouched: true }),
          pxPerMm
        );
      });

      if (side === "A") {
        state.cardsA = nextList;
      } else {
        state.cardsB = nextList;
      }
      state.selectedBoxId = null;
    }),
    recordEvent: (action) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), action, { undoable: false });
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
      state.showBlockMetrics = next.showBlockMetrics;
      state.rulersPlacement = next.rulersPlacement;
      state.past = [];
      state.future = [];
      state.historyBookmarks = [];
      state.changeLog = [];
      state.isEditingLayout = false;
      state.editModeEnabled = next.editModeEnabled;
    }),
    pushHistory: () => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), "pushHistorySnapshot");
      const createdAt = new Date().toISOString();
      state.historyBookmarks.push({
        id: crypto.randomUUID(),
        createdAt,
        action: "manualSnapshot",
        snapshot: snapshotState(get())
      });
      if (state.historyBookmarks.length > BOOKMARK_LIMIT) {
        state.historyBookmarks.shift();
      }
    }),
    jumpToHistoryBookmark: (id) => set((state) => {
      if (!state.editModeEnabled) return;
      const target = state.historyBookmarks.find((bookmark) => bookmark.id === id);
      if (!target) {
        return;
      }
      trackStateEvent(state, snapshotState(get()), `jumpToHistoryBookmark:${id}`);
      applySnapshot(state, target.snapshot);
    }),
    deleteHistoryBookmark: (id) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, snapshotState(get()), `deleteHistoryBookmark:${id}`);
      const before = state.historyBookmarks.length;
      state.historyBookmarks = state.historyBookmarks.filter((bookmark) => bookmark.id !== id);
      if (state.historyBookmarks.length === before) return;
    }),
    undo: () => set((state) => {
      if (!state.editModeEnabled) return;
      const previous = state.past.pop();
      if (previous) {
        state.future.unshift(snapshotState(get()));
        applySnapshot(state, previous);
        state.changeLog.push({ id: crypto.randomUUID(), at: new Date().toISOString(), action: "undo" });
        if (state.changeLog.length > 50) state.changeLog.shift();
      }
    }),
    redo: () => set((state) => {
      if (!state.editModeEnabled) return;
      const next = state.future.shift();
      if (next) {
        state.past.push(snapshotState(get()));
        applySnapshot(state, next);
        state.changeLog.push({ id: crypto.randomUUID(), at: new Date().toISOString(), action: "redo" });
        if (state.changeLog.length > 50) state.changeLog.shift();
      }
    }),
    toggleEditMode: () => set((state) => {
      state.editModeEnabled = !state.editModeEnabled;
      trackStateEvent(state, snapshotState(get()), `toggleEditMode:${state.editModeEnabled ? "on" : "off"}`, { undoable: false });
    }),
    applyCardFormattingToCards: ({ side, sourceCardId, mode }) => set((state) => {
      if (!state.editModeEnabled) return;
      const list = side === "A" ? state.cardsA : state.cardsB;
      const source = list.find((card) => card.id === sourceCardId);
      if (!source) return;
      let template;
      try {
        const plainSource = current(source);
        template = extractLayoutTemplate(plainSource, {
          widthMm: state.layout.widthMm,
          heightMm: state.layout.heightMm
        });
      } catch (error) {
        console.error("Template contains non-serializable data", error);
        return;
      }
      state.activeTemplate = template;
      persistActiveTemplate(template);

      const selected = side === "A" ? state.selectedCardIdsA : state.selectedCardIdsB;
      const selectedSet = new Set(selected);
      trackStateEvent(state, snapshotState(get()), `applyCardFormattingToCards:${side}:${mode}`);

      const nextList = list.map((card) => {
        const shouldApply = mode === "all" ? card.id !== sourceCardId : selectedSet.has(card.id) && card.id !== sourceCardId;
        if (!shouldApply) return card;
        return autoResizeCardBoxes(applyLayoutTemplate(card, template, { preserveContent: true }), getPxPerMm(1));
      });
      if (side === "A") {
        state.cardsA = nextList;
      } else {
        state.cardsB = nextList;
      }
    }),
    applyAutoHeightToCards: ({ side, mode }) => set((state) => {
      if (!state.editModeEnabled) return;
      const source = side === "A" ? state.cardsA : state.cardsB;
      const selected = side === "A" ? state.selectedCardIdsA : state.selectedCardIdsB;
      const selectedSet = new Set(selected);
      const pxPerMm = getPxPerMm(1);
      trackStateEvent(state, snapshotState(get()), `applyAutoHeightToCards:${side}:${mode}`);
      const next = source.map((card) => {
        const shouldApply = mode === "all" ? true : selectedSet.has(card.id);
        if (!shouldApply) return card;
        return autoResizeCardBoxes(card, pxPerMm);
      });
      const templateSource =
        state.selectedSide === side && state.selectedId
          ? next.find((card) => card.id === state.selectedId)
          : next[0];
      if (templateSource) {
        state.activeTemplate = extractLayoutTemplate(templateSource, {
          widthMm: state.layout.widthMm,
          heightMm: state.layout.heightMm
        });
        persistActiveTemplate(state.activeTemplate);
      }
      if (side === "A") {
        state.cardsA = next;
      } else {
        state.cardsB = next;
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
    }, 600);
  });
}
