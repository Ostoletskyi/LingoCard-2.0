import type { Card } from "../model/cardSchema";
import { emptyCard, normalizeCard } from "../model/cardSchema";
import { applySemanticLayoutToCard } from "../editor/semanticLayout";
import { defaultLayout, type Box } from "../model/layoutSchema";
import { normalizeFieldId } from "../utils/fieldAlias";
import type { CanonicalBox, CanonicalCard } from "../normalizer/canonicalTypes";
import { ensureTemplateBoxes } from "../normalizer/ensureTemplate";

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

const toCanonicalCard = (
  item: unknown,
  schema: Exclude<SupportedSchema, "unknown">,
  index: number
): CanonicalCard => {
  const source = isRecord(item) ? item : {};
  const root = isRecord(source.verb) ? source.verb : source;
  const forms = isRecord(root.forms) ? root.forms : {};

  const translationSource = pickArray(root, ["translations", "tr", "meanings", "translation"]);
  const trFromArray = translationSource
    .map((entry) => {
      if (typeof entry === "string") return { value: entry.trim() };
      if (!isRecord(entry)) return null;
      const value = pickString(entry, ["ru", "translation", "text", "value"]);
      const ctx = pickString(entry, ["ctx", "context", "note"]);
      return value ? { value, ...(ctx ? { ctx } : {}) } : null;
    })
    .filter((entry): entry is { value: string; ctx?: string } => Boolean(entry));

  const trDirect = [
    {
      value: pickString(root, ["tr_1_ru", "translation_ru", "translation", "ru", "meaning_ru"]),
      ctx: pickString(root, ["tr_1_ctx", "translation_ctx", "meaning_ctx"])
    },
    { value: pickString(root, ["tr_2_ru", "translation_2_ru", "meaning_2_ru"]), ctx: pickString(root, ["tr_2_ctx"]) },
    { value: pickString(root, ["tr_3_ru", "translation_3_ru", "meaning_3_ru"]), ctx: pickString(root, ["tr_3_ctx"]) },
    { value: pickString(root, ["tr_4_ru", "translation_4_ru", "meaning_4_ru"]), ctx: pickString(root, ["tr_4_ctx"]) }
  ]
    .filter((entry) => Boolean(entry.value))
    .map((entry) => ({ value: entry.value, ...(entry.ctx ? { ctx: entry.ctx } : {}) }));

  const synonyms = pickArray(root, ["synonyms", "syn"])
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const de = pickString(entry, ["de", "word", "lemma"]);
      const ru = pickString(entry, ["ru", "translation", "value"]);
      if (!de && !ru) return null;
      return { de, ...(ru ? { ru } : {}) };
    })
    .filter((entry): entry is { de: string; ru?: string } => Boolean(entry));

  // Examples can be stored as an array OR as an object keyed by tense.
  // verbs_rich.fixed.json uses: examples: { praesens:{...}, modal:{...}, praeteritum:{...}, perfekt:{...} }
  const examplesRaw = root.examples ?? root.example;
  const examplesArray = Array.isArray(examplesRaw) ? examplesRaw : [];

  const examplesFromArray = examplesArray
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const de = pickString(entry, ["de", "text", "source", "sentence"]);
      const ru = pickString(entry, ["ru", "translation", "target"]);
      const tag = pickString(entry, ["tag", "label", "type"]);
      if (!de && !ru) return null;
      return { de, ...(ru ? { ru } : {}), ...(tag ? { tag } : {}) };
    })
    .filter((entry): entry is { de: string; ru?: string; tag?: string } => Boolean(entry));

  const examplesFromObject = isRecord(examplesRaw)
    ? (["praesens", "modal", "praeteritum", "perfekt"] as const)
        .map((key) => {
          const entry = (examplesRaw as Record<string, unknown>)[key];
          if (!isRecord(entry)) return null;
          const de = pickString(entry, ["de", "text", "source", "sentence"]);
          const ru = pickString(entry, ["ru", "translation", "target"]);
          if (!de && !ru) return null;
          return { de, ...(ru ? { ru } : {}), tag: key };
        })
        .filter((entry): entry is { de: string; ru?: string; tag: string } => Boolean(entry))
    : [];

  const examples = (examplesFromArray.length ? examplesFromArray : examplesFromObject).slice(0, 5);

  const rawAux = pickString({ ...forms, ...root }, ["forms_aux", "aux", "auxiliary", "hilfsverb", "helper"]);
  const aux = rawAux === "haben" || rawAux === "sein" ? rawAux : "";

  // NOTE: import may come from multiple schemas; keep this list liberal.
  const inf = pickString(root, ["inf", "infinitive", "lemma", "verb", "word", "de", "Infinitiv"]);
  const title = pickString(root, ["title", "name"]) || inf;
  // Some sources use "frequency" instead of "freq".
  const freqRaw = Number((root.frequency ?? root.freq) as unknown);

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id : deterministicId(schema, index, source),
    title,
    inf,
    freq: Number.isFinite(freqRaw) && freqRaw >= 1 && freqRaw <= 5 ? Math.round(freqRaw) : null,
    tags: Array.isArray(root.tags) ? root.tags.filter((tag): tag is string => typeof tag === "string") : [],
    tr: trFromArray.length ? trFromArray.slice(0, 4) : trDirect.slice(0, 4),
    forms: {
      // Be generous: different datasets name these differently.
      p3: pickString({ ...forms, ...root }, [
        "forms_p3",
        "p3",
        "present3",
        "praesens3",
        "praesens_3",
        "praesens3sg",
        "präsens_3",
        "praesens3Sg"
      ]),
      praet: pickString({ ...forms, ...root }, [
        "forms_prat",
        "forms_prät",
        "prat",
        "prät",
        "praet",
        "praeteritum",
        "präteritum",
        "preterite",
        "past"
      ]),
      p2: pickString({ ...forms, ...root }, [
        "forms_p2",
        "p2",
        "partizip2",
        "partizip_2",
        "partizipii",
        "partizip_ii",
        "PartizipII",
        "participle2"
      ]),
      aux
    },
    synonyms: synonyms.slice(0, 3),
    examples: examples.slice(0, 5),
    boxes: Array.isArray(root.boxes) ? (root.boxes as CanonicalBox[]) : []
  };
};

