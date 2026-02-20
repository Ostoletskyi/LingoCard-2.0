import { logger } from "../utils/logger";
import { buildGenerateMessages, buildRepairMessages, type AiInputLanguage, type ChatMessage } from "./promptBuilder";
import { DEFAULT_LM_STUDIO_CONFIG, normalizeLmStudioConfig, type LmStudioConfig } from "./aiConfig";

type LmStudioModelsResponse = {
  data?: Array<{ id?: string }>;
};

type LmStudioChatResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

export class LmStudioClientError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "CONNECTION_REFUSED"
      | "TIMEOUT"
      | "HTTP"
      | "CORS"
      | "INVALID_RESPONSE"
      | "EMPTY_CONTENT"
      | "PARSE_ERROR",
    public readonly details?: string,
    public readonly rawContent?: string
  ) {
    super(message);
    this.name = "LmStudioClientError";
  }
}

let healthCache: { key: string; expiresAt: number; result: { ok: boolean; details: string } } | null = null;

const HEALTH_TTL_MS = 20_000;

const buildUrl = (baseUrl: string, path: "/v1/models" | "/v1/chat/completions") =>
  new URL(path, `${baseUrl.replace(/\/+$/, "")}/`).toString();

const withTimeoutSignal = (parentSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  if (parentSignal) {
    parentSignal.addEventListener("abort", () => controller.abort(parentSignal.reason), { once: true });
  }
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return controller.signal;
};

const normalizeFetchError = (error: unknown): LmStudioClientError => {
  if (error instanceof LmStudioClientError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new LmStudioClientError("Request timeout", "TIMEOUT", "Request was aborted or timed out");
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout/i.test(message)) {
    return new LmStudioClientError(
      "LM Studio request timeout. Increase timeout or use a smaller/faster model.",
      "TIMEOUT",
      message
    );
  }
  if (/failed to fetch/i.test(message)) {
    return new LmStudioClientError(
      "LM Studio API unavailable. Check that API server is running and base URL/port are correct.",
      "CONNECTION_REFUSED",
      message
    );
  }
  if (/cors/i.test(message)) {
    return new LmStudioClientError("CORS blocked request to LM Studio API", "CORS", message);
  }
  return new LmStudioClientError("Unexpected LM Studio request error", "INVALID_RESPONSE", message);
};

const fetchJson = async <T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries = 0,
  signal?: AbortSignal
): Promise<T> => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: withTimeoutSignal(signal, timeoutMs)
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new LmStudioClientError(
          `LM Studio API returned HTTP ${response.status}`,
          "HTTP",
          bodyText
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      const normalized = normalizeFetchError(error);
      if (attempt >= retries) throw normalized;
      attempt += 1;
      logger.warn("LM Studio request retry", { url, attempt, code: normalized.code });
    }
  }
  throw new LmStudioClientError("Unreachable request state", "INVALID_RESPONSE");
};

const extractContent = (response: LmStudioChatResponse): string => {
  const content = response.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new LmStudioClientError("LM Studio returned empty content", "EMPTY_CONTENT", response.error?.message);
  }
  return content.trim();
};

const parseJsonContent = (content: string) => {
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new LmStudioClientError("LM Studio returned non-JSON content", "PARSE_ERROR", details, content);
  }
};

export const listModels = async (
  config: Partial<LmStudioConfig> = {},
  signal?: AbortSignal
): Promise<string[]> => {
  const merged = normalizeLmStudioConfig({ ...DEFAULT_LM_STUDIO_CONFIG, ...config });
  const url = buildUrl(merged.baseUrl, "/v1/models");
  const response = await fetchJson<LmStudioModelsResponse>(url, { method: "GET" }, merged.timeoutMs, 0, signal);
  return (response.data ?? []).map((item) => item.id ?? "").filter(Boolean);
};

export const healthCheck = async (
  config: Partial<LmStudioConfig> = {},
  signal?: AbortSignal
): Promise<{ ok: boolean; details: string }> => {
  const merged = normalizeLmStudioConfig({ ...DEFAULT_LM_STUDIO_CONFIG, ...config });
  const cacheKey = `${merged.baseUrl}`;
  if (healthCache && healthCache.key === cacheKey && Date.now() < healthCache.expiresAt) {
    return healthCache.result;
  }

  try {
    const models = await listModels(merged, signal);
    const result = {
      ok: true,
      details: models.length
        ? `LM Studio API online (${models.length} model(s) available)`
        : "LM Studio API online (no models reported)"
    };
    healthCache = { key: cacheKey, expiresAt: Date.now() + HEALTH_TTL_MS, result };
    return result;
  } catch (error) {
    const normalized = normalizeFetchError(error);
    const result = { ok: false, details: normalized.message };
    healthCache = { key: cacheKey, expiresAt: Date.now() + 5000, result };
    return result;
  }
};

const requestChatCompletion = async (
  messages: ChatMessage[],
  config: Partial<LmStudioConfig>,
  signal?: AbortSignal
): Promise<{ payload: unknown; rawContent: string }> => {
  const merged = normalizeLmStudioConfig({ ...DEFAULT_LM_STUDIO_CONFIG, ...config });
  const url = buildUrl(merged.baseUrl, "/v1/chat/completions");
  logger.info("LM Studio request", { endpoint: url, model: merged.model });

  const response = await fetchJson<LmStudioChatResponse>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: merged.model,
        messages,
        temperature: merged.temperature,
        stream: false
      })
    },
    merged.timeoutMs,
    1,
    signal
  );

  const rawContent = extractContent(response);
  return { payload: parseJsonContent(rawContent), rawContent };
};

export const repairJsonWithLmStudio = async (
  rawContent: string,
  config: Partial<LmStudioConfig>,
  signal?: AbortSignal
): Promise<{ payload: unknown; rawContent: string }> => {
  return requestChatCompletion(buildRepairMessages(rawContent), config, signal);
};

export const requestCardFromLmStudio = async (
  infinitive: string,
  signal: AbortSignal,
  config: Partial<LmStudioConfig> = {},
  inputLanguage: AiInputLanguage = "ALL"
): Promise<{ payload: unknown; rawContent: string; repaired: boolean }> => {
  try {
    const firstPass = await requestChatCompletion(buildGenerateMessages(infinitive, inputLanguage), config, signal);
    return { ...firstPass, repaired: false };
  } catch (error) {
    const normalized = normalizeFetchError(error);
    if (normalized.code !== "PARSE_ERROR" || !normalized.rawContent) {
      throw normalized;
    }
    const repaired = await repairJsonWithLmStudio(normalized.rawContent, config, signal);
    return { ...repaired, repaired: true };
  }
};
