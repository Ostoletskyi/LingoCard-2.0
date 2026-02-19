import type { Card } from "./cardSchema";

// Convert a card + fieldId into the text that should be rendered inside a box.
// This MUST be resilient: the app supports multiple import schemas and legacy
// flat fields (tr_1_ru, syn_1_de, ex_1_de, ...) plus newer array-based fields
// (tr[], synonyms[], examples[], recommendations[]).

const joinNonEmpty = (lines: Array<string | undefined | null>) => lines.filter((v) => typeof v === "string" && v.trim()).join("\n");

const getLegacyTranslations = (card: Card) =>
  joinNonEmpty([
    card.tr_1_ru,
    card.tr_2_ru,
    card.tr_3_ru,
    card.tr_4_ru,
  ]);

const getLegacySynonyms = (card: Card) =>
  joinNonEmpty([
    card.syn_1_de ? `${card.syn_1_de}${card.syn_1_ru ? " — " + card.syn_1_ru : ""}` : "",
    card.syn_2_de ? `${card.syn_2_de}${card.syn_2_ru ? " — " + card.syn_2_ru : ""}` : "",
    card.syn_3_de ? `${card.syn_3_de}${card.syn_3_ru ? " — " + card.syn_3_ru : ""}` : "",
  ]);

const getLegacyExamples = (card: Card) =>
  joinNonEmpty([
    card.ex_1_de ? `${card.ex_1_de}${card.ex_1_ru ? " — " + card.ex_1_ru : ""}` : "",
    card.ex_2_de ? `${card.ex_2_de}${card.ex_2_ru ? " — " + card.ex_2_ru : ""}` : "",
    card.ex_3_de ? `${card.ex_3_de}${card.ex_3_ru ? " — " + card.ex_3_ru : ""}` : "",
    card.ex_4_de ? `${card.ex_4_de}${card.ex_4_ru ? " — " + card.ex_4_ru : ""}` : "",
    card.ex_5_de ? `${card.ex_5_de}${card.ex_5_ru ? " — " + card.ex_5_ru : ""}` : "",
  ]);

const getLegacyForms = (card: Card) =>
  joinNonEmpty([
    card.forms_p3,
    card.forms_prat,
    card.forms_p2,
    card.forms_aux,
  ]);

export function getFieldText(card: Card, fieldId: string): string {
  // Newer (array-based) shapes might exist on the object at runtime, even if not
  // represented in the current Card type.
  const anyCard = card as any;

  switch (fieldId) {
    case "inf":
    case "hero_inf":
      return card.inf ?? "";

    case "tr":
    case "translation":
    case "translations":
    case "hero_translations": {
      const arr = Array.isArray(anyCard.tr) ? (anyCard.tr as any[]) : null;
      if (arr?.length) return joinNonEmpty(arr.map((x) => (typeof x?.value === "string" ? x.value : "")));
      return getLegacyTranslations(card);
    }

    case "forms":
      // Show 3 forms + auxiliary in a compact list.
      return getLegacyForms(card);

    case "syn":
    case "synonyms": {
      const arr = Array.isArray(anyCard.synonyms) ? (anyCard.synonyms as any[]) : null;
      if (arr?.length) {
        return joinNonEmpty(
          arr.map((s) => {
            const de = typeof s?.de === "string" ? s.de : "";
            const ru = typeof s?.ru === "string" ? s.ru : "";
            return de ? `${de}${ru ? " — " + ru : ""}` : ru;
          })
        );
      }
      return getLegacySynonyms(card);
    }

    case "examples": {
      const arr = Array.isArray(anyCard.examples) ? (anyCard.examples as any[]) : null;
      if (arr?.length) {
        return joinNonEmpty(
          arr.map((e) => {
            const de = typeof e?.de === "string" ? e.de : "";
            const ru = typeof e?.ru === "string" ? e.ru : "";
            return de ? `${de}${ru ? " — " + ru : ""}` : ru;
          })
        );
      }
      return getLegacyExamples(card);
    }

    case "freq":
      // Frequency is represented as dots/balls in UI; text is optional.
      return "";

    case "meta": {
      const tags = Array.isArray(card.tags) ? card.tags : [];
      return joinNonEmpty([tags.join(", ")]);
    }

    case "recommendations":
    case "rekom":
    case "rek": {
      const arr = Array.isArray(anyCard.recommendations) ? (anyCard.recommendations as any[]) : null;
      if (arr?.length) {
        return joinNonEmpty(
          arr.map((r) => {
            const de = typeof r?.de === "string" ? r.de : "";
            const ru = typeof r?.ru === "string" ? r.ru : "";
            return de ? `${de}${ru ? " — " + ru : ""}` : ru;
          })
        );
      }
      return joinNonEmpty([
        card.rek_1_de ? `${card.rek_1_de}${card.rek_1_ru ? " — " + card.rek_1_ru : ""}` : "",
        card.rek_2_de ? `${card.rek_2_de}${card.rek_2_ru ? " — " + card.rek_2_ru : ""}` : "",
        card.rek_3_de ? `${card.rek_3_de}${card.rek_3_ru ? " — " + card.rek_3_ru : ""}` : "",
      ]);
    }

    default:
      // Unknown/custom text fields
      return "";
  }
}
