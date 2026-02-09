import type { Card } from "../model/cardSchema";

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

export const getFieldLabel = (fieldId: string) => fieldLabels[fieldId] ?? `Поле: ${fieldId}`;

export const getFieldText = (card: Card | null, fieldId: string): FieldTextResult => {
  if (!card) {
    return { text: "Введите текст…", isPlaceholder: true };
  }
  const placeholder =
    fieldId.startsWith("tr_") ? "Перевод…" : fieldId.startsWith("ex_") ? "Пример…" : "Введите текст…";
  if (fieldId === "freq") {
    const count = card.freq ?? 0;
    return { text: count ? "●".repeat(count) : "1–5", isPlaceholder: count === 0 };
  }
  if (fieldId === "tags") {
    return {
      text: card.tags.length ? card.tags.join(", ") : "Теги…",
      isPlaceholder: card.tags.length === 0
    };
  }
  if (fieldId in card) {
    const value = card[fieldId as keyof Card];
    if (typeof value === "string" && value.trim().length > 0) {
      return { text: value, isPlaceholder: false };
    }
  }
  return { text: placeholder, isPlaceholder: true };
};
