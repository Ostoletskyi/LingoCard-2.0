import { DEFAULT_TEMPLATE_BOXES } from "../layout/defaultTemplate";
import type { CanonicalCard } from "./canonicalTypes";

export function ensureTemplateBoxes(card: CanonicalCard): CanonicalCard {
  if (Array.isArray(card.boxes) && card.boxes.length > 0) return card;
  return {
    ...card,
    boxes: DEFAULT_TEMPLATE_BOXES.map((box) => ({ ...box }))
  };
}
