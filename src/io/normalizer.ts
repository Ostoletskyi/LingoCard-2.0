import type { Card } from "../model/cardSchema";
import { normalizeCard } from "../model/cardSchema";
import { applySemanticLayoutToCard } from "../editor/semanticLayout";
import { defaultLayout } from "../model/layoutSchema";

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

const normalizeEntry = (
  item: unknown,
  schema: Exclude<SupportedSchema, "unknown">,
  index: number
): InternalCard => {
  const source = isRecord(item) ? item : {};
  const normalized = normalizeCard({
    ...source,
    id: typeof source.id === "string" && source.id.trim() ? source.id : deterministicId(schema, index, source)
  } as Partial<Card>);

  const withTitle =
    !normalized.title?.trim() && normalized.inf?.trim()
      ? { ...normalized, title: normalized.inf.trim() }
      : normalized;

  const withBoxes = withTitle.boxes?.length
    ? withTitle
    : applySemanticLayoutToCard(withTitle, defaultLayout.widthMm, defaultLayout.heightMm);

  return {
    ...withBoxes,
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

export const normalizeImportedJson = (raw: unknown): InternalCard[] => {
  const detectedSchema = detectSchema(raw);
  console.log("Import schema:", detectedSchema);
  const strategy = strategies.find((item) => item.match(raw));
  if (!strategy || detectedSchema === "unknown") {
    throw buildUnknownSchemaError(raw);
  }
  const normalized = strategy.normalize(raw);
  console.log("Normalized cards:", normalized.length);
  return normalized;
};
