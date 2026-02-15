import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../state/store";
import { CardListPanel } from "./CardListPanel";
import { EditorCanvas } from "./EditorCanvas";
import { Toolbar } from "./Toolbar";
import { AiControlPanel } from "./AiControlPanel";
import { selectCardById } from "../utils/selectCard";

export const App = () => {
  const { selectedId, selectedSide, cardsA, cardsB } = useAppStore();
  const resetState = useAppStore((state) => state.resetState);
  const isExporting = useAppStore((state) => state.isExporting);
  const editModeEnabled = useAppStore((state) => state.editModeEnabled);
  const toggleEditMode = useAppStore((state) => state.toggleEditMode);
  const exportStartedAt = useAppStore((state) => state.exportStartedAt);
  const exportLabel = useAppStore((state) => state.exportLabel);
  const storageWarning = useAppStore((state) => state.storageWarning);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [elapsed, setElapsed] = useState(0);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const selectedCard = useMemo(() => {
    if (!selectedId) return null;
    return selectCardById(selectedId, selectedSide, cardsA, cardsB);
  }, [selectedId, selectedSide, cardsA, cardsB]);

  const headline = useMemo(() => {
    if (!selectedId) {
      return "Выберите карточку для редактирования";
    }
    if (selectedCard) {
      return `Активная карточка: ${selectedCard.inf || "Без названия"} (Коллекция ${selectedSide})`;
    }
    return `Активная карточка: ${selectedId} (${selectedSide})`;
  }, [selectedId, selectedSide, selectedCard]);

  useEffect(() => {
    const stored = localStorage.getItem("lc_theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("lc_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!isExporting || !exportStartedAt) {
      setElapsed(0);
      return;
    }
    const interval = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - exportStartedAt) / 1000));
    }, 250);
    return () => window.clearInterval(interval);
  }, [isExporting, exportStartedAt]);

  const formatElapsed = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 px-4 py-3 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white/85 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">LingoCard 2.0</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Дневной редактор карточек</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleEditMode}
            className={`inline-flex items-center justify-center rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
              editModeEnabled
                ? "border-emerald-300 bg-emerald-500 text-white hover:bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-600"
                : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
            title="Включает/выключает возможность редактирования карточек"
          >
            Режим редактирования: {editModeEnabled ? "Вкл" : "Выкл"}
          </button>
          <button
            onClick={() => {
              if (window.confirm("Сбросить состояние? Это удалит временные данные.")) {
                resetState();
              }
            }}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:text-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:text-white"
          >
            Сбросить состояние
          </button>
          <div
            className="rounded-lg bg-white px-3 py-1 text-[11px] text-slate-500 shadow-soft dark:bg-slate-900 dark:text-slate-300"
            title={selectedCard?.id ?? ""}
          >
            {headline}
          </div>
        </div>
      </header>
      {storageWarning && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
          {storageWarning}
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr_300px] items-start gap-4">
        <CardListPanel side="A" />
        <div className="sticky top-0 flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          <Toolbar theme={theme} onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))} />
          <div className="rounded-2xl bg-white p-3 shadow-soft dark:bg-slate-900/80">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide">Рабочая область</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Настройте расположение элементов карточки
                </p>
              </div>
            </div>
            <div className="mb-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              {selectedCard ? (
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-700 dark:text-slate-100">
                    {selectedCard.inf || selectedCard.id} (Коллекция {selectedSide})
                  </div>
                  <span className="text-xs text-slate-400">{editModeEnabled ? "Готово к редактированию" : "Режим просмотра (редактирование выключено)"}</span>
                </div>
              ) : (
                "Выберите карточку слева или создайте новую, чтобы начать работу."
              )}
            </div>
            <EditorCanvas />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-900/85">
            <button
              type="button"
              onClick={() => setAiPanelOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <span>AI panel</span>
              <span className={`transition-transform duration-200 ${aiPanelOpen ? "rotate-180" : "rotate-0"}`}>▾</span>
            </button>
            <div className={`grid overflow-hidden transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${aiPanelOpen ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0"}`}>
              <div className="p-2">
                <AiControlPanel />
              </div>
            </div>
          </div>
        </div>
        <CardListPanel side="B" />
      </div>
      {isExporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-lg dark:bg-slate-900">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full border-2 border-slate-200 relative">
              <div
                className="absolute left-1/2 top-1/2 h-6 w-px bg-slate-400 origin-bottom"
                style={{ transform: `translate(-50%, -100%) rotate(${elapsed * 6}deg)` }}
              />
            </div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {exportLabel ?? "Экспорт..."}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {formatElapsed(elapsed)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
