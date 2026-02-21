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

const THINKING_TICKER_LINES = [
  '{ "task": "build-card", "stage": "tokenize", "status": "running" }',
  'const prompt = buildPrompt(infinitive, inputLanguage);',
  "fetch('/v1/chat/completions', { model, temperature, stream: false });",
  'validateAiPayload(payload, mode) // schema guard',
  'repairJsonWithLmStudio(rawContent) // retry once',
  'card.examples = normalizeLines(card.examples);',
  'persist(queueState); render(progressUI);',
  '// thinking... composing German + RU context',
  '{ "next": "emit-card", "confidence": 0.82 }'
];

const sanitizeCardTextPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return payload;
  const clone = { ...(payload as Record<string, unknown>) };

  for (const [key, value] of Object.entries(clone)) {
    if (typeof value !== "string") continue;
    if (/^(id|inf|forms_|tr_\d+_|syn_\d+_|rek_\d+_|ex_\d+_)/.test(key)) {
      clone[key] = value.replace(/\s+/g, " ").trim();
    }
  }

  const requiredStringFields = [
    "id",
    "inf",
    "tr_1_ru", "tr_1_ctx", "tr_2_ru", "tr_2_ctx", "tr_3_ru", "tr_3_ctx", "tr_4_ru", "tr_4_ctx",
    "forms_p3", "forms_prat", "forms_p2", "forms_service",
    "syn_1_de", "syn_1_ru", "syn_2_de", "syn_2_ru", "syn_3_de", "syn_3_ru",
    "ex_1_de", "ex_1_ru", "ex_1_tag", "ex_2_de", "ex_2_ru", "ex_2_tag", "ex_3_de", "ex_3_ru", "ex_3_tag", "ex_4_de", "ex_4_ru", "ex_4_tag", "ex_5_de", "ex_5_ru", "ex_5_tag",
    "rek_1_de", "rek_1_ru", "rek_2_de", "rek_2_ru", "rek_3_de", "rek_3_ru", "rek_4_de", "rek_4_ru", "rek_5_de", "rek_5_ru"
  ] as const;

  for (const field of requiredStringFields) {
    if (typeof clone[field] !== "string") clone[field] = "";
  }

  if (clone.forms_aux !== "haben" && clone.forms_aux !== "sein" && clone.forms_aux !== "") {
    clone.forms_aux = "";
  }
  if (!Array.isArray(clone.tags)) clone.tags = [];
  if (typeof clone.freq !== "number" || !Number.isFinite(clone.freq)) clone.freq = 0;

  return clone;
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
  const [tickerLines, setTickerLines] = useState<string[]>(["", "", ""]);
  const [streamCollapsed, setStreamCollapsed] = useState(false);
  const [queuePaused, setQueuePaused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const tokenStartedAtRef = useRef<number | null>(null);
  const queuePausedRef = useRef(false);
  const adaptiveTokenTimeoutRef = useRef<number | null>(null);
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

  useEffect(() => {
    queuePausedRef.current = queuePaused;
  }, [queuePaused]);

  const appendLog = (line: string) => {
    setGenerationLog((prev) => [...prev.slice(-80), line]);
  };


  useEffect(() => {
    if (status !== "sending") {
      setTickerLines(["", "", ""]);
      return;
    }

    let sourceIndex = 0;
    let charIndex = 0;

    const ticker = window.setInterval(() => {
      if (queuePausedRef.current) return;
      const source = THINKING_TICKER_LINES[sourceIndex] ?? "";
      if (!source.length) return;

      if (charIndex >= source.length) {
        setTickerLines((prev) => [prev[1] ?? "", prev[2] ?? "", source]);
        sourceIndex = (sourceIndex + 1) % THINKING_TICKER_LINES.length;
        charIndex = 0;
        return;
      }

      charIndex += 1;
      const partial = source.slice(0, charIndex);
      setTickerLines((prev) => [prev[0] ?? "", prev[1] ?? "", partial]);
    }, 20);

    const lineTicker = window.setInterval(() => {
      const line = THINKING_TICKER_LINES[Math.floor(Date.now() / 1200) % THINKING_TICKER_LINES.length] ?? "...";
      appendLog(`💻 ${line}`);
    }, 2200);

    return () => {
      window.clearInterval(ticker);
      window.clearInterval(lineTicker);
    };
  }, [status]);

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
    setQueuePaused(false);
    adaptiveTokenTimeoutRef.current = null;
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
        while (queuePausedRef.current) {
          setQueueInfo("Paused. Нажмите Resume для продолжения.");
          await new Promise((resolve) => window.setTimeout(resolve, 180));
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        }

        const token = tokens[index];
        if (!token) continue;
        setProgressIndex(index + 1);
        setProgressToken(token);
        tokenStartedAtRef.current = Date.now();
        setTokenElapsedMs(0);
        setQueueInfo(`Processing ${index + 1}/${tokens.length}: ${token}`);
        appendLog(`▶️ ${index + 1}/${tokens.length}: ${token}`);

        try {
          const configuredTimeout = activeConfig.timeoutMs;
          const adaptiveTimeout = adaptiveTokenTimeoutRef.current !== null
            ? adaptiveTokenTimeoutRef.current + 5000
            : configuredTimeout;
          const firstAttemptConfig = { ...activeConfig, timeoutMs: adaptiveTimeout };
          const requestStartedAt = Date.now();

          let generated;
          try {
            generated = await requestCardFromLmStudio(token, controller.signal, firstAttemptConfig, inputLanguage);
          } catch (requestError) {
            const normalized = requestError instanceof LmStudioClientError ? requestError : null;
            if (normalized?.code !== "TIMEOUT") throw requestError;

            const retryTimeout = Math.min(adaptiveTimeout + 10000, 120000);
            appendLog(`⏳ ${token}: timeout, retry +10s (${Math.round(retryTimeout / 1000)}s)`);
            generated = await requestCardFromLmStudio(
              token,
              controller.signal,
              { ...activeConfig, timeoutMs: retryTimeout },
              inputLanguage
            );
          }

          const measuredMs = Date.now() - requestStartedAt;
          if (adaptiveTokenTimeoutRef.current === null && measuredMs > 0) {
            adaptiveTokenTimeoutRef.current = measuredMs;
            appendLog(`⏱️ baseline timeout: ${Math.round(measuredMs / 1000)}s`);
          }

          rawChunks.push(`[${token}]\n${generated.rawContent}`);

          let payload = sanitizeCardTextPayload(generated.payload);
          let validation = validateAiPayload(payload, mode);

          if (!validation.success) {
            const repairTimeout = Math.min((adaptiveTokenTimeoutRef.current ?? activeConfig.timeoutMs) + 5000, 120000);
            const repaired = await repairJsonWithLmStudio(
              generated.rawContent,
              { ...activeConfig, timeoutMs: repairTimeout },
              controller.signal
            );
            rawChunks.push(`[repair:${token}]\n${repaired.rawContent}`);
            payload = sanitizeCardTextPayload(repaired.payload);
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
    setQueuePaused(false);
    appendLog("🛑 Отмена");
  };

  const handleLoadModelsClick = async () => {
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
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="w-[min(92vw,54rem)] rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-slate-500 dark:text-slate-400">Генерация</div>
              <div className="text-4xl font-medium text-slate-800 dark:text-slate-100">
                {progressIndex}/{progressTotal} · {progressToken || "подготовка..."}
              </div>
            </div>
            <div className="relative h-24 w-24 rounded-full border-2 border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800">
              <div
                className="absolute left-1/2 top-1/2 h-8 w-[3px] -translate-x-1/2 -translate-y-full bg-slate-700 origin-bottom dark:bg-slate-100"
                style={{ transform: `translateX(-50%) translateY(-100%) rotate(${minuteAngle}deg)` }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-10 w-[2px] -translate-x-1/2 -translate-y-full bg-red-500 origin-bottom"
                style={{ transform: `translateX(-50%) translateY(-100%) rotate(${secondAngle}deg)` }}
              />
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-700 dark:bg-slate-100" />
            </div>
          </div>
          <div className="mt-3 text-2xl text-slate-700 dark:text-slate-200">Текущий глагол: {formatClock(tokenElapsedMs)}</div>
          <div className="text-lg text-slate-500 dark:text-slate-400">Предыдущий: {formatClock(lastTokenMs)}</div>
          </div>
        </div>
      )}

      {status === "sending" && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-slate-900/15 dark:bg-slate-950/30" />
          <div
            className="pointer-events-auto absolute bottom-4 left-4 right-4 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-2xl backdrop-blur transition-all duration-300 dark:border-slate-700 dark:bg-slate-900/85"
            style={{ maxHeight: streamCollapsed ? 56 : 220 }}
          >
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Live generation stream</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setStreamCollapsed((prev) => !prev)}
                  className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-600 dark:text-slate-200"
                >
                  {streamCollapsed ? "Развернуть" : "Свернуть"}
                </button>
                <button
                  type="button"
                  onClick={() => setQueuePaused((prev) => !prev)}
                  className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-600 dark:text-slate-200"
                >
                  {queuePaused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md border border-rose-300 px-2 py-0.5 text-[11px] text-rose-600 dark:border-rose-700 dark:text-rose-300"
                >
                  Прервать
                </button>
              </div>
            </div>
            {!streamCollapsed && (
            <div
              className="rounded-xl bg-slate-50/80 p-2 font-mono text-xs dark:bg-slate-950/60"
              style={{ minHeight: 84 }}
            >
              <div className="space-y-1 text-slate-700 dark:text-slate-200">
                {(tickerLines.length ? tickerLines : ["", "", ""]).map((line, index) => (
                  <div key={`${index}-${line.length}`} className="whitespace-nowrap overflow-hidden text-ellipsis min-h-[16px]">
                    {line}
                  </div>
                ))}
              </div>
              <div className="mt-2 whitespace-nowrap overflow-hidden text-ellipsis text-[11px] leading-4 text-sky-700/90 dark:text-sky-300/90">
                {generationLog[generationLog.length - 1] || "..."}
              </div>
            </div>
            )}
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
            onClick={handleLoadModelsClick}
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
