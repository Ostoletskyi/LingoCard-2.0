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

type CanonicalTranslation = { value: string };
type CanonicalSynonym = { de: string; ru: string };
type CanonicalExample = { de: string; ru: string; tag: string };
type CanonicalForms = { p3: string; praet: string; p2: string; aux: "" | "haben" | "sein" };

type CanonicalCardContract = {
  id: string;
  title: string;
  inf: string;
  freq: number;
  tags: string[];
  tr: CanonicalTranslation[];
  forms: CanonicalForms;
  synonyms: CanonicalSynonym[];
  examples: CanonicalExample[];
  boxes: Card["boxes"];
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

const toCanonicalCard = (
  item: unknown,
  schema: Exclude<SupportedSchema, "unknown">,
  index: number
): CanonicalCardContract => {
  const source = isRecord(item) ? item : {};
  const root = isRecord(source.verb) ? source.verb : source;
  const forms = isRecord(root.forms) ? root.forms : {};

  const translationSource = pickArray(root, ["translations", "tr", "meanings", "translation"]);
  const trFromArray = translationSource
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (isRecord(entry)) return pickString(entry, ["ru", "translation", "text", "value"]);
      return "";
    })
    .filter(Boolean)
    .map((value) => ({ value }));

  const trDirect = [
    pickString(root, ["tr_1_ru", "translation_ru", "translation", "ru", "meaning_ru"]),
    pickString(root, ["tr_2_ru", "translation_2_ru", "meaning_2_ru"]),
    pickString(root, ["tr_3_ru", "translation_3_ru", "meaning_3_ru"]),
    pickString(root, ["tr_4_ru", "translation_4_ru", "meaning_4_ru"])
  ]
    .filter(Boolean)
    .map((value) => ({ value }));

  const synonymsSource = pickArray(root, ["synonyms", "syn"]);
  const synonyms: CanonicalSynonym[] = synonymsSource
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const de = pickString(entry, ["de", "word", "lemma"]);
      const ru = pickString(entry, ["ru", "translation", "value"]);
      if (!de && !ru) return null;
      return { de, ru };
    })
    .filter((entry): entry is CanonicalSynonym => Boolean(entry));

  const examplesSource = pickArray(root, ["examples", "example"]);
  const examples: CanonicalExample[] = examplesSource
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const de = pickString(entry, ["de", "text", "source"]);
      const ru = pickString(entry, ["ru", "translation", "target"]);
      const tag = pickString(entry, ["tag", "label"]);
      if (!de && !ru) return null;
      return { de, ru, tag };
    })
    .filter((entry): entry is CanonicalExample => Boolean(entry));

  const rawAux = pickString({ ...forms, ...root }, ["forms_aux", "aux", "auxiliary"]);
  const aux: CanonicalForms["aux"] = rawAux === "haben" || rawAux === "sein" ? rawAux : "";

  const inf = pickString(root, ["inf", "infinitive", "lemma", "verb", "word", "de"]);
  const title = pickString(root, ["title", "name"]) || inf;

  const freqValue = Number(root.freq);
  const freq = Number.isFinite(freqValue) ? Math.max(0, Math.min(5, Math.round(freqValue))) : 0;

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id : deterministicId(schema, index, source),
    title,
    inf,
    freq,
    tags: Array.isArray(root.tags) ? root.tags.filter((tag): tag is string => typeof tag === "string") : [],
    tr: trFromArray.length ? trFromArray : trDirect,
    forms: {
      p3: pickString({ ...forms, ...root }, ["forms_p3", "p3", "present3", "praesens3"]),
      praet: pickString({ ...forms, ...root }, ["forms_prat", "prat", "preterite", "past"]),
      p2: pickString({ ...forms, ...root }, ["forms_p2", "p2", "partizip2", "participle2"]),
      aux
    },
    synonyms,
    examples,
    boxes: Array.isArray(root.boxes) ? (root.boxes as Card["boxes"]) : []
  };
};

