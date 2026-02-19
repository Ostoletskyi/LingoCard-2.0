import type { Card } from "../model/cardSchema";
import type { ListSide } from "./types";
import { extractLayoutTemplate, applyLayoutTemplate, type LayoutTemplate } from "../editor/layoutTemplate";
import { autoResizeCardBoxes } from "../editor/autoBoxSize";
import { getPxPerMm } from "../utils/mmPx";

const safeClone = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
};

type TemplateSyncState = {
  cardsA: Card[];
  cardsB: Card[];
  layout: { widthMm: number; heightMm: number };
  activeTemplate: LayoutTemplate | null;
};

export const syncTemplateToSide = (
  state: TemplateSyncState,
  side: ListSide,
  sourceCard: Card
): LayoutTemplate => {
  const plainSource = safeClone(sourceCard);
  const template = extractLayoutTemplate(plainSource, {
    widthMm: state.layout.widthMm,
    heightMm: state.layout.heightMm
  });

  state.activeTemplate = template;

  const list = side === "A" ? state.cardsA : state.cardsB;
  for (let i = 0; i < list.length; i += 1) {
    const card = list[i];
    if (!card || card.id === sourceCard.id) continue;
    list[i] = autoResizeCardBoxes(applyLayoutTemplate(card, template), getPxPerMm(1));
  }

  return template;
};
