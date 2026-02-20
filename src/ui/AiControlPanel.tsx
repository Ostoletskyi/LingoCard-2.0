import { useEffect, useMemo, useRef, useState } from "react";
import { healthCheck, listModels, repairJsonWithLmStudio, requestCardFromLmStudio, LmStudioClientError } from "../ai/lmStudioClient";
import { validateAiPayload } from "../ai/validateAiResponse";
import { useAppStore } from "../state/store";
import { loadLmStudioConfig, normalizeLmStudioConfig, saveLmStudioConfig, type LmStudioConfig } from "../ai/aiConfig";

export const AiControlPanel = () => {
  const [infinitives, setInfinitives] = useState("");
  const [mode, setMode] = useState<"generate" | "patch">("generate");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [responseJson, setResponseJson] = useState<string>("");
  const [rawResponse, setRawResponse] = useState<string>("");
  const [errorText, setErrorText] = useState<string>("");
  const [healthText, setHealthText] = useState<string>("");
  const [config, setConfig] = useState<LmStudioConfig>(() => loadLmStudioConfig());
  const abortRef = useRef<AbortController | null>(null);
  const addCard = useAppStore((state) => state.addCard);

  useEffect(() => {
    saveLmStudioConfig(config);
  }, [config]);

  const isSending = status === "sending";

  const runHealthCheck = async (nextConfig: LmStudioConfig, signal?: AbortSignal) => {
    const health = await healthCheck(nextConfig, signal);
    setHealthText(health.details);
    if (!health.ok) {
      throw new Error(
        "LM Studio API недоступен: проверьте что API server запущен, URL/порт верны и доступен /v1/models."
      );
    }
  };

  const handleGenerate = async () => {
    const rows = infinitives
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!rows.length) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const activeConfig = normalizeLmStudioConfig(config);
    setConfig(activeConfig);
    setErrorText("");
    setStatus("sending");

    try {
      await runHealthCheck(activeConfig, controller.signal);

      const payloads: unknown[] = [];
      const rawChunks: string[] = [];

      for (const inf of rows) {
        const generated = await requestCardFromLmStudio(inf, controller.signal, activeConfig);
        rawChunks.push(generated.rawContent);

        let payload = generated.payload;
        const initialValidation = validateAiPayload(payload, mode);

        if (!initialValidation.success) {
          const repaired = await repairJsonWithLmStudio(generated.rawContent, activeConfig, controller.signal);
          rawChunks.push(`[repair]\n${repaired.rawContent}`);
          payload = repaired.payload;
          const repairedValidation = validateAiPayload(payload, mode);
          if (!repairedValidation.success) {
            throw new Error(`Validation failed after repair for "${inf}": ${repairedValidation.error}`);
          }
        }

        payloads.push(payload);
      }

      setRawResponse(rawChunks.join("\n\n"));
      setResponseJson(JSON.stringify(payloads.length === 1 ? payloads[0] : payloads, null, 2));
      setStatus("done");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
      const message = error instanceof LmStudioClientError
        ? `${error.message}${error.details ? `\n${error.details}` : ""}`
        : error instanceof Error
          ? error.message
          : String(error);
      setErrorText(message);
      setStatus("error");
    }
  };

  const handleApply = () => {
    if (!responseJson) return;
    const parsed = JSON.parse(responseJson) as unknown;
    const list = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of list) {
      const validation = validateAiPayload(item, mode);
      if (!validation.success) {
        alert(`Validation failed: ${validation.error}`);
        return;
      }
      if (mode === "generate") {
        addCard(validation.data, "A");
      }
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  };

  const handleLoadModels = async () => {
    try {
      const models = await listModels(config);
      if (!models.length) {
        setHealthText("LM Studio API online, but no models found in /v1/models.");
        return;
      }
      setConfig((prev) => ({ ...prev, model: models[0] || prev.model }));
      setHealthText(`Models detected: ${models.join(", ")}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHealthText(message);
    }
  };

  const statusLabel = useMemo(() => {
    if (status === "sending") return "sending";
    if (status === "done") return "done";
    if (status === "error") return "error";
    return "idle";
  }, [status]);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft flex flex-col gap-4 dark:bg-slate-900/80">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">ИИ-панель</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Генерация карточек через LM Studio</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {status === "sending" && <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />}
          <span>{statusLabel}</span>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">1. LM Studio config</label>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            value={config.baseUrl}
            onChange={(event) => setConfig((prev) => ({ ...prev, baseUrl: event.target.value }))}
            placeholder="http://localhost:1234"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/70"
          />
          <input
            value={config.model}
            onChange={(event) => setConfig((prev) => ({ ...prev, model: event.target.value }))}
            placeholder="model id"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/70"
          />
          <input
            type="number"
            step="0.1"
            min={0}
            max={1.5}
            value={config.temperature}
            onChange={(event) => setConfig((prev) => ({ ...prev, temperature: Number(event.target.value) || 0.4 }))}
            placeholder="temperature"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/70"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => runHealthCheck(normalizeLmStudioConfig(config)).catch((err) => setHealthText(String(err)))}
            className="px-3 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800"
          >
            Health check
          </button>
          <button
            type="button"
            onClick={handleLoadModels}
            className="px-3 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800"
          >
            Load models
          </button>
          <span className="text-slate-500 dark:text-slate-400">{healthText}</span>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">2. Ввод инфинитивов</label>
        <textarea
          value={infinitives}
          onChange={(event) => setInfinitives(event.target.value)}
          placeholder="Infinitiv или список (по одному в строке). Несколько строк = bulk generate"
          className="border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950/70"
        />
      </div>

      <div className="grid gap-2 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">3. Режим работы</label>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 dark:bg-slate-900">
            <input type="radio" checked={mode === "generate"} onChange={() => setMode("generate")} />
            Генерация
          </label>
          <label className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 dark:bg-slate-900">
            <input type="radio" checked={mode === "patch"} onChange={() => setMode("patch")} />
            Патч
          </label>
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">4. Действия</label>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isSending ? "Перезапустить генерацию" : "Сгенерировать"}
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          >
            Отмена
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
          >
            Применить
          </button>
        </div>
        {errorText && <div className="text-xs text-red-500 whitespace-pre-wrap">{errorText}</div>}
      </div>

      <div className="grid gap-2 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">5. Preview JSON</label>
        <textarea
          readOnly
          value={responseJson}
          placeholder="Preview JSON"
          className="border border-slate-200 rounded-xl p-3 text-xs h-36 font-mono bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/70"
        />
      </div>

      <div className="grid gap-2 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">6. Raw model response (debug)</label>
        <textarea
          readOnly
          value={rawResponse}
          placeholder="Raw content from model for debugging parse/repair"
          className="border border-slate-200 rounded-xl p-3 text-xs h-32 font-mono bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/70"
        />
      </div>
    </div>
  );
};
