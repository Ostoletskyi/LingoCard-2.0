import type { Box } from "../model/layoutSchema";

export const snapToGrid = (valueMm: number, gridMm: number) => {
  if (gridMm <= 0) return valueMm;
  return Math.round(valueMm / gridMm) * gridMm;
};

export const moveBox = (box: Box, deltaXMm: number, deltaYMm: number): Box => ({
  ...box,
  xMm: box.xMm + deltaXMm,
  yMm: box.yMm + deltaYMm
});
