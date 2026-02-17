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


const DEBUG_IMPORT =
  typeof window !== "undefined" && window.localStorage.getItem("DEBUG_IMPORT") === "1";

const BOX_LIMITS = {
  xMm: { min: 0, max: 400 },
  yMm: { min: 0, max: 400 },
  wMm: { min: 1, max: 400 },
  hMm: { min: 1, max: 400 }
} as const;

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

const pickObject = (source: Record<string, unknown>, keys: string[]): Record<string, unknown> | null => {
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) return value;
  }
  return null;
};

const normalizeAux = (value: string): "haben" | "sein" | "" => {
  const token = value.trim().toLowerCase();
  if (["haben", "hat"].includes(token)) return "haben";
  if (["sein", "ist"].includes(token)) return "sein";
  return "";
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


const warnInvariant = (message: string, details?: unknown) => {
  console.warn("[Import][Invariant]", message, details ?? "");
};

const sanitizeCanonicalBox = (boxRaw: unknown, index: number): CanonicalBox => {
  const source = isRecord(boxRaw) ? boxRaw : {};

  const rawX = Number.isFinite(source.xMm) ? Number(source.xMm) : 0;
  const rawY = Number.isFinite(source.yMm) ? Number(source.yMm) : 0;
  const rawW = Number.isFinite(source.wMm) && Number(source.wMm) > 0 ? Number(source.wMm) : 20;
  const rawH = Number.isFinite(source.hMm) && Number(source.hMm) > 0 ? Number(source.hMm) : 8;

  const align = source.align === "left" || source.align === "center" || source.align === "right"
    ? source.align
    : undefined;

  const safe: CanonicalBox = {
    id: toString(source.id) || `box_${index + 1}`,
    fieldId: normalizeFieldId(toString(source.fieldId) || "custom_text"),
    xMm: clampNumber(rawX, BOX_LIMITS.xMm.min, BOX_LIMITS.xMm.max),
    yMm: clampNumber(rawY, BOX_LIMITS.yMm.min, BOX_LIMITS.yMm.max),
    wMm: clampNumber(rawW, BOX_LIMITS.wMm.min, BOX_LIMITS.wMm.max),
    hMm: clampNumber(rawH, BOX_LIMITS.hMm.min, BOX_LIMITS.hMm.max),
    ...(typeof source.fontPt === "number" ? { fontPt: source.fontPt } : {}),
    ...(typeof source.lineHeight === "number" ? { lineHeight: source.lineHeight } : {}),
    ...(typeof source.paddingMm === "number" ? { paddingMm: source.paddingMm } : {}),
    ...(align ? { align } : {}),
    ...(typeof source.autoH === "boolean" ? { autoH: source.autoH } : {}),
    ...(typeof source.reservedRightMm === "number" ? { reservedRightMm: source.reservedRightMm } : {})
  };

  if (safe.xMm !== rawX || safe.yMm !== rawY || safe.wMm !== rawW || safe.hMm !== rawH) {
    warnInvariant("Box geometry out of bounds, clamped", {
      id: safe.id,
      raw: { xMm: rawX, yMm: rawY, wMm: rawW, hMm: rawH },
      safe
    });
  }

  return safe;
};


const enforceCanonicalInvariants = (card: CanonicalCard): CanonicalCard => {
  const freq = card.freq == null ? null : Number(card.freq);
  const safeFreq = freq == null ? null : (freq >= 1 && freq <= 5 ? Math.round(freq) : null);
  if (freq !== safeFreq) {
    warnInvariant("freq must be null or 1..5", { id: card.id, freq: card.freq });
  }

  const safeFormsAux =
    card.forms.aux === "haben" || card.forms.aux === "sein" || card.forms.aux === ""
      ? card.forms.aux
      : "";
  if (card.forms.aux !== undefined && card.forms.aux !== safeFormsAux) {
    warnInvariant("forms.aux must be haben|sein|''", { id: card.id, aux: card.forms.aux });
  }

  return {
    ...card,
    canonicalVersion: 1,
    id: card.id || crypto.randomUUID(),
    inf: typeof card.inf === "string" ? card.inf : "",
    title: typeof card.title === "string" ? card.title : "",
    freq: safeFreq,
    tags: Array.isArray(card.tags) ? card.tags.filter((tag): tag is string => typeof tag === "string") : [],
    tr: Array.isArray(card.tr)
      ? card.tr
          .filter((item): item is { value: string; ctx?: string } => Boolean(item && typeof item.value === "string"))
          .slice(0, 4)
      : [],
    forms: {
      ...(typeof card.forms.p3 === "string" ? { p3: card.forms.p3 } : {}),
      ...(typeof card.forms.praet === "string" ? { praet: card.forms.praet } : {}),
      ...(typeof card.forms.p2 === "string" ? { p2: card.forms.p2 } : {}),
      ...(card.forms.aux !== undefined ? { aux: safeFormsAux } : {}),
      ...(typeof card.forms.service === "string" ? { service: card.forms.service } : {}),
      ...(typeof card.forms.perfektFull === "string" ? { perfektFull: card.forms.perfektFull } : {})
    },
    synonyms: Array.isArray(card.synonyms)
      ? card.synonyms
          .filter((item): item is { de: string; ru?: string } => Boolean(item && typeof item.de === "string"))
          .slice(0, 3)
      : [],
    examples: Array.isArray(card.examples)
      ? card.examples
          .filter((item): item is { de: string; ru?: string; tag?: string } => Boolean(item && typeof item.de === "string"))
          .slice(0, 5)
      : [],
    recommendations: Array.isArray(card.recommendations)
      ? card.recommendations
          .filter((item): item is { de: string; ru?: string } => Boolean(item && typeof item.de === "string"))
          .slice(0, 5)
      : [],
    boxes: Array.isArray(card.boxes) ? card.boxes.map((box, index) => sanitizeCanonicalBox(box, index)) : []
  };
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

  const examplesArray = pickArray(root, ["examples", "example"])
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const de = pickString(entry, ["de", "text", "source"]);
      const ru = pickString(entry, ["ru", "translation", "target"]);
      const tag = pickString(entry, ["tag", "label"]);
      if (!de && !ru) return null;
      return { de, ...(ru ? { ru } : {}), ...(tag ? { tag } : {}) };
    })
    .filter((entry): entry is { de: string; ru?: string; tag?: string } => Boolean(entry));

  const examplesObject = pickObject(root, ["examples"]);
  const examplesFromObject = examplesObject
    ? Object.entries(examplesObject)
        .map(([key, value]) => {
          if (!isRecord(value)) return null;
          const de = pickString(value, ["de", "text", "source"]);
          const ru = pickString(value, ["ru", "translation", "target"]);
          const tag = pickString(value, ["tag", "label"]) || key;
          if (!de && !ru) return null;
          return { de, ...(ru ? { ru } : {}), ...(tag ? { tag } : {}) };
        })
        .filter((entry): entry is { de: string; ru?: string; tag?: string } => Boolean(entry))
    : [];

  const examples = examplesArray.length ? examplesArray : examplesFromObject;
  const recommendationsFromArray = pickArray(root, ["recommendations", "rektion", "rek"])
    .map((entry) => {
      if (typeof entry === "string") {
        const de = entry.trim();
        return de ? { de } : null;
      }
      if (!isRecord(entry)) return null;
      const de = pickString(entry, ["de", "text", "source"]);
      const ru = pickString(entry, ["ru", "translation", "target"]);
      if (!de && !ru) return null;
      return { de, ...(ru ? { ru } : {}) };
    })
    .filter((entry): entry is { de: string; ru?: string } => Boolean(entry));

  const recommendationsDirect = [1,2,3,4,5]
    .map((idx) => ({
      de: pickString(root, [`rek_${idx}_de`]),
      ru: pickString(root, [`rek_${idx}_ru`])
    }))
    .filter((entry) => Boolean(entry.de || entry.ru));

  const rawAux = pickString({ ...forms, ...root }, ["forms_aux", "aux", "auxiliary"]);
  const aux = normalizeAux(rawAux);

  const inf = pickString(root, ["inf", "infinitive", "lemma", "verb", "word", "de"]);
  const title = pickString(root, ["title", "name"]) || inf;
  const freqRaw = Number(root.freq ?? root.frequency);

  return {
    canonicalVersion: 1,
    id: typeof source.id === "string" && source.id.trim() ? source.id : deterministicId(schema, index, source),
    title,
    inf,
    freq: Number.isFinite(freqRaw) && freqRaw >= 1 && freqRaw <= 5 ? Math.round(freqRaw) : null,
    tags: [
      ...(Array.isArray(root.tags) ? root.tags.filter((tag): tag is string => typeof tag === "string") : []),
      ...(Array.isArray(root.prefixes) ? root.prefixes.filter((tag): tag is string => typeof tag === "string") : [])
    ].slice(0, 12),
    tr: trFromArray.length ? trFromArray.slice(0, 4) : trDirect.slice(0, 4),
    forms: {
      p3: pickString({ ...forms, ...root }, ["forms_p3", "p3", "present3", "praesens3", "praesens_3"]),
      praet: pickString({ ...forms, ...root }, ["forms_prat", "forms_praet", "prat", "praet", "praeteritum", "präteritum", "preterite", "past"]),
      p2: pickString({ ...forms, ...root }, ["forms_p2", "p2", "partizip2", "partizip_2", "participle2"]),
      aux,
      service: pickString({ ...forms, ...root }, ["forms_service", "service", "times_service"]),
      perfektFull: pickString({ ...forms, ...root }, ["forms_perfekt_full", "perfekt_full", "perfect_full"])
    },
    synonyms: synonyms.slice(0, 3),
    examples: examples.slice(0, 5),
    recommendations: (recommendationsFromArray.length ? recommendationsFromArray : recommendationsDirect).slice(0, 5),
    boxes: Array.isArray(root.boxes) ? root.boxes.map((box, boxIndex) => sanitizeCanonicalBox(box, boxIndex)) : []
  };
};

