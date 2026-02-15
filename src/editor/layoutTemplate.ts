import type { Card } from "../model/cardSchema";
import type { Box } from "../model/layoutSchema";
import { normalizeFieldId } from "../utils/fieldAlias";
import { emptyCard } from "../model/cardSchema";

export type LayoutTemplate = {
  version: 1;
  cardSize: { widthMm: number; heightMm: number };
  boxes: Array<{
    fieldId: string;
    role?: string;
    xMm: number;
    yMm: number;
    wMm: number;
    hMm: number;
    z: number;
    style: Box["style"];
    rotateDeg?: number;
    locked?: boolean;
    textMode?: Box["textMode"];
    autoH?: boolean;
    minH?: number;
    maxH?: number;
    reservedRightPx?: number;
    label?: string;
    label_i18n?: string;
    type?: string;
  }>;
};

type BoxMatchRef = {
  box: Box;
  index: number;
};

type GroupedBoxes = Map<string, BoxMatchRef[]>;

const STATIC_SEMANTIC_FIELDS = new Set(["forms_rek", "synonyms", "examples", "custom_text"]);

const isRealCardField = (fieldId: string) => {
  const normalized = normalizeFieldId(fieldId);
  return normalized in emptyCard && !STATIC_SEMANTIC_FIELDS.has(normalized);
};

const getRoleToken = (box: Box) => box.type || box.label_i18n || box.label || "";

const getGroupKey = (fieldId: string, roleToken: string) => `${normalizeFieldId(fieldId)}::${roleToken}`;

const withOptional = <T extends object, K extends string, V>(base: T, key: K, value: V | undefined): T & { [P in K]?: V } => {
  if (value === undefined) return base as T & { [P in K]?: V };
  return { ...base, [key]: value } as T & { [P in K]?: V };
};

const groupBoxes = (boxes: Box[]): GroupedBoxes => {
  const groups: GroupedBoxes = new Map();
  boxes.forEach((box, index) => {
    const roleToken = getRoleToken(box);
    const key = getGroupKey(box.fieldId, roleToken);
    const list = groups.get(key) ?? [];
    list.push({ box, index });
    groups.set(key, list);
  });
  return groups;
};

export const extractLayoutTemplate = (card: Card, cardSize: { widthMm: number; heightMm: number }): LayoutTemplate => ({
  version: 1,
  cardSize,
  boxes: (card.boxes ?? []).map((box) => {
    const role = getRoleToken(box);
    const base = {
      fieldId: box.fieldId,
      xMm: box.xMm,
      yMm: box.yMm,
      wMm: box.wMm,
      hMm: box.hMm,
      z: box.z,
      style: structuredClone(box.style)
    };
    const withRole = withOptional(base, "role", role || undefined);
    const withRotate = withOptional(withRole, "rotateDeg", box.rotateDeg);
    const withLocked = withOptional(withRotate, "locked", box.locked);
    const withTextMode = withOptional(withLocked, "textMode", box.textMode);
    const withAutoH = withOptional(withTextMode, "autoH", box.autoH);
    const withMinH = withOptional(withAutoH, "minH", box.minH);
    const withMaxH = withOptional(withMinH, "maxH", box.maxH);
    const withReserved = withOptional(withMaxH, "reservedRightPx", box.reservedRightPx);
    const withLabel = withOptional(withReserved, "label", box.label);
    const withLabelI18n = withOptional(withLabel, "label_i18n", box.label_i18n);
    return withOptional(withLabelI18n, "type", box.type);
  })
});

const buildTemplateBox = (templateBox: LayoutTemplate["boxes"][number], fallbackId: string): Box => {
  const normalizedFieldId = normalizeFieldId(templateBox.fieldId);
  const realField = isRealCardField(normalizedFieldId);
  return {
    id: fallbackId,
    fieldId: normalizedFieldId,
    xMm: templateBox.xMm,
    yMm: templateBox.yMm,
    wMm: templateBox.wMm,
    hMm: templateBox.hMm,
    z: templateBox.z,
    style: structuredClone(templateBox.style),
    rotateDeg: templateBox.rotateDeg,
    locked: templateBox.locked,
    textMode: realField ? "dynamic" : templateBox.textMode,
    autoH: templateBox.autoH,
    minH: templateBox.minH,
    maxH: templateBox.maxH,
    reservedRightPx: templateBox.reservedRightPx,
    label: templateBox.label,
    label_i18n: templateBox.label_i18n,
    type: templateBox.type
  };
};

const patchBoxFormatting = (current: Box, templateBox: LayoutTemplate["boxes"][number]): Box => {
  const normalizedFieldId = normalizeFieldId(current.fieldId);
  const realField = isRealCardField(normalizedFieldId);
  return {
    ...current,
    fieldId: normalizeFieldId(templateBox.fieldId),
    xMm: templateBox.xMm,
    yMm: templateBox.yMm,
    wMm: templateBox.wMm,
    hMm: templateBox.hMm,
    z: templateBox.z,
    style: structuredClone(templateBox.style),
    rotateDeg: templateBox.rotateDeg,
    locked: templateBox.locked,
    textMode: realField ? "dynamic" : templateBox.textMode,
    autoH: templateBox.autoH ?? current.autoH,
    minH: templateBox.minH ?? current.minH,
    maxH: templateBox.maxH ?? current.maxH,
    reservedRightPx: templateBox.reservedRightPx ?? current.reservedRightPx,
    label: templateBox.label,
    label_i18n: templateBox.label_i18n,
    type: templateBox.type
  };
};

export const applyLayoutTemplate = (card: Card, template: LayoutTemplate): Card => {
  const currentBoxes = card.boxes ?? [];
  const groups = groupBoxes(currentBoxes);
  const usedIndices = new Set<number>();

  const nextTemplateOrdered: Box[] = template.boxes.map((tpl) => {
    const roleToken = tpl.role ?? "";
    const key = getGroupKey(tpl.fieldId, roleToken);
    const candidates = groups.get(key) ?? [];
    const candidate = candidates.find((item) => !usedIndices.has(item.index));
    if (candidate) {
      usedIndices.add(candidate.index);
      return patchBoxFormatting(candidate.box, tpl);
    }
    const fallbackId = `${normalizeFieldId(tpl.fieldId)}_${crypto.randomUUID().slice(0, 8)}`;
    return buildTemplateBox(tpl, fallbackId);
  });

  const untouched = currentBoxes.filter((_, index) => !usedIndices.has(index));
  const merged = [...nextTemplateOrdered, ...untouched].map((box, index) => ({ ...box, z: index + 1 }));

  return {
    ...card,
    boxes: merged
  };
};
