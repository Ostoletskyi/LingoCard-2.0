import { useMemo, useRef, useState } from "react";
import { buildPrompt } from "../ai/promptBuilder";
import { requestCardFromLmStudio } from "../ai/lmStudioClient";
import { validateAiPayload } from "../ai/validateAiResponse";
import { useAppStore } from "../state/store";

export const AiControlPanel = () => {
  const [infinitives, setInfinitives] = useState("");
  const [mode, setMode] = useState<"generate" | "patch">("generate");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [responseJson, setResponseJson] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const addCard = useAppStore((state) => state.addCard);

  const canSend = status !== "sending";

  const handleGenerate = async () => {
    if (!canSend) {
      alert("Request in progress");
      return;
    }
    const normalized = infinitives.trim();
    if (!normalized) return;
    setStatus("sending");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const prompt = buildPrompt(normalized, mode);
      const data = await requestCardFromLmStudio(prompt, controller.signal);
      const json = JSON.stringify(data, null, 2);
      setResponseJson(json);
      setStatus("done");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
      console.error(error);
      setStatus("error");
    }
  };

  const handleApply = () => {
    if (!responseJson) return;
    const parsed = JSON.parse(responseJson);
    const validation = validateAiPayload(parsed, mode);
    if (!validation.success) {
      alert(`Validation failed: ${validation.error}`);
      return;
    }
    if (mode === "generate") {
      addCard(validation.data, "A");
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setStatus("idle");
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
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            ИИ-панель
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Помощник для генерации карточек
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {status === "sending" && (
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          )}
          <span>{statusLabel}</span>
        </div>
      </div>
      <div className="grid gap-3 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          1. Ввод инфинитивов
        </label>
        <textarea
          value={infinitives}
          onChange={(event) => setInfinitives(event.target.value)}
          placeholder="Infinitiv или список (по одному в строке)"
          className="border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950/70"
        />
      </div>
      <div className="grid gap-2 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          2. Режим работы
        </label>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 dark:bg-slate-900">
            <input
              type="radio"
              checked={mode === "generate"}
              onChange={() => setMode("generate")}
            />
            Генерация
          </label>
          <label className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 dark:bg-slate-900">
            <input
              type="radio"
              checked={mode === "patch"}
              onChange={() => setMode("patch")}
            />
            Патч
          </label>
        </div>
      </div>
      <div className="grid gap-2 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          3. Действия
        </label>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            disabled={!canSend}
            onClick={handleGenerate}
            className="px-4 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Сгенерировать
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
      </div>
      <div className="grid gap-2 rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          4. Preview JSON
        </label>
        <textarea
          readOnly
          value={responseJson}
          placeholder="Preview JSON"
          className="border border-slate-200 rounded-xl p-3 text-xs h-32 font-mono bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/70"
        />
      </div>
    </div>
  );
};
