import type { Card } from "../model/cardSchema";
import { emptyCard, normalizeCard } from "../model/cardSchema";
import { applySemanticLayoutToCard } from "../editor/semanticLayout";
import { defaultLayout } from "../model/layoutSchema";
import { normalizeFieldId } from "../utils/fieldAlias";

export type InternalCard = Card & {
  meta?: Record<string, unknown>;
};

export type SupportedSchema = "cards" | "array" | "verbs" | "unknown";

export type ImportStrategy = {
  name: Exclude<SupportedSchema, "unknown">;
  match: (raw: unknown) => boolean;
  normalize: (raw: unknown) => InternalCard[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ensureArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const toString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const pickString = (source: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = toString(source[key]);
    if (value) return value;
  }
  return "";
};

const pickArray = (source: Record<string, unknown>, keys: string[]): unknown[] => {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
};

const deterministicId = (schema: Exclude<SupportedSchema, "unknown">, index: number, source: unknown) => {
  const sourceHash = hashString(JSON.stringify(source ?? null));
  return `import_${schema}_${index + 1}_${sourceHash}`;
};

const mapExternalCardFields = (source: Record<string, unknown>) => {
  const root = isRecord(source.verb) ? source.verb : source;
  const forms = isRecord(root.forms) ? root.forms : {};

  const translations = pickArray(root, ["translations", "tr", "meanings", "translation"]);
  const firstTranslation = translations[0];
  const secondTranslation = translations[1];
  const tr1 =
    pickString(root, ["tr_1_ru", "translation_ru", "translation", "ru", "meaning_ru"]) ||
    (typeof firstTranslation === "string"
      ? firstTranslation.trim()
      : isRecord(firstTranslation)
        ? pickString(firstTranslation, ["ru", "translation", "text", "value"])
        : "");
  const tr2 =
    pickString(root, ["tr_2_ru", "translation_2_ru", "meaning_2_ru"]) ||
    (typeof secondTranslation === "string"
      ? secondTranslation.trim()
      : isRecord(secondTranslation)
        ? pickString(secondTranslation, ["ru", "translation", "text", "value"])
        : "");

  const rawAux = pickString({ ...forms, ...root }, ["forms_aux", "aux", "auxiliary"]);
  const formsAux: Card["forms_aux"] = rawAux === "haben" || rawAux === "sein" ? rawAux : "";

  const result: Partial<Card> = {
    ...root,
    inf: pickString(root, ["inf", "infinitive", "lemma", "verb", "word", "de"]),
    title: pickString(root, ["title", "name"]),
    tr_1_ru: tr1,
    tr_2_ru: tr2,
    forms_p3: pickString({ ...forms, ...root }, ["forms_p3", "p3", "present3", "praesens3"]),
    forms_prat: pickString({ ...forms, ...root }, ["forms_prat", "prat", "preterite", "past"]),
    forms_p2: pickString({ ...forms, ...root }, ["forms_p2", "p2", "partizip2", "participle2"]),
    forms_aux: formsAux,
    tags: Array.isArray(root.tags) ? root.tags.filter((tag): tag is string => typeof tag === "string") : []
  };

  if (!result.title && result.inf) {
    result.title = result.inf;
  }

  return result;
};

const enforceDynamicBoxesForRealFields = (card: Card): Card => {
  const knownCardFields = new Set(Object.keys(emptyCard));
  return {
    ...card,
    boxes: (card.boxes ?? []).map((box) => {
      const normalizedField = normalizeFieldId(box.fieldId);
      const isRealField = knownCardFields.has(normalizedField) && !["forms_rek", "synonyms", "examples", "custom_text"].includes(normalizedField);
      if (!isRealField) return box;
      return {
        ...box,
        textMode: "dynamic",
        staticText: ""
      };
    })
  };
};

const normalizeEntry = (
  item: unknown,
  schema: Exclude<SupportedSchema, "unknown">,
  index: number
): InternalCard => {
  const source = isRecord(item) ? item : {};
  const mapped = mapExternalCardFields(source);
  const normalized = normalizeCard({
    ...mapped,
    id: typeof source.id === "string" && source.id.trim() ? source.id : deterministicId(schema, index, source)
  });

  const withBoxes = normalized.boxes?.length
    ? normalized
    : applySemanticLayoutToCard(normalized, defaultLayout.widthMm, defaultLayout.heightMm);

  const enforced = enforceDynamicBoxesForRealFields(withBoxes);

  return {
    ...enforced,
    meta: {
      ...(isRecord((source as { meta?: unknown }).meta)
        ? ((source as { meta?: Record<string, unknown> }).meta ?? {})
        : {}),
      originalSource: source,
      importSchema: schema,
      importIndex: index
    }
  };
};

export const detectSchema = (raw: unknown): SupportedSchema => {
  if (Array.isArray(raw)) return "array";
  if (!isRecord(raw)) return "unknown";
  if (Array.isArray(raw.cards)) return "cards";
  if (Array.isArray(raw.verbs) || Array.isArray(raw.data)) return "verbs";
  return "unknown";
};

export const normalizeFromCards = (raw: unknown): InternalCard[] => {
  const source = isRecord(raw) ? raw.cards : [];
  return ensureArray(source).map((item, index) => normalizeEntry(item, "cards", index));
};

export const normalizeFromArray = (raw: unknown): InternalCard[] =>
  ensureArray(raw).map((item, index) => normalizeEntry(item, "array", index));

export const normalizeFromVerbs = (raw: unknown): InternalCard[] => {
  if (!isRecord(raw)) return [];
  const source = Array.isArray(raw.verbs) ? raw.verbs : raw.data;
  return ensureArray(source).map((item, index) => normalizeEntry(item, "verbs", index));
};

const strategies: ImportStrategy[] = [
  {
    name: "cards",
    match: (raw) => detectSchema(raw) === "cards",
    normalize: normalizeFromCards
  },
  {
    name: "array",
    match: (raw) => detectSchema(raw) === "array",
    normalize: normalizeFromArray
  },
  {
    name: "verbs",
    match: (raw) => detectSchema(raw) === "verbs",
    normalize: normalizeFromVerbs
  }
];

const buildUnknownSchemaError = (raw: unknown) => {
  const rootType = Array.isArray(raw) ? "array" : typeof raw;
  const keys = isRecord(raw) ? Object.keys(raw) : [];
  return new Error(
    `Unknown import schema. rootType=${rootType}; rootKeys=${keys.length ? keys.join(",") : "(none)"}; expected one of: {cards:[]}, [], {verbs:[]}, {data:[]}.`
  );
};

const collectFilledFields = (card: InternalCard) => {
  const fields: string[] = [];
  if (card.inf) fields.push("inf");
  if (card.title) fields.push("title");
  if (card.tr_1_ru || card.tr_2_ru || card.tr_3_ru || card.tr_4_ru) fields.push("translations");
  if (card.forms_p3 || card.forms_prat || card.forms_p2 || card.forms_aux) fields.push("forms");
  if (card.syn_1_de || card.syn_1_ru) fields.push("synonyms");
  if (card.ex_1_de || card.ex_1_ru) fields.push("examples");
  return fields;
};

export const normalizeImportedJson = (raw: unknown): InternalCard[] => {
  const detectedSchema = detectSchema(raw);
  console.log("Import schema:", detectedSchema);
  const strategy = strategies.find((item) => item.match(raw));
  if (!strategy || detectedSchema === "unknown") {
    throw buildUnknownSchemaError(raw);
  }
  const normalized = strategy.normalize(raw);
  console.log("Normalized cards:", normalized.length);

  const first = normalized[0];
  if (first) {
    const source = isRecord(first.meta?.originalSource) ? (first.meta?.originalSource as Record<string, unknown>) : {};
    const sourceKeys = Object.keys(source);
    const recognized = ["inf", "title", "tr_1_ru", "tr_2_ru", "forms_p3", "forms_prat", "forms_p2", "forms_aux"].filter((key) =>
      Boolean((first as unknown as Record<string, unknown>)[key])
    );
    console.log("Import first card source keys:", sourceKeys);
    console.log("Import first card recognized fields:", recognized);
    console.log("Import first card filled sections:", collectFilledFields(first));
  }

  return normalized;
};