const canonicalToInternalCard = (canonical: CanonicalCardContract, source: Record<string, unknown>, schema: Exclude<SupportedSchema, "unknown">, index: number): InternalCard => {
  const normalized = normalizeCard({
    ...source,
    id: canonical.id,
    title: canonical.title,
    inf: canonical.inf,
    freq: (canonical.freq >= 1 && canonical.freq <= 5 ? canonical.freq : 3) as Card["freq"],
    tags: canonical.tags,
    tr_1_ru: canonical.tr[0]?.value ?? "",
    tr_2_ru: canonical.tr[1]?.value ?? "",
    tr_3_ru: canonical.tr[2]?.value ?? "",
    tr_4_ru: canonical.tr[3]?.value ?? "",
    forms_p3: canonical.forms.p3,
    forms_prat: canonical.forms.praet,
    forms_p2: canonical.forms.p2,
    forms_aux: canonical.forms.aux,
    syn_1_de: canonical.synonyms[0]?.de ?? "",
    syn_1_ru: canonical.synonyms[0]?.ru ?? "",
    syn_2_de: canonical.synonyms[1]?.de ?? "",
    syn_2_ru: canonical.synonyms[1]?.ru ?? "",
    syn_3_de: canonical.synonyms[2]?.de ?? "",
    syn_3_ru: canonical.synonyms[2]?.ru ?? "",
    ex_1_de: canonical.examples[0]?.de ?? "",
    ex_1_ru: canonical.examples[0]?.ru ?? "",
    ex_1_tag: canonical.examples[0]?.tag ?? "",
    ex_2_de: canonical.examples[1]?.de ?? "",
    ex_2_ru: canonical.examples[1]?.ru ?? "",
    ex_2_tag: canonical.examples[1]?.tag ?? "",
    ex_3_de: canonical.examples[2]?.de ?? "",
    ex_3_ru: canonical.examples[2]?.ru ?? "",
    ex_3_tag: canonical.examples[2]?.tag ?? "",
    ex_4_de: canonical.examples[3]?.de ?? "",
    ex_4_ru: canonical.examples[3]?.ru ?? "",
    ex_4_tag: canonical.examples[3]?.tag ?? "",
    ex_5_de: canonical.examples[4]?.de ?? "",
    ex_5_ru: canonical.examples[4]?.ru ?? "",
    ex_5_tag: canonical.examples[4]?.tag ?? "",
    boxes: canonical.boxes
  });

  const withBoxes = normalized.boxes?.length
    ? normalized
    : applySemanticLayoutToCard(normalized, defaultLayout.widthMm, defaultLayout.heightMm);

  const knownCardFields = new Set(Object.keys(emptyCard));
  const enforced = {
    ...withBoxes,
    boxes: (withBoxes.boxes ?? []).map((box) => {
      const normalizedField = normalizeFieldId(box.fieldId);
      const isRealField =
        knownCardFields.has(normalizedField) &&
        !["forms_rek", "synonyms", "examples", "custom_text"].includes(normalizedField);
      if (!isRealField) return box;
      return {
        ...box,
        textMode: "dynamic" as const,
        staticText: ""
      };
    })
  };

  return {
    ...enforced,
    meta: {
      ...(isRecord((source as { meta?: unknown }).meta)
        ? ((source as { meta?: Record<string, unknown> }).meta ?? {})
        : {}),
      originalSource: source,
      importSchema: schema,
      importIndex: index,
      canonical: {
        trCount: canonical.tr.length,
        examplesCount: canonical.examples.length,
        synonymsCount: canonical.synonyms.length
      }
    }
  };
};

const normalizeEntry = (item: unknown, schema: Exclude<SupportedSchema, "unknown">, index: number): InternalCard => {
  const source = isRecord(item) ? item : {};
  const canonical = toCanonicalCard(source, schema, index);
  return canonicalToInternalCard(canonical, source, schema, index);
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
  { name: "cards", match: (raw) => detectSchema(raw) === "cards", normalize: normalizeFromCards },
  { name: "array", match: (raw) => detectSchema(raw) === "array", normalize: normalizeFromArray },
  { name: "verbs", match: (raw) => detectSchema(raw) === "verbs", normalize: normalizeFromVerbs }
];

const buildUnknownSchemaError = (raw: unknown) => {
  const rootType = Array.isArray(raw) ? "array" : typeof raw;
  const keys = isRecord(raw) ? Object.keys(raw) : [];
  return new Error(
    `Unknown import schema. rootType=${rootType}; rootKeys=${keys.length ? keys.join(",") : "(none)"}; expected one of: {cards:[]}, [], {verbs:[]}, {data:[]}.`
  );
};

export const normalizeImportedJson = (raw: unknown): InternalCard[] => {
  console.log("Import stage A (detect schema)");
  const detectedSchema = detectSchema(raw);
  console.log("Import schema:", detectedSchema);
  const strategy = strategies.find((item) => item.match(raw));
  if (!strategy || detectedSchema === "unknown") {
    throw buildUnknownSchemaError(raw);
  }

  console.log("Import stage B (map to canonical)");
  const normalized = strategy.normalize(raw);

  console.log("Import stage C (fill defaults)");
  console.log("Normalized cards:", normalized.length);

  const first = normalized[0];
  if (first) {
    const source = isRecord(first.meta?.originalSource) ? (first.meta?.originalSource as Record<string, unknown>) : {};
    const sourceKeys = Object.keys(source);
    const recognized = ["inf", "title", "tr_1_ru", "tr_2_ru", "forms_p3", "forms_prat", "forms_p2", "forms_aux"].filter(
      (key) => Boolean((first as unknown as Record<string, unknown>)[key])
    );
    const filled = {
      inf: first.inf,
      title: first.title,
      translations: [first.tr_1_ru, first.tr_2_ru, first.tr_3_ru, first.tr_4_ru].filter(Boolean).length,
      forms: [first.forms_p3, first.forms_prat, first.forms_p2, first.forms_aux].filter(Boolean).length,
      synonyms: [first.syn_1_de, first.syn_2_de, first.syn_3_de, first.syn_1_ru, first.syn_2_ru, first.syn_3_ru].filter(Boolean).length,
      examples: [first.ex_1_de, first.ex_2_de, first.ex_3_de, first.ex_4_de, first.ex_5_de].filter(Boolean).length
    };

    console.log("Import first card source keys:", sourceKeys);
    console.log("Import first card recognized fields:", recognized);
    console.log("Import first card filled model:", filled);
  }

  return normalized;
};
