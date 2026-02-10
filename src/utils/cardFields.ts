import type { Card } from "../model/cardSchema";
import { normalizeFieldId } from "./fieldAlias";

type FieldTextResult = {
  text: string;
  isPlaceholder: boolean;
};

const fieldLabels: Record<string, string> = {
  inf: "Infinitiv",
  forms_p3: "Präsens (3sg)",
  forms_prat: "Präteritum",
  forms_p2: "Partizip II",
  forms_aux: "Aux (haben/sein)",
  tr_1_ru: "Перевод RU",
  tr_1_ctx: "Контекст RU",
  tr_2_ru: "Перевод RU",
  tr_3_ru: "Перевод RU",
  tr_4_ru: "Перевод RU",
  freq: "Частотность",
  tags: "Теги"
};

export const getFieldLabel = (fieldId: string) => {
  const normalized = normalizeFieldId(fieldId);
  return fieldLabels[normalized] ?? `Поле: ${normalized}`;
};

export const getFieldEditValue = (card: Card | null, fieldId: string): string => {
  if (!card) return "";
  const normalizedFieldId = normalizeFieldId(fieldId);
  if (normalizedFieldId === "tags") {
    return card.tags.join(", ");
  }
  if (normalizedFieldId === "freq") {
    return String(card.freq ?? "");
  }
  if (normalizedFieldId in card) {
    const value = card[normalizedFieldId as keyof Card];
    return typeof value === "string" ? value : "";
  }
  return "";
};

export const getFieldText = (card: Card | null, fieldId: string): FieldTextResult => {
  const normalizedFieldId = normalizeFieldId(fieldId);
  if (!card) {
    return { text: "Введите текст…", isPlaceholder: true };
  }
  const placeholder =
    normalizedFieldId.startsWith("tr_") ? "Перевод…" : normalizedFieldId.startsWith("ex_") ? "Пример…" : "Введите текст…";
  if (normalizedFieldId === "freq") {
    const count = card.freq;
    const dotsMap: Record<number, string> = {
      1: "🟣",
      2: "🔴🔴",
      3: "🟠🟠🟠",
      4: "🟡🟡🟡🟡",
      5: "🟢🟢🟢🟢🟢"
    };
    return { text: dotsMap[count] ?? "🟠🟠🟠", isPlaceholder: false };
  }
  if (normalizedFieldId === "tags") {
    return {
      text: card.tags.length ? card.tags.join(", ") : "Теги…",
      isPlaceholder: card.tags.length === 0
    };
  }
  if (normalizedFieldId in card) {
    const value = card[normalizedFieldId as keyof Card];
    if (typeof value === "string" && value.trim().length > 0) {
      return { text: value, isPlaceholder: false };
    }
  }
  return { text: placeholder, isPlaceholder: true };
};
