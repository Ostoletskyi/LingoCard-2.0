import { CardSchema, type Card } from "../model/cardSchema";
import { z } from "zod";

const PatchSchema = z.object({
  patch: CardSchema.partial(),
  errors: z.array(z.string()).optional()
});

export const validateAiPayload = (
  payload: unknown,
  mode: "generate" | "patch"
): { success: true; data: Card } | { success: false; error: string } => {
  try {
    if (mode === "patch") {
      PatchSchema.parse(payload);
      return { success: false, error: "Patch mode requires apply logic" };
    }
    const card = CardSchema.parse(payload);
    return { success: true, data: card };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Unknown error" };
  }
};
