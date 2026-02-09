import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../state/store";
import { CardListPanel } from "./CardListPanel";
import { EditorCanvas } from "./EditorCanvas";
import { Toolbar } from "./Toolbar";
import { AiControlPanel } from "./AiControlPanel";
import { selectCardById } from "../utils/selectCard";

export const App = () => {
  const { selectedId, selectedSide, cardsA, cardsB } = useAppStore();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const headline = useMemo(() => {
    if (!selectedId) {
      return "Выберите карточку для редактирования";
    }
    return `Активная карточка: ${selectedId} (${selectedSide})`;
  }, [selectedId, selectedSide]);

  const selectedCard = useMemo(() => {
    if (!selectedId) return null;
    return selectCardById(selectedId, selectedSide, cardsA, cardsB);
  }, [selectedId, selectedSide, cardsA, cardsB]);

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

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">LingoCard 2.0</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Дневной редактор карточек немецких глаголов
          </p>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-xs text-slate-500 shadow-soft dark:bg-slate-900 dark:text-slate-300">
          {headline}
        </div>
      </header>
      <div className="grid grid-cols-[300px_1fr_300px] gap-6">
        <CardListPanel side="A" />
        <div className="flex flex-col gap-6">
          <Toolbar theme={theme} onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))} />
          <div className="rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900/80">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Рабочая область</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Настройте расположение элементов карточки
                </p>
              </div>
            </div>
            <div className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              {selectedCard ? (
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-700 dark:text-slate-100">
                    {selectedCard.inf || selectedCard.id} (Коллекция {selectedSide})
                  </div>
                  <span className="text-xs text-slate-400">Готово к редактированию</span>
                </div>
              ) : (
                "Выберите карточку слева или создайте новую, чтобы начать работу."
              )}
            </div>
            <EditorCanvas />
          </div>
          <AiControlPanel />
        </div>
        <CardListPanel side="B" />
      </div>
    </div>
  );
};
