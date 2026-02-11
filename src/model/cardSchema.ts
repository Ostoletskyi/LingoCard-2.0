import { z } from "zod";
import { BoxSchema, type Box } from "./layoutSchema";
import { normalizeFieldId } from "../utils/fieldAlias";

export const FrequencySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5)
]);

const translationSchema = {
  tr_1_ru: z.string(),
  tr_1_ctx: z.string(),
  tr_2_ru: z.string(),
  tr_2_ctx: z.string(),
  tr_3_ru: z.string(),
  tr_3_ctx: z.string(),
  tr_4_ru: z.string(),
  tr_4_ctx: z.string()
};

const formsSchema = {
  forms_p3: z.string(),
  forms_prat: z.string(),
  forms_p2: z.string(),
  forms_aux: z.enum(["haben", "sein", ""])
};

const synonymSchema = {
  syn_1_de: z.string(),
  syn_1_ru: z.string(),
  syn_2_de: z.string(),
  syn_2_ru: z.string(),
  syn_3_de: z.string(),
  syn_3_ru: z.string()
};

const examplesSchema = {
  ex_1_de: z.string(),
  ex_1_ru: z.string(),
  ex_1_tag: z.string(),
  ex_2_de: z.string(),
  ex_2_ru: z.string(),
  ex_2_tag: z.string(),
  ex_3_de: z.string(),
  ex_3_ru: z.string(),
  ex_3_tag: z.string(),
  ex_4_de: z.string(),
  ex_4_ru: z.string(),
  ex_4_tag: z.string(),
  ex_5_de: z.string(),
  ex_5_ru: z.string(),
  ex_5_tag: z.string()
};

const rektionSchema = {
  rek_1_de: z.string(),
  rek_1_ru: z.string(),
  rek_2_de: z.string(),
  rek_2_ru: z.string(),
  rek_3_de: z.string(),
  rek_3_ru: z.string(),
  rek_4_de: z.string(),
  rek_4_ru: z.string(),
  rek_5_de: z.string(),
  rek_5_ru: z.string()
};

export const CardSchema = z.object({
  id: z.string(),
  inf: z.string(),
  freq: FrequencySchema,
  tags: z.array(z.string()),
  ...translationSchema,
  ...formsSchema,
  ...synonymSchema,
  ...examplesSchema,
  ...rektionSchema,
  boxes: z.array(BoxSchema).optional()
});

export type Card = z.infer<typeof CardSchema>;

export const emptyCard: Card = {
  id: "",
  inf: "",
  freq: 3,
  tags: [],
  tr_1_ru: "",
  tr_1_ctx: "",
  tr_2_ru: "",
  tr_2_ctx: "",
  tr_3_ru: "",
  tr_3_ctx: "",
  tr_4_ru: "",
  tr_4_ctx: "",
  forms_p3: "",
  forms_prat: "",
  forms_p2: "",
  forms_aux: "",
  syn_1_de: "",
  syn_1_ru: "",
  syn_2_de: "",
  syn_2_ru: "",
  syn_3_de: "",
  syn_3_ru: "",
  ex_1_de: "",
  ex_1_ru: "",
  ex_1_tag: "",
  ex_2_de: "",
  ex_2_ru: "",
  ex_2_tag: "",
  ex_3_de: "",
  ex_3_ru: "",
  ex_3_tag: "",
  ex_4_de: "",
  ex_4_ru: "",
  ex_4_tag: "",
  ex_5_de: "",
  ex_5_ru: "",
  ex_5_tag: "",
  rek_1_de: "",
  rek_1_ru: "",
  rek_2_de: "",
  rek_2_ru: "",
  rek_3_de: "",
  rek_3_ru: "",
  rek_4_de: "",
  rek_4_ru: "",
  rek_5_de: "",
  rek_5_ru: "",
  boxes: []
};

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const normalizeImportedBoxes = (boxes: unknown): Box[] => {
  if (!Array.isArray(boxes)) return [];
  return boxes.map((raw, index) => {
    const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const style = source.style && typeof source.style === "object"
      ? source.style as Record<string, unknown>
      : {};
    const normalized: Box = {
      id: toString(source.id, `box_${index + 1}`),
      xMm: toNumber(source.xMm, 0),
      yMm: toNumber(source.yMm, 0),
      wMm: Math.max(1, toNumber(source.wMm, 20)),
      hMm: Math.max(1, toNumber(source.hMm, 8)),
      z: toNumber(source.z, index + 1),
      fieldId: normalizeFieldId(toString(source.fieldId, toString(source.id, `box_${index + 1}`))),
      style: {
        fontSizePt: Math.max(6, toNumber(style.fontSizePt ?? source.fontPt, 11)),
        fontWeight:
          style.fontWeight === "bold" || typeof style.fontWeight === "number"
            ? style.fontWeight
            : "normal",
        align:
          style.align === "center" || style.align === "right"
            ? style.align
            : "left",
        lineHeight: Math.max(1, toNumber(style.lineHeight, 1.2)),
        paddingMm: Math.max(0, toNumber(style.paddingMm, 0.6)),
        border: typeof style.border === "boolean" ? style.border : false,
        visible: typeof style.visible === "boolean" ? style.visible : true
      },
      rotateDeg: toNumber(source.rotateDeg, 0),
      locked: typeof source.locked === "boolean" ? source.locked : false,
      text: toString(source.text),
      staticText: toString(source.staticText),
      textMode:
        source.textMode === "static" || source.textMode === "dynamic"
          ? source.textMode
          : undefined,
      label: toString(source.label),
      label_i18n: toString(source.label_i18n),
      type: toString(source.type)
    };
    return normalized;
  });
};

export const normalizeCard = (input: Partial<Card>): Card => {
  const normalized: Card = {
    ...emptyCard,
    ...input,
    tags: input.tags ?? [],
    boxes: normalizeImportedBoxes(input.boxes)
  };
  if (!normalized.id) {
    normalized.id = crypto.randomUUID();
  }
  if (!normalized.freq) {
    normalized.freq = 3;
  }
  return normalized;
};
