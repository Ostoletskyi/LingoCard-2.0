import type { Card } from "./cardSchema";

export function getFieldText(card: Card, fieldId: string): string {
  const v = (card as unknown as Record<string, unknown>)[fieldId];

  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.join(", ");

  return String(v);
}
