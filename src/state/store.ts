import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { current } from "immer";
import type { Card } from "../model/cardSchema";
import { defaultLayout, type Layout } from "../model/layoutSchema";
import { normalizeCard } from "../model/cardSchema";
import { applySemanticLayoutToCard } from "../editor/semanticLayout";
import type { Box } from "../model/layoutSchema";
import { applyLayoutTemplate, extractLayoutTemplate, type LayoutTemplate } from "../editor/layoutTemplate";
import { autoResizeCardBoxes } from "../editor/autoBoxSize";
import { getPxPerMm } from "../utils/mmPx";

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

type AnyPersistedState = { version?: unknown; state?: unknown };

const migratePersistedState = (raw: AnyPersistedState): PersistedState | null => {
  if (raw?.version === 1 && raw.state && typeof raw.state === "object") {
    return raw as PersistedState;
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
    rulersPlacement: "outside" | "inside";
    editModeEnabled: boolean;
    activeTemplate?: LayoutTemplate | null;
  };
};

type PersistedCardsPayload = {
  version: 1;
  cardsA: Card[];
  cardsB: Card[];
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

const HISTORY_LIMIT = 50;
const BOOKMARK_LIMIT = 50;
const CHANGE_LOG_LIMIT = 50;
const STORAGE_KEY = "lc_state_v1";
const CARDS_META_KEY = "lc_cards_v1_meta";
const CARDS_CHUNK_KEY_PREFIX = "lc_cards_v1_chunk_";
const CARDS_CHUNK_SIZE = 180_000;
const TEMPLATE_STORAGE_KEY = "lc_layout_template_v1";

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

const toPersistableCard = (card: Card): Card => {
  const source = safeClone(card) as Card & { meta?: Record<string, unknown> };
  if (!source.meta) return source;
  const { originalSource: _originalSource, ...restMeta } = source.meta;
  if (Object.keys(restMeta).length) {
    source.meta = restMeta;
  } else {
    delete source.meta;
  }
  return source;
};

const cloneCards = (cards: Card[]) => cards.map((card) => safeClone(card));
const cloneCardsForPersist = (cards: Card[]) => cards.map((card) => toPersistableCard(card));

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
    inf: "machen",
    freq: 3,
    tags: ["B2", "grundverb", "praesens"],
    tr_1_ru: "делать",
    tr_1_ctx: "основное значение",
    tr_2_ru: "выполнять",
    tr_2_ctx: "работа и задачи",
    tr_3_ru: "заставлять",
    tr_3_ctx: "разговорная речь",
    tr_4_ru: "устраивать",
    tr_4_ctx: "организация событий",
    forms_p3: "macht",
    forms_prat: "machte",
    forms_p2: "gemacht",
    forms_aux: "haben",
    syn_1_de: "tun",
    syn_1_ru: "делать",
    syn_2_de: "erledigen",
    syn_2_ru: "выполнять",
    syn_3_de: "verursachen",
    syn_3_ru: "вызывать",
    ex_1_de: "Ich mache den Plan für unser neues Projekt.",
    ex_1_ru: "Я составляю план для нашего нового проекта.",
    ex_1_tag: "Präsens",
    ex_2_de: "Gestern habe ich die Präsentation für das Team gemacht.",
    ex_2_ru: "Вчера я сделал презентацию для команды.",
    ex_2_tag: "Perfekt",
    ex_3_de: "Wir müssen das heute noch besser machen.",
    ex_3_ru: "Мы должны сегодня сделать это еще лучше.",
    ex_3_tag: "Modalverb",
    ex_4_de: "Früher machte er alle Berichte allein.",
    ex_4_ru: "Раньше он делал все отчёты один.",
    ex_4_tag: "Präteritum",
    ex_5_de: "So macht man das in unserer Abteilung.",
    ex_5_ru: "Так это делают в нашем отделе.",
    ex_5_tag: "Unpersönlich",
    rek_1_de: "Mach dir zuerst eine klare Struktur.",
    rek_1_ru: "Сначала выстрой четкую структуру.",
    rek_2_de: "Das macht im Kontext mehr Sinn.",
    rek_2_ru: "В контексте это имеет больше смысла.",
    rek_3_de: "Was machst du als nächsten Schritt?",
    rek_3_ru: "Что ты делаешь следующим шагом?",
    rek_4_de: "Mach weiter, bis die Aussage präzise ist.",
    rek_4_ru: "Продолжай, пока формулировка не станет точной.",
    rek_5_de: "Damit macht der ganze Dialog mehr Sinn.",
    rek_5_ru: "Так весь диалог звучит логичнее."
  });

