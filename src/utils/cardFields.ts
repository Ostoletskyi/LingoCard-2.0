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
  forms_service: "Сервисная форма",

  tr_1_ru: "Перевод RU 1",
  tr_1_ctx: "Контекст RU 1",
  tr_2_ru: "Перевод RU 2",
  tr_2_ctx: "Контекст RU 2",
  tr_3_ru: "Перевод RU 3",
  tr_3_ctx: "Контекст RU 3",
  tr_4_ru: "Перевод RU 4",
  tr_4_ctx: "Контекст RU 4",

  freq: "Частотность",
  tags: "Теги",

  forms_rek: "Три времени + рекция",
  synonyms: "Синонимы",
  examples: "Примеры",
  recommendations: "Рекомендации",
  custom_text: "Простой блок"
};

const warnedMissingFields = new Set<string>();

const collectTranslationValues = (card: Card): string[] => {
  const fromAgg = (card.translations ?? [])
    .map((item) => `${(item.value ?? "").trim()}${item.ctx ? ` (${String(item.ctx).trim()})` : ""}`.trim())
    .filter(Boolean);

  if (fromAgg.length) return fromAgg;

  return [1, 2, 3, 4]
    .map((i) => {
      const ru = String((card[`tr_${i}_ru` as keyof Card] as unknown) ?? "").trim();
      const ctx = String((card[`tr_${i}_ctx` as keyof Card] as unknown) ?? "").trim();
      if (!ru && !ctx) return "";
      return `${ru}${ctx ? ` (${ctx})` : ""}`.trim();
    })
    .filter(Boolean);
};

export const getFieldLabel = (fieldId: string) => {
  const normalized = normalizeFieldId(fieldId);
  return fieldLabels[normalized] ?? `Поле: ${normalized}`;
};

