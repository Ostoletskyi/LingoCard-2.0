import { logger } from "../utils/logger";

const DEFAULT_ENDPOINT = "http://localhost:1234/v1/chat/completions";

export type LmStudioResponse = {
  choices?: { message?: { content?: string } }[];
};

export const requestCardFromLmStudio = async (
  prompt: { role: string; content: string },
  signal: AbortSignal,
  endpoint: string = DEFAULT_ENDPOINT
) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "local-model",
      messages: [prompt],
      temperature: 0.4
    }),
    signal
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error("LM Studio error", text);
    throw new Error(`LM Studio error: ${response.status}`);
  }

  const data = (await response.json()) as LmStudioResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty LM Studio response");
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    logger.error("Failed to parse LM Studio content", content);
    throw error;
  }
};
