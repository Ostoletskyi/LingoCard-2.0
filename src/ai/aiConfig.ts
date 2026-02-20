export type LmStudioConfig = {
  baseUrl: string;
  model: string;
  temperature: number;
  timeoutMs: number;
};

export const AI_CONFIG_STORAGE_KEY = "lc.ai.lmstudio.config";

export const DEFAULT_LM_STUDIO_CONFIG: LmStudioConfig = {
  baseUrl: "http://localhost:1234",
  model: "local-model",
  temperature: 0.4,
  timeoutMs: 30000
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const normalizeLmStudioConfig = (input: Partial<LmStudioConfig> | null | undefined): LmStudioConfig => {
  const baseUrl = (input?.baseUrl || DEFAULT_LM_STUDIO_CONFIG.baseUrl).trim().replace(/\/+$/, "");
  return {
    baseUrl: baseUrl || DEFAULT_LM_STUDIO_CONFIG.baseUrl,
    model: (input?.model || DEFAULT_LM_STUDIO_CONFIG.model).trim() || DEFAULT_LM_STUDIO_CONFIG.model,
    temperature: clamp(Number.isFinite(input?.temperature) ? Number(input?.temperature) : DEFAULT_LM_STUDIO_CONFIG.temperature, 0, 1.5),
    timeoutMs: clamp(Number.isFinite(input?.timeoutMs) ? Number(input?.timeoutMs) : DEFAULT_LM_STUDIO_CONFIG.timeoutMs, 5000, 120000)
  };
};

export const loadLmStudioConfig = (): LmStudioConfig => {
  if (typeof window === "undefined") return DEFAULT_LM_STUDIO_CONFIG;
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_LM_STUDIO_CONFIG;
    return normalizeLmStudioConfig(JSON.parse(raw) as Partial<LmStudioConfig>);
  } catch {
    return DEFAULT_LM_STUDIO_CONFIG;
  }
};

export const saveLmStudioConfig = (config: LmStudioConfig) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(normalizeLmStudioConfig(config)));
};