const createBaseState = () => ({
  cardsA: [applySemanticLayoutToCard(makeDemoCard("demo-a-machen"), defaultLayout.widthMm, defaultLayout.heightMm)] as Card[],
  cardsB: [applySemanticLayoutToCard(makeDemoCard("demo-b-machen"), defaultLayout.widthMm, defaultLayout.heightMm)] as Card[],
  selectedId: "demo-a-machen" as string | null,
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
  rulersPlacement: "outside" as const,
  historyBookmarks: [] as HistoryBookmark[],
  changeLog: [] as ChangeLogEntry[],
  editModeEnabled: false,
  activeTemplate: null as LayoutTemplate | null,
  storageWarning: null as string | null
});

const loadPersistedTemplate = (): LayoutTemplate | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LayoutTemplate;
    if (parsed?.version !== 1 || !Array.isArray(parsed.boxes)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

type PersistedCards = { cardsA: Card[]; cardsB: Card[] };

const loadPersistedCards = (): PersistedCards | null => {
  if (typeof window === "undefined") return null;
  try {
    const metaRaw = window.localStorage.getItem(CARDS_META_KEY);
    if (!metaRaw) return null;
    const meta = JSON.parse(metaRaw) as { version?: number; chunks?: number };
    const chunks = Number.isFinite(meta?.chunks) ? Number(meta.chunks) : 0;
    if (meta?.version !== 1 || chunks <= 0) return null;
    let payload = "";
    for (let index = 0; index < chunks; index += 1) {
      const chunk = window.localStorage.getItem(`${CARDS_CHUNK_KEY_PREFIX}${index}`);
      if (!chunk) return null;
      payload += chunk;
    }
    const parsed = JSON.parse(payload) as PersistedCards;
    return {
      cardsA: Array.isArray(parsed.cardsA) ? parsed.cardsA : [],
      cardsB: Array.isArray(parsed.cardsB) ? parsed.cardsB : []
    };
  } catch {
    return null;
  }
};

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

  const safeActiveTemplate =
    raw.activeTemplate && typeof raw.activeTemplate === "object" && (raw.activeTemplate as any).version === 1
      ? (raw.activeTemplate as LayoutTemplate)
      : null;

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

const persistCards = (cardsA: Card[], cardsB: Card[]) => {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ cardsA, cardsB });
  const chunks: string[] = [];
  for (let index = 0; index < payload.length; index += CARDS_CHUNK_SIZE) {
    chunks.push(payload.slice(index, index + CARDS_CHUNK_SIZE));
  }

  const prevMetaRaw = window.localStorage.getItem(CARDS_META_KEY);
  const prevChunks = prevMetaRaw ? (JSON.parse(prevMetaRaw).chunks as number | undefined) : 0;

  chunks.forEach((chunk, index) => {
    window.localStorage.setItem(`${CARDS_CHUNK_KEY_PREFIX}${index}`, chunk);
  });
  window.localStorage.setItem(CARDS_META_KEY, JSON.stringify({ version: 1, chunks: chunks.length }));

  const prevCount = Number.isFinite(prevChunks) ? Number(prevChunks) : 0;
  for (let index = chunks.length; index < prevCount; index += 1) {
    window.localStorage.removeItem(`${CARDS_CHUNK_KEY_PREFIX}${index}`);
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

const recordHistory = (state: AppState, current: AppState) => {
  state.past.push(snapshotState(current));
  if (state.past.length > HISTORY_LIMIT) {
    state.past.shift();
  }
  state.future = [];
};

const appendHistoryBookmark = (state: AppState, current: AppState, action: string) => {
  const createdAt = new Date().toISOString();
  state.historyBookmarks.push({
    id: crypto.randomUUID(),
    createdAt,
    action,
    snapshot: snapshotState(current)
  });
  if (state.historyBookmarks.length > BOOKMARK_LIMIT) {
    state.historyBookmarks.shift();
  }
};

const appendChange = (state: AppState, action: string) => {
  state.changeLog.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action
  });
  if (state.changeLog.length > CHANGE_LOG_LIMIT) {
    state.changeLog.shift();
  }
};

