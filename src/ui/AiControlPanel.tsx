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
    <div className="rounded-lg bg-white p-3 shadow flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">AI Control Panel</h3>
        <span className="text-xs text-slate-500">{statusLabel}</span>
      </div>
      <textarea
        value={infinitives}
        onChange={(event) => setInfinitives(event.target.value)}
        placeholder="Infinitiv или список (по одному в строке)"
        className="border rounded p-2 text-sm"
      />
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "generate"}
            onChange={() => setMode("generate")}
          />
          Generate
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "patch"}
            onChange={() => setMode("patch")}
          />
          Patch
        </label>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          disabled={!canSend}
          onClick={handleGenerate}
          className="px-3 py-1 rounded bg-slate-200 disabled:opacity-50"
        >
          Generate
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1 rounded bg-slate-200"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          className="px-3 py-1 rounded bg-slate-200"
        >
          Apply
        </button>
      </div>
      <textarea
        readOnly
        value={responseJson}
        placeholder="Preview JSON"
        className="border rounded p-2 text-xs h-32 font-mono"
      />
    </div>
  );
};
