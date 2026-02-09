import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../state/store";
import { CardListPanel } from "./CardListPanel";
import { EditorCanvas } from "./EditorCanvas";
import { Toolbar } from "./Toolbar";
import { AiControlPanel } from "./AiControlPanel";
import { selectCardById } from "../utils/selectCard";

export const App = () => {
  const { selectedId, selectedSide, cardsA, cardsB } = useAppStore();
  const isExporting = useAppStore((state) => state.isExporting);
  const exportStartedAt = useAppStore((state) => state.exportStartedAt);
  const exportLabel = useAppStore((state) => state.exportLabel);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [elapsed, setElapsed] = useState(0);

  const selectedCard = useMemo(() => {
    if (!selectedId) return null;
    return selectCardById(selectedId, selectedSide, cardsA, cardsB);
  }, [selectedId, selectedSide, cardsA, cardsB]);

  const headline = useMemo(() => {
    if (!selectedId) {
      return "Выберите карточку для редактирования";
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
    <div className="min-h-screen bg-slate-50 px-6 py-5">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">LingoCard 2.0</h1>
          <p className="text-sm text-slate-500">
            Дневной редактор карточек немецких глаголов
          </p>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-xs text-slate-500 shadow-soft">
          {headline}
        </div>
      </header>
      <div className="grid grid-cols-[300px_1fr_300px] gap-6">
        <CardListPanel side="A" />
        <div className="flex flex-col gap-6">
          <Toolbar />
          <div className="rounded-2xl bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Рабочая область</h2>
                <p className="text-sm text-slate-500">
                  Настройте расположение элементов карточки
                </p>
              </div>
            </div>
            <EditorCanvas />
          </div>
          <AiControlPanel />
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