const trackStateEvent = (
  state: AppState,
  current: AppState,
  action: string,
  options?: { undoable?: boolean }
) => {
  const baseline = current;
  const undoable = options?.undoable ?? true;
  if (undoable) {
    recordHistory(state, baseline);
  }
  appendChange(state, action);
  appendHistoryBookmark(state, baseline, action);
};

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
    persistCards(state.cardsA, state.cardsB);
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
      trackStateEvent(state, get(), "setZoom");
      state.zoom = Math.min(2, Math.max(0.25, value));
    }),
    selectCard: (id, side) => set((state) => {
      trackStateEvent(state, get(), `selectCard:${side}:${id ?? "none"}`, { undoable: false });
      state.selectedId = id;
      state.selectedSide = side;
    }),
    selectBox: (id) => set((state) => {
      trackStateEvent(state, get(), `selectBox:${id ?? "none"}`, { undoable: false });
      state.selectedBoxId = id;
    }),
    addCard: (card, side) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), `addCard:${side}`);
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
      trackStateEvent(state, get(), reason ?? `updateCard:${side}:${card.id}`);
      const list = side === "A" ? state.cardsA : state.cardsB;
      const index = list.findIndex((item) => item.id === card.id);
      if (index >= 0) {
        list[index] = ensureCardHasBoxes(card, state.layout.widthMm, state.layout.heightMm);
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
        trackStateEvent(state, get(), reason ?? `updateCardSilent:${side}:${card.id}`);
      }
      const list = side === "A" ? state.cardsA : state.cardsB;
      const index = list.findIndex((item) => item.id === card.id);
      if (index >= 0) {
        list[index] = ensureCardHasBoxes(card, state.layout.widthMm, state.layout.heightMm);
      }
    }),
    removeCard: (id, side) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), `removeCard:${side}`);
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
      trackStateEvent(state, get(), `moveCard:${from}`);
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
      trackStateEvent(state, get(), "setLayout");
      state.layout = layout;
    }),
    setCardSizeMm: (widthMm, heightMm) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), "setCardSizeMm");
      state.layout.widthMm = Math.min(400, Math.max(50, widthMm));
      state.layout.heightMm = Math.min(400, Math.max(50, heightMm));
    }),
    updateBox: (boxId, update) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), `updateBox:${boxId}`);
      state.isEditingLayout = true;
      const box = state.layout.boxes.find((item) => item.id === boxId);
      if (box) {
        Object.assign(box, update);
      }
    }),
    beginLayoutEdit: () => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), "beginLayoutEdit");
      state.isEditingLayout = true;
    }),
    endLayoutEdit: () => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), "endLayoutEdit");
      state.isEditingLayout = false;
    }),
    toggleGrid: () => set((state) => {
      trackStateEvent(state, get(), "toggleGrid");
      state.gridEnabled = !state.gridEnabled;
    }),
    toggleRulers: () => set((state) => {
      trackStateEvent(state, get(), "toggleRulers");
      state.rulersEnabled = !state.rulersEnabled;
    }),
    toggleSnap: () => set((state) => {
      trackStateEvent(state, get(), "toggleSnap");
      state.snapEnabled = !state.snapEnabled;
    }),
    setGridIntensity: (value) => set((state) => {
      trackStateEvent(state, get(), `setGridIntensity:${value}`);
      state.gridIntensity = value;
    }),
    toggleOnlyCmLines: () => set((state) => {
      trackStateEvent(state, get(), "toggleOnlyCmLines");
      state.showOnlyCmLines = !state.showOnlyCmLines;
    }),
    toggleDebugOverlays: () => set((state) => {
      trackStateEvent(state, get(), "toggleDebugOverlays");
      state.debugOverlays = !state.debugOverlays;
    }),
    setRulersPlacement: (value) => set((state) => {
      trackStateEvent(state, get(), `setRulersPlacement:${value}`);
      state.rulersPlacement = value;
    }),
    startExport: (label) => set((state) => {
      trackStateEvent(state, get(), `startExport:${label}`, { undoable: false });
      state.isExporting = true;
      state.exportStartedAt = Date.now();
      state.exportLabel = label;
    }),
    finishExport: () => set((state) => {
      trackStateEvent(state, get(), "finishExport", { undoable: false });
      state.isExporting = false;
      state.exportStartedAt = null;
      state.exportLabel = null;
    }),
    toggleCardSelection: (id, side) => set((state) => {
      trackStateEvent(state, get(), `toggleCardSelection:${side}:${id}`);
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
      trackStateEvent(state, get(), `selectAllCards:${side}`);
      const source = side === "A" ? state.cardsA : state.cardsB;
      const next = source.map((card) => card.id);
      if (side === "A") {
        state.selectedCardIdsA = next;
      } else {
        state.selectedCardIdsB = next;
      }
    }),
    clearCardSelection: (side) => set((state) => {
      trackStateEvent(state, get(), `clearCardSelection:${side}`);
      if (side === "A") {
        state.selectedCardIdsA = [];
      } else {
        state.selectedCardIdsB = [];
      }
    }),
    autoLayoutAllCards: (side) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), `autoLayoutAllCards:${side}`);
      const source = side === "A" ? state.cardsA : state.cardsB;
      const next = source.map((card) => applySemanticLayoutToCard(card, state.layout.widthMm, state.layout.heightMm));
      if (side === "A") {
        state.cardsA = next;
      } else {
        state.cardsB = next;
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
      trackStateEvent(state, get(), `adjustColumnFontSizeByField:${side}`);
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
      if (side === "A") {
        state.cardsA = next;
      } else {
        state.cardsB = next;
      }
    }),
    addBlockToCard: (side, cardId, kind) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), `addBlockToCard:${side}:${kind}`);
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
      trackStateEvent(state, get(), `removeBox:${side}:${state.selectedBoxId}`);
      const list = side === "A" ? state.cardsA : state.cardsB;
      const index = list.findIndex((card) => card.id === cardId);
      if (index < 0) return;
      const current = list[index];
      if (!current?.boxes?.length) return;
      const nextBoxes = current.boxes.filter((box) => box.id !== state.selectedBoxId);
      if (nextBoxes.length === current.boxes.length) return;
      list[index] = { ...current, boxes: nextBoxes };
      state.selectedBoxId = null;
    }),
    recordEvent: (action) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), action, { undoable: false });
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
      state.historyBookmarks = [];
      state.changeLog = [];
      state.isEditingLayout = false;
      state.editModeEnabled = next.editModeEnabled;
    }),
    pushHistory: () => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), "pushHistorySnapshot");
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
      trackStateEvent(state, get(), `jumpToHistoryBookmark:${id}`);
      applySnapshot(state, target.snapshot);
    }),
    deleteHistoryBookmark: (id) => set((state) => {
      if (!state.editModeEnabled) return;
      trackStateEvent(state, get(), `deleteHistoryBookmark:${id}`);
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
        appendChange(state, "undo");
      }
    }),
    redo: () => set((state) => {
      if (!state.editModeEnabled) return;
      const next = state.future.shift();
      if (next) {
        state.past.push(snapshotState(get()));
        applySnapshot(state, next);
        appendChange(state, "redo");
      }
    }),
    toggleEditMode: () => set((state) => {
      state.editModeEnabled = !state.editModeEnabled;
      trackStateEvent(state, get(), `toggleEditMode:${state.editModeEnabled ? "on" : "off"}`, { undoable: false });
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
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));
        } catch (error) {
          console.warn("Failed to persist layout template", error);
        }
      }

      const selected = side === "A" ? state.selectedCardIdsA : state.selectedCardIdsB;
      const selectedSet = new Set(selected);
      trackStateEvent(state, get(), `applyCardFormattingToCards:${side}:${mode}`);

      const nextList = list.map((card) => {
        const shouldApply = mode === "all" ? card.id !== sourceCardId : selectedSet.has(card.id) && card.id !== sourceCardId;
        if (!shouldApply) return card;
        return autoResizeCardBoxes(applyLayoutTemplate(card, template), getPxPerMm(1));
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
      trackStateEvent(state, get(), `applyAutoHeightToCards:${side}:${mode}`);
      const next = source.map((card) => {
        const shouldApply = mode === "all" ? true : selectedSet.has(card.id);
        if (!shouldApply) return card;
        return autoResizeCardBoxes(card, pxPerMm);
      });
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
    }, 150);
  });
}
