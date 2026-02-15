import type { Card } from "./cardSchema";

function safeGet<T>(v: unknown): T | undefined {
  return v as T | undefined;
}

// Legacy field-ids still appear in many saved box templates (e.g. forms_p3, ex_1_de).
// The current Card model stores these as structured arrays/objects.
// This adapter keeps old templates working without polluting Card with flat properties.
export function getFieldText(card: Card, fieldId: string): string {
  // 1) Direct field access (works for modern fields like "inf", "meta", "freq", etc.)
  const direct = (card as unknown as Record<string, unknown>)[fieldId];
  if (direct != null) {
    if (typeof direct === "string") return direct;
    if (typeof direct === "number" || typeof direct === "boolean") return String(direct);
    if (Array.isArray(direct)) return direct.join(", ");
  }

  // 2) Structured legacy aliases
  // Forms
  if (fieldId === "forms_p3") return card.forms?.p3 ?? "";
  if (fieldId === "forms_prat" || fieldId === "forms_prät") return card.forms?.praet ?? "";
  if (fieldId === "forms_p2") return card.forms?.p2 ?? "";
  if (fieldId === "forms_aux") return card.forms?.aux ?? "";

  // Translations (RU)
  // tr_1_ru .. tr_9_ru, optionally with context in tr_1_ctx etc.
  const trRuMatch = /^tr_(\d+)_ru$/.exec(fieldId);
  if (trRuMatch) {
    const idx = Math.max(0, Number(trRuMatch[1]) - 1);
    const item = card.tr?.[idx];
    if (!item) return "";
    const ctx = item.ctx?.trim();
    return ctx ? `${item.value} (${ctx})` : item.value;
  }

  // Synonyms: syn_1_de / syn_1_ru
  const synMatch = /^syn_(\d+)_(de|ru)$/.exec(fieldId);
  if (synMatch) {
    const idx = Math.max(0, Number(synMatch[1]) - 1);
    const lang = synMatch[2] as "de" | "ru";
    const item = card.synonyms?.[idx];
    if (!item) return "";
    return (safeGet<Record<string, string>>(item)?.[lang] ?? "").toString();
  }

  // Examples: ex_1_de / ex_1_ru / ex_1_tag
  const exMatch = /^ex_(\d+)_(de|ru|tag)$/.exec(fieldId);
  if (exMatch) {
    const idx = Math.max(0, Number(exMatch[1]) - 1);
    const key = exMatch[2] as "de" | "ru" | "tag";
    const item = card.examples?.[idx];
    if (!item) return "";
    return (safeGet<Record<string, string>>(item)?.[key] ?? "").toString();
  }

  // Recommendations: rek_1_de / rek_1_ru
  const rekMatch = /^rek_(\d+)_(de|ru)$/.exec(fieldId);
  if (rekMatch) {
    const idx = Math.max(0, Number(rekMatch[1]) - 1);
    const lang = rekMatch[2] as "de" | "ru";
    const item = card.recommendations?.[idx];
    if (!item) return "";
    return (safeGet<Record<string, string>>(item)?.[lang] ?? "").toString();
  }

  // 3) Fallback: stringify unknown objects
  if (direct != null) return String(direct);
  return "";
}
