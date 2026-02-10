import type { Card } from "../model/cardSchema";

export const buildPrompt = (infinitiv: string, mode: "generate" | "patch", card?: Card) => {
  if (mode === "patch" && card) {
    return {
      role: "user",
      content: `Patch the following card. Return JSON: {"patch": Partial<Card>, "errors"?: string[]} only. Existing card: ${JSON.stringify(
        card
      )}`
    };
  }
  return {
    role: "user",
    content: `Generate a German verb flashcard for infinitiv "${infinitiv}". Return ONLY valid JSON Card according to schema.`
  };
};
