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
  tags: "Теги",
  forms_rek: "Три времени + рекция",
  synonyms: "Синонимы",
  examples: "Примеры",
  custom_text: "Простой блок"
};


const warnedMissingFields = new Set<string>();
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
  if (normalizedFieldId === "hero_inf") {
    return { text: card.inf || "—", isPlaceholder: !card.inf };
  }
  if (normalizedFieldId === "meta") {
    return {
      text: card.tags.length ? card.tags.join(", ") : "Теги…",
      isPlaceholder: card.tags.length === 0
    };
  }
  if (normalizedFieldId === "hero_translations") {
    const fromAgg = (card.translations ?? [])
      .map((item, idx) => {
        const line = `${item.value}${item.ctx ? ` (${item.ctx})` : ""}`.trim();
        return line ? `${idx + 1}. ${line}` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (fromAgg) {
      return { text: fromAgg, isPlaceholder: false };
    }
  }
  if (normalizedFieldId === "forms") {
    const fromAgg = card.forms
      ? [
          card.forms.p3 ? `1. P3: ${card.forms.p3}` : "",
          card.forms.praet ? `2. Prät: ${card.forms.praet}` : "",
          card.forms.p2 ? `3. P2: ${card.forms.p2}` : "",
          card.forms.aux ? `4. Aux: ${card.forms.aux}` : ""
        ].filter(Boolean).join("\n")
      : "";
    if (fromAgg) {
      return { text: fromAgg, isPlaceholder: false };
    }
  }
  if (normalizedFieldId === "forms_rek") {
    const forms = [
      card.forms_p3 ? `Präsens: ${card.forms_p3}` : "",
      card.forms_prat ? `Präteritum: ${card.forms_prat}` : "",
      card.forms_p2 ? `Partizip II: ${card.forms_p2}` : "",
      card.forms_aux ? `Aux: ${card.forms_aux}` : ""
    ]
      .filter(Boolean)
      .map((line, idx) => `${idx + 1}. ${line}`);
    const rek = [1, 2, 3, 4, 5]
      .map((i) => {
        const de = card[`rek_${i}_de` as keyof Card] as string;
        const ru = card[`rek_${i}_ru` as keyof Card] as string;
        return de || ru ? `${de}${de && ru ? " → " : ""}${ru}` : "";
      })
      .filter(Boolean)
      .map((line, idx) => `${idx + 1}. ${line}`);
    const text = [...forms, ...rek].join("\n").trim();
    return { text: text || "Три времени и рекция…", isPlaceholder: text.length === 0 };
  }
  if (normalizedFieldId === "synonyms") {
    const fromAgg = (card.synonyms ?? [])
      .map((item, idx) => {
        const line = `${item.de}${item.de && item.ru ? " — " : ""}${item.ru ?? ""}`.trim();
        return line ? `${idx + 1}. ${line}` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (fromAgg) {
      return { text: fromAgg, isPlaceholder: false };
    }
    const text = [1, 2, 3]
      .map((i) => {
        const de = card[`syn_${i}_de` as keyof Card] as string;
        const ru = card[`syn_${i}_ru` as keyof Card] as string;
        return de || ru ? `${de}${de && ru ? " — " : ""}${ru}` : "";
      })
      .filter(Boolean)
      .map((line, idx) => `${idx + 1}. ${line}`)
      .join("\n");
    return { text: text || "Синонимы…", isPlaceholder: text.length === 0 };
  }
  if (normalizedFieldId === "examples") {
    const fromAgg = (card.examples ?? [])
      .map((item, idx) => {
        const line = `${item.de}${item.de && item.ru ? " | " : ""}${item.ru ?? ""}`.trim();
        return line ? `${idx + 1}. ${line}` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (fromAgg) {
      return { text: fromAgg, isPlaceholder: false };
    }
    const text = [1, 2, 3, 4, 5]
      .map((i) => {
        const de = card[`ex_${i}_de` as keyof Card] as string;
        const ru = card[`ex_${i}_ru` as keyof Card] as string;
        return de || ru ? `${de}${de && ru ? " | " : ""}${ru}` : "";
      })
      .filter(Boolean)
      .map((line, idx) => `${idx + 1}. ${line}`)
      .join("\n");
    return { text: text || "Примеры…", isPlaceholder: text.length === 0 };
  }
  if (normalizedFieldId === "custom_text") {
    return { text: "Введите текст…", isPlaceholder: true };
  }
  if (normalizedFieldId in card) {
    const value = card[normalizedFieldId as keyof Card];
    if (typeof value === "string" && value.trim().length > 0) {
      return { text: value, isPlaceholder: false };
    }
  }
  if (!warnedMissingFields.has(normalizedFieldId)) {
    warnedMissingFields.add(normalizedFieldId);
    console.warn("Missing field:", normalizedFieldId);
  }
  return { text: placeholder, isPlaceholder: true };
};