export const getFieldEditValue = (card: Card | null, fieldId: string): string => {
  if (!card) return "";

  const normalizedFieldId = normalizeFieldId(fieldId);

  if (normalizedFieldId === "tags") {
    return (card.tags ?? []).join(", ");
  }

  if (normalizedFieldId === "freq") {
    return card.freq == null ? "" : String(card.freq);
  }

  const aggregatedEditableFields = new Set(["forms_rek", "synonyms", "recommendations", "examples", "forms"]);
  if (aggregatedEditableFields.has(normalizedFieldId)) {
    const resolved = getFieldText(card, normalizedFieldId);
    return resolved.isPlaceholder ? "" : resolved.text;
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
    normalizedFieldId.startsWith("tr_")
      ? "Перевод…"
      : normalizedFieldId.startsWith("ex_")
        ? "Пример…"
        : "Введите текст…";

  if (normalizedFieldId === "freq") {
    const count = card.freq;
    const dotsMap: Record<number, string> = {
      1: "🟣",
      2: "🔴🔴",
      3: "🟠🟠🟠",
      4: "🟡🟡🟡🟡",
      5: "🟢🟢🟢🟢🟢"
    };
    return { text: (count ? dotsMap[count] : "") || "🟠🟠🟠", isPlaceholder: false };
  }

  if (normalizedFieldId === "tags") {
    const tags = card.tags ?? [];
    return {
      text: tags.length ? tags.join(", ") : "Теги…",
      isPlaceholder: tags.length === 0
    };
  }

  if (normalizedFieldId === "hero_inf") {
    const inf = String(card.inf ?? "").trim();
    return { text: inf || "—", isPlaceholder: !inf };
  }

  if (normalizedFieldId === "meta") {
    const tags = card.tags ?? [];
    return {
      text: tags.length ? tags.join(", ") : "Теги…",
      isPlaceholder: tags.length === 0
    };
  }

  if (normalizedFieldId === "hero_translations" || normalizedFieldId === "tr_1_ru") {
    const values = collectTranslationValues(card);
    const text = values.join(", ");
    return { text: text || (normalizedFieldId === "tr_1_ru" ? "Перевод…" : "Переводы…"), isPlaceholder: text.length === 0 };
  }

  if (normalizedFieldId === "forms") {
    const fromService = String(card.forms_service ?? "").trim();
    if (fromService) return { text: fromService, isPlaceholder: false };

    const fromAgg = card.forms
      ? [card.forms.p3, card.forms.praet, card.forms.perfektFull || card.forms.p2]
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .join(" / ")
      : "";

    if (fromAgg) return { text: fromAgg, isPlaceholder: false };
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
        const de = String((card[`rek_${i}_de` as keyof Card] as unknown) ?? "").trim();
        const ru = String((card[`rek_${i}_ru` as keyof Card] as unknown) ?? "").trim();
        return de || ru ? `${de}${de && ru ? " → " : ""}${ru}` : "";
      })
      .filter(Boolean)
      .map((line, idx) => `${idx + 1}. ${line}`);

    const text = [...forms, ...rek].join("\n").trim();
    return { text: text || "Три времени и рекция…", isPlaceholder: text.length === 0 };
  }

  if (normalizedFieldId === "synonyms") {
    const fromAgg = (card.synonyms ?? [])
      .map((item) => `${String(item.de ?? "").trim()}${item.de && item.ru ? " — " : ""}${String(item.ru ?? "").trim()}`.trim())
      .filter(Boolean)
      .join("\n");

    if (fromAgg) return { text: fromAgg, isPlaceholder: false };

    const text = [1, 2, 3]
      .map((i) => {
        const de = String((card[`syn_${i}_de` as keyof Card] as unknown) ?? "").trim();
        const ru = String((card[`syn_${i}_ru` as keyof Card] as unknown) ?? "").trim();
        return de || ru ? `${de}${de && ru ? " — " : ""}${ru}` : "";
      })
      .filter(Boolean)
      .map((line, idx) => `${idx + 1}. ${line}`)
      .join("\n");

    return { text: text || "Синонимы…", isPlaceholder: text.length === 0 };
  }

  if (normalizedFieldId === "recommendations") {
    const text = [1, 2, 3, 4, 5]
      .map((i) => {
        const de = String((card[`rek_${i}_de` as keyof Card] as unknown) ?? "").trim();
        const ru = String((card[`rek_${i}_ru` as keyof Card] as unknown) ?? "").trim();
        return de || ru ? `${de}${de && ru ? " — " : ""}${ru}` : "";
      })
      .filter(Boolean)
      .join("\n");

    return { text: text || "Рекомендации…", isPlaceholder: text.length === 0 };
  }

  if (normalizedFieldId === "examples") {
    const fromAgg = (card.examples ?? [])
      .map((item) => {
        const head = item.tag ? `[${String(item.tag).trim()}] ` : "";
        const de = String(item.de ?? "").trim();
        const ru = String(item.ru ?? "").trim();
        return [head + de, ru ? `— ${ru}` : ""].filter(Boolean).join("\n");
      })
      .filter(Boolean)
      .join("\n");

    if (fromAgg) return { text: fromAgg, isPlaceholder: false };

    const text = [1, 2, 3, 4, 5]
      .map((i) => {
        const de = String((card[`ex_${i}_de` as keyof Card] as unknown) ?? "").trim();
        const ru = String((card[`ex_${i}_ru` as keyof Card] as unknown) ?? "").trim();
        const tag = String((card[`ex_${i}_tag` as keyof Card] as unknown) ?? "").trim();
        if (!de && !ru) return "";
        return [`${tag ? `[${tag}] ` : ""}${de}`.trim(), ru ? `— ${ru}` : ""].filter(Boolean).join("\n");
      })
      .filter(Boolean)
      .join("\n\n");

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
    return { text: placeholder, isPlaceholder: true };
  }

  if (!warnedMissingFields.has(normalizedFieldId)) {
    warnedMissingFields.add(normalizedFieldId);
    console.warn("Missing field:", normalizedFieldId);
  }

  return { text: placeholder, isPlaceholder: true };
};