import type { Card } from "../model/cardSchema";
import type { LayoutTemplate } from "../editor/layoutTemplate";

export const STORAGE_KEY = "lc_state_v1";
export const CARDS_META_KEY = "lc_cards_v1_meta";
export const CARDS_CHUNK_KEY_PREFIX = "lc_cards_v1_chunk_";
export const CARDS_CHUNK_SIZE = 180_000;
export const TEMPLATE_STORAGE_KEY = "lc_layout_template_v1";

export type PersistedCards = { cardsA: Card[]; cardsB: Card[] };

export const loadPersistedTemplate = (): LayoutTemplate | null => {
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

export const persistActiveTemplate = (template: LayoutTemplate | null): void => {
  if (typeof window === "undefined") return;
  try {
    if (!template) {
      window.localStorage.removeItem(TEMPLATE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));
  } catch (error) {
    console.warn("Failed to persist layout template", error);
  }
};

export const loadPersistedCards = (): PersistedCards | null => {
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

export const persistCards = (cardsA: Card[], cardsB: Card[]) => {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ cardsA, cardsB });
  const chunks: string[] = [];
  for (let index = 0; index < payload.length; index += CARDS_CHUNK_SIZE) {
    chunks.push(payload.slice(index, index + CARDS_CHUNK_SIZE));
  }

  const prevMetaRaw = window.localStorage.getItem(CARDS_META_KEY);
  const prevMeta = prevMetaRaw ? (JSON.parse(prevMetaRaw) as { chunks?: number }) : null;
  const prevChunks = Number.isFinite(prevMeta?.chunks) ? Number(prevMeta?.chunks) : 0;
  chunks.forEach((chunk, index) => {
    window.localStorage.setItem(`${CARDS_CHUNK_KEY_PREFIX}${index}`, chunk);
  });
  window.localStorage.setItem(CARDS_META_KEY, JSON.stringify({ version: 1, chunks: chunks.length }));

  for (let index = chunks.length; index < prevChunks; index += 1) {
    window.localStorage.removeItem(`${CARDS_CHUNK_KEY_PREFIX}${index}`);
  }
};
