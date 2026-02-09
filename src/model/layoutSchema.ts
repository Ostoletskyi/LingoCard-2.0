import { z } from "zod";

export const BoxStyleSchema = z.object({
  fontSizePt: z.number().nonnegative(),
  fontWeight: z.union([z.literal("normal"), z.literal("bold"), z.number()]),
  align: z.union([z.literal("left"), z.literal("center"), z.literal("right")]),
  lineHeight: z.number().positive(),
  paddingMm: z.number().nonnegative(),
  border: z.boolean().optional(),
  visible: z.boolean().optional()
});

export const BoxSchema = z.object({
  id: z.string(),
  xMm: z.number(),
  yMm: z.number(),
  wMm: z.number().positive(),
  hMm: z.number().positive(),
  rotateDeg: z.number().optional(),
  z: z.number(),
  fieldId: z.string(),
  style: BoxStyleSchema,
  locked: z.boolean().optional()
});

export type Box = z.infer<typeof BoxSchema>;

export const LayoutSchema = z.object({
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  boxes: z.array(BoxSchema)
});

export type Layout = z.infer<typeof LayoutSchema>;

export const defaultLayout: Layout = {
  widthMm: 150,
  heightMm: 105,
  boxes: [
    {
      id: "inf",
      xMm: 8,
      yMm: 8,
      wMm: 80,
      hMm: 10,
      z: 1,
      fieldId: "inf",
      style: {
        fontSizePt: 18,
        fontWeight: "bold",
        align: "left",
        lineHeight: 1.2,
        paddingMm: 0,
        border: false,
        visible: true
      }
    },
    {
      id: "tr_1_ru",
      xMm: 8,
      yMm: 22,
      wMm: 120,
      hMm: 8,
      z: 1,
      fieldId: "tr_1_ru",
      style: {
        fontSizePt: 12,
        fontWeight: "normal",
        align: "left",
        lineHeight: 1.3,
        paddingMm: 0,
        border: false,
        visible: true
      }
    }
  ]
};