const pickCanonicalBox = (box: CanonicalBox): CanonicalBox => ({
  id: String(box.id || `box_${crypto.randomUUID().slice(0, 8)}`),
  fieldId: normalizeFieldId(String(box.fieldId || "custom_text")),
  xMm: Number.isFinite(box.xMm) ? box.xMm : 0,
  yMm: Number.isFinite(box.yMm) ? box.yMm : 0,
  wMm: Number.isFinite(box.wMm) ? Math.max(1, box.wMm) : 20,
  hMm: Number.isFinite(box.hMm) ? Math.max(1, box.hMm) : 8,
  ...(typeof box.fontPt === "number" ? { fontPt: box.fontPt } : {}),
  ...(typeof box.lineHeight === "number" ? { lineHeight: box.lineHeight } : {}),
  ...(typeof box.paddingMm === "number" ? { paddingMm: box.paddingMm } : {}),
  ...(box.align ? { align: box.align } : {}),
  ...(typeof box.autoH === "boolean" ? { autoH: box.autoH } : {}),
  ...(typeof box.reservedRightMm === "number" ? { reservedRightMm: box.reservedRightMm } : {})
});

const canonicalBoxToInternalBox = (box: CanonicalBox, index: number): Box => ({
  id: box.id,
  fieldId: box.fieldId,
  xMm: box.xMm,
  yMm: box.yMm,
  wMm: box.wMm,
  hMm: box.hMm,
  z: index + 1,
  style: {
    fontSizePt: box.fontPt ?? 11,
    fontWeight: "normal",
    align: box.align ?? "left",
    lineHeight: box.lineHeight ?? 1.2,
    paddingMm: box.paddingMm ?? 0.8,
    border: false,
    visible: true
  },
  autoH: box.autoH,
  reservedRightPx: typeof box.reservedRightMm === "number" ? box.reservedRightMm * 3.7795 : undefined,
  textMode: "dynamic",
  type: box.id
});

const canonicalToInternalCard = (
  canonicalRaw: CanonicalCard,
  schema: Exclude<SupportedSchema, "unknown">,
  index: number
): InternalCard => {
  const canonical = ensureTemplateBoxes({
    ...canonicalRaw,
    boxes: (canonicalRaw.boxes ?? []).map((box) => pickCanonicalBox(box))
  });

  const internal = normalizeCard({
    id: canonical.id,
    title: canonical.title,
    inf: canonical.inf,
    freq: ((canonical.freq ?? 0) >= 1 && (canonical.freq ?? 0) <= 5 ? canonical.freq ?? 0 : 0) as Card["freq"],
    tags: canonical.tags,
    tr_1_ru: canonical.tr[0]?.value ?? "",
    tr_1_ctx: canonical.tr[0]?.ctx ?? "",
    tr_2_ru: canonical.tr[1]?.value ?? "",
    tr_2_ctx: canonical.tr[1]?.ctx ?? "",
    tr_3_ru: canonical.tr[2]?.value ?? "",
    tr_3_ctx: canonical.tr[2]?.ctx ?? "",
    tr_4_ru: canonical.tr[3]?.value ?? "",
    tr_4_ctx: canonical.tr[3]?.ctx ?? "",
    forms_p3: canonical.forms.p3 ?? "",
    forms_prat: canonical.forms.praet ?? "",
    forms_p2: canonical.forms.p2 ?? "",
    forms_aux: canonical.forms.aux ?? "",
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
    translations: canonical.tr,
    forms: canonical.forms,
    synonyms: canonical.synonyms,
    examples: canonical.examples,
    boxes: canonical.boxes.map((box, boxIndex) => canonicalBoxToInternalBox(box, boxIndex))
  });

  const withLayout = internal.boxes?.length
    ? internal
    : applySemanticLayoutToCard(internal, defaultLayout.widthMm, defaultLayout.heightMm);

  const knownCardFields = new Set(Object.keys(emptyCard));
  const enforced = {
    ...withLayout,
    boxes: (withLayout.boxes ?? []).map((box) => {
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

  if (index === 0) {
    console.log("[Import] canonical sample", canonical);
    console.log("[Import] internal sample", enforced);
    console.log("Mapped card:", enforced);
  }

  return {
    ...enforced,
    meta: {
      importSchema: schema,
      importIndex: index
    }
  };
};

const normalizeEntry = (item: unknown, schema: Exclude<SupportedSchema, "unknown">, index: number): InternalCard => {
  const canonical = toCanonicalCard(item, schema, index);
  return canonicalToInternalCard(canonical, schema, index);
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
  return normalized;
};