const pickCanonicalBox = (box: unknown, index: number): CanonicalBox => sanitizeCanonicalBox(box, index);

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
    boxes: (canonicalRaw.boxes ?? []).map((box, boxIndex) => pickCanonicalBox(box, boxIndex))
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
    forms_service:
      canonical.forms.service ??
      [canonical.forms.p3, canonical.forms.praet, canonical.forms.perfektFull || canonical.forms.p2]
        .filter((part) => typeof part === "string" && part.trim().length > 0)
        .join(" / "),
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
    rek_1_de: canonical.recommendations[0]?.de ?? "",
    rek_1_ru: canonical.recommendations[0]?.ru ?? "",
    rek_2_de: canonical.recommendations[1]?.de ?? "",
    rek_2_ru: canonical.recommendations[1]?.ru ?? "",
    rek_3_de: canonical.recommendations[2]?.de ?? "",
    rek_3_ru: canonical.recommendations[2]?.ru ?? "",
    rek_4_de: canonical.recommendations[3]?.de ?? "",
    rek_4_ru: canonical.recommendations[3]?.ru ?? "",
    rek_5_de: canonical.recommendations[4]?.de ?? "",
    rek_5_ru: canonical.recommendations[4]?.ru ?? "",
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

  if (DEBUG_IMPORT && index === 0) {
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
  const canonical = enforceCanonicalInvariants(toCanonicalCard(item, schema, index));
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
  if (DEBUG_IMPORT) console.log("Import stage A (detect schema)");
  const detectedSchema = detectSchema(raw);
  if (DEBUG_IMPORT) console.log("Import schema:", detectedSchema);
  const strategy = strategies.find((item) => item.match(raw));
  if (!strategy || detectedSchema === "unknown") {
    throw buildUnknownSchemaError(raw);
  }

  if (DEBUG_IMPORT) console.log("Import stage B (map to canonical)");
  const normalized = strategy.normalize(raw);

  if (DEBUG_IMPORT) console.log("Import stage C (fill defaults)");
  if (DEBUG_IMPORT) console.log("Normalized cards:", normalized.length);
  return normalized;
};
