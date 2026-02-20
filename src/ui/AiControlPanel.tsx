import { useEffect, useMemo, useRef, useState } from "react";
import {
  healthCheck,
  listModels,
  repairJsonWithLmStudio,
  requestCardFromLmStudio,
  LmStudioClientError
} from "../ai/lmStudioClient";
import { validateAiPayload } from "../ai/validateAiResponse";
import { useAppStore } from "../state/store";
import {
  loadLmStudioConfig,
  normalizeLmStudioConfig,
  saveLmStudioConfig,
  type LmStudioConfig
} from "../ai/aiConfig";
import type { AiInputLanguage } from "../ai/promptBuilder";

const splitInputTokens = (raw: string) =>
  raw
    .split(/\r?\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);

const formatClock = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const sec = (totalSec % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
};

export const AiControlPanel = () => {
  const [infinitives, setInfinitives] = useState("");
  const [mode, setMode] = useState<"generate" | "patch">("generate");
  const [inputLanguage, setInputLanguage] = useState<AiInputLanguage>("ALL");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [responseJson, setResponseJson] = useState<string>("");
  const [rawResponse, setRawResponse] = useState<string>("");
  const [errorText, setErrorText] = useState<string>("");
  const [healthText, setHealthText] = useState<string>("");
  const [queueInfo, setQueueInfo] = useState<string>("");
  const [config, setConfig] = useState<LmStudioConfig>(() => loadLmStudioConfig());
  const [progressToken, setProgressToken] = useState("");
  const [progressIndex, setProgressIndex] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [tokenElapsedMs, setTokenElapsedMs] = useState(0);
  const [lastTokenMs, setLastTokenMs] = useState(0);
  const [generationLog, setGenerationLog] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const tokenStartedAtRef = useRef<number | null>(null);
  const addCard = useAppStore((state) => state.addCard);
  const editModeEnabled = useAppStore((state) => state.editModeEnabled);
  const toggleEditMode = useAppStore((state) => state.toggleEditMode);

  useEffect(() => {
    saveLmStudioConfig(config);
  }, [config]);

  useEffect(() => {
    if (status !== "sending") return;
    const timer = window.setInterval(() => {
      const started = tokenStartedAtRef.current;
      if (!started) return;
      setTokenElapsedMs(Date.now() - started);
    }, 200);
    return () => window.clearInterval(timer);
  }, [status]);

  const isSending = status === "sending";

  const appendLog = (line: string) => {
    setGenerationLog((prev) => [...prev.slice(-12), line]);
  };

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
    const tokens = splitInputTokens(infinitives);
    if (!tokens.length) return;

    if (!editModeEnabled) {
      toggleEditMode();
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const activeConfig = normalizeLmStudioConfig(config);
    setConfig(activeConfig);
    setErrorText("");
    setStatus("sending");
    setProgressTotal(tokens.length);
    setProgressIndex(0);
    setProgressToken("");
    setTokenElapsedMs(0);
    setLastTokenMs(0);
    setGenerationLog([]);
    appendLog(`⏳ Запуск генерации: ${tokens.length} токен(ов)`);

    try {
      await runHealthCheck(activeConfig, controller.signal);
      appendLog("✅ Health check OK");

      if (!activeConfig.model || activeConfig.model === "local-model") {
        const models = await listModels(activeConfig, controller.signal);
        if (models.length) {
          activeConfig.model = models[0] || activeConfig.model;
          setConfig({ ...activeConfig });
          appendLog(`🤖 Модель: ${activeConfig.model}`);
        }
      }

      const payloads: unknown[] = [];
      const rawChunks: string[] = [];
      const tokenErrors: string[] = [];

      for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (!token) continue;
        setProgressIndex(index + 1);
        setProgressToken(token);
        tokenStartedAtRef.current = Date.now();
        setTokenElapsedMs(0);
        setQueueInfo(`Processing ${index + 1}/${tokens.length}: ${token}`);
        appendLog(`▶️ ${index + 1}/${tokens.length}: ${token}`);

        try {
          const generated = await requestCardFromLmStudio(token, controller.signal, activeConfig, inputLanguage);
          rawChunks.push(`[${token}]\n${generated.rawContent}`);

          let payload = generated.payload;
          let validation = validateAiPayload(payload, mode);

          if (!validation.success) {
            const repaired = await repairJsonWithLmStudio(generated.rawContent, activeConfig, controller.signal);
            rawChunks.push(`[repair:${token}]\n${repaired.rawContent}`);
            payload = repaired.payload;
            validation = validateAiPayload(payload, mode);
          }

          if (!validation.success) {
            tokenErrors.push(`${token}: ${validation.error}`);
            appendLog(`❌ ${token}: validation failed`);
            continue;
          }

          payloads.push(validation.data);
          if (mode === "generate") {
            addCard(validation.data, "B");
          }
          appendLog(`✅ ${token}: карточка добавлена`);
        } catch (tokenError) {
          const message = tokenError instanceof Error ? tokenError.message : String(tokenError);
          tokenErrors.push(`${token}: ${message}`);
          appendLog(`❌ ${token}: ${message}`);
        } finally {
          const started = tokenStartedAtRef.current;
          const elapsed = started ? Date.now() - started : 0;
          setLastTokenMs(elapsed);
          appendLog(`⏱️ ${token}: ${formatClock(elapsed)}`);
          tokenStartedAtRef.current = null;
        }
      }

      setRawResponse(rawChunks.join("\n\n"));
      setResponseJson(JSON.stringify(payloads.length === 1 ? payloads[0] : payloads, null, 2));

      if (payloads.length) {
        setStatus(tokenErrors.length ? "error" : "done");
        setQueueInfo(`Done: ${payloads.length}/${tokens.length} card(s).`);
        appendLog(`🏁 Готово: ${payloads.length}/${tokens.length}`);
        if (tokenErrors.length) {
          setErrorText(`Some tokens failed:\n${tokenErrors.join("\n")}`);
        }
      } else {
        throw new Error(tokenErrors.length ? `All tokens failed:\n${tokenErrors.join("\n")}` : "No cards generated");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        setQueueInfo("Canceled.");
        appendLog("🛑 Отменено пользователем");
        return;
      }
      const message =
        error instanceof LmStudioClientError
          ? `${error.message}${error.details ? `\n${error.details}` : ""}`
          : error instanceof Error
            ? error.message
            : String(error);
      setErrorText(message);
      setStatus("error");
      appendLog(`❌ Ошибка: ${message}`);
    } finally {
      abortRef.current = null;
      tokenStartedAtRef.current = null;
      setProgressToken("");
      setTokenElapsedMs(0);
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
        addCard(validation.data, "B");
      }
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    tokenStartedAtRef.current = null;
    setStatus("idle");
    appendLog("🛑 Отмена");
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

  const secondAngle = ((tokenElapsedMs / 1000) % 60) * 6;
  const minuteAngle = ((tokenElapsedMs / 60000) % 60) * 6 + secondAngle / 60;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft flex flex-col gap-4 dark:bg-slate-900/80">
      {status === "sending" && (
        <div className="fixed right-4 top-4 z-50 w-72 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Генерация</div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {progressIndex}/{progressTotal} · {progressToken || "подготовка..."}
              </div>
            </div>
            <div className="relative h-14 w-14 rounded-full border-2 border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800">
              <div
                className="absolute left-1/2 top-1/2 h-5 w-[2px] -translate-x-1/2 -translate-y-full bg-slate-700 origin-bottom dark:bg-slate-100"
                style={{ transform: `translateX(-50%) translateY(-100%) rotate(${minuteAngle}deg)` }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-6 w-[1px] -translate-x-1/2 -translate-y-full bg-red-500 origin-bottom"
                style={{ transform: `translateX(-50%) translateY(-100%) rotate(${secondAngle}deg)` }}
              />
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-700 dark:bg-slate-100" />
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">Текущий глагол: {formatClock(tokenElapsedMs)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Предыдущий: {formatClock(lastTokenMs)}</div>
        </div>
      )}

      {status === "sending" && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-slate-900/15 dark:bg-slate-950/30" />
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/85">
            <div className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Live generation stream</div>
            <div className="h-24 overflow-hidden rounded-xl bg-slate-50/80 p-2 font-mono text-xs dark:bg-slate-950/60">
              <div className="animate-pulse space-y-1">
                {generationLog.slice(-6).map((line, index) => (
                  <div key={`${line}-${index}`} className="truncate text-slate-700 dark:text-slate-200">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input
            value={config.baseUrl}
            onChange={(event) => setConfig((prev) => ({ ...prev, baseUrl: event.target.value }))}
            placeholder="http://127.0.0.1:1234"
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
          <input
            type="number"
            min={30000}
            max={120000}
            step={1000}
            value={config.timeoutMs}
            onChange={(event) => setConfig((prev) => ({ ...prev, timeoutMs: Number(event.target.value) || 90000 }))}
            placeholder="timeout ms"
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
          placeholder="Введите глаголы: Enter или запятая. Каждый токен обрабатывается отдельно."
          className="border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950/70"
        />
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Input lang:</span>
          <select
            value={inputLanguage}
            onChange={(event) => setInputLanguage(event.target.value as AiInputLanguage)}
            className="rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="ALL">ALL</option>
            <option value="RU">RU</option>
            <option value="DE">DE</option>
            <option value="EN">EN</option>
          </select>
          <span>{queueInfo}</span>
        </div>
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
            Применить повторно из Preview
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
